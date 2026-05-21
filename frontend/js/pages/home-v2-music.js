(() => {
    const _d = typeof window._dbg === 'function' ? window._dbg : function(){};
    let nutNhac, iconNhac, textNhac, ghiChuNhac, nhacNen, khungYoutube;

    function initElements() {
        _d('initElements() called');
        nutNhac = document.getElementById('nut-nhac');
        iconNhac = document.getElementById('icon-nhac');
        textNhac = document.getElementById('text-nhac');
        ghiChuNhac = document.getElementById('ghi-chu-nhac');
        nhacNen = document.getElementById('nhac-nen');
        khungYoutube = document.getElementById('yt-player-shell');

        if (!nhacNen || !khungYoutube || !nutNhac || !iconNhac || !textNhac || !ghiChuNhac) {
            _d('FAILED! Missing elements: nhac-nen=' + !!nhacNen + ' yt=' + !!khungYoutube + ' nut=' + !!nutNhac + ' icon=' + !!iconNhac + ' text=' + !!textNhac + ' ghi=' + !!ghiChuNhac);
            return false;
        }
        _d('initElements() OK - all found');
        return true;
    }

    const suKienKhoiDong = ['pointerdown', 'touchstart', 'keydown'];
    const LINK_NHAC_MAC_DINH = 'https://image2url.com/r2/default/files/1775369939399-e6f877b8-b3b3-4293-adb6-fd272ae56243.mp3';

    let danhSachNhac = [];
    let cheDoPhat = 'sequential';
    let hangPhat = [];
    let viTriHangPhat = -1;
    let baiHienTai = null;
    let dangPhat = false;
    let tamDungThuCong = false;
    let dangChuyenBai = false;
    let henGioChuyenBai = null;
    let youtubeApiPromise = null;
    let youtubePlayerPromise = null;
    let youtubePlayer = null;
    let pendingYouTubeStart = null;

    function updateMusicLabel(text, iconClass) {
        if (!textNhac || !iconNhac) return;
        textNhac.textContent = text;
        iconNhac.className = `fi ${iconClass}`;
        console.log('Banner Music: Label updated', { text, iconClass });
    }

    function xoaHenGioChuyenBai() {
        if (henGioChuyenBai) {
            window.clearTimeout(henGioChuyenBai);
            henGioChuyenBai = null;
        }
    }

    function xaoTronDanhSach(items = []) {
        const clone = [...items];
        for (let index = clone.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
        }
        return clone;
    }

    function laLinkYoutube(value = '') {
        return /(?:youtu\.be\/|youtube\.com\/)/i.test(String(value || '').trim());
    }

    function loaiNguonNhac(url = '') {
        return laLinkYoutube(url) ? 'youtube' : 'audio';
    }

    function lamSachTenBai(value = '') {
        return String(value || '')
            .replace(/\.[a-z0-9]{2,5}$/i, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function suyRaTenBai(url = '', fallback = '') {
        const tenFallback = lamSachTenBai(fallback);
        if (tenFallback) {
            return tenFallback;
        }

        const raw = String(url || '').trim();
        if (!raw) {
            return 'Nhạc nền';
        }

        if (laLinkYoutube(raw)) {
            return 'YouTube';
        }

        try {
            const parsed = new URL(raw, document.baseURI);
            const segmentCuoi = parsed.pathname.split('/').filter(Boolean).pop() || '';
            return lamSachTenBai(decodeURIComponent(segmentCuoi)) || parsed.hostname || 'Nhạc nền';
        } catch (_) {
            return lamSachTenBai(raw) || 'Nhạc nền';
        }
    }

    function tachDanhSachNhac(raw = '') {
        return String(raw || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => {
                const separatorIndex = line.indexOf('|');
                const titlePart = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : '';
                const urlPart = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
                if (!urlPart) {
                    return null;
                }

                return {
                    title: titlePart || suyRaTenBai(urlPart, `Bài ${index + 1}`),
                    url: urlPart,
                    type: loaiNguonNhac(urlPart)
                };
            })
            .filter(Boolean);
    }

    function layTenBai(track = baiHienTai) {
        return track && track.title ? track.title : 'Nhạc nền';
    }

    function capNhatTrangThaiNhac(isPlaying, message = '') {
        dangPhat = isPlaying;
        nutNhac.classList.toggle('dang-phat', isPlaying);
        nutNhac.setAttribute('aria-pressed', String(isPlaying));
        nutNhac.setAttribute('aria-label', isPlaying ? `Tắt nhạc: ${layTenBai()}` : `Bật nhạc: ${layTenBai()}`);
        ghiChuNhac.classList.toggle('san-sang', isPlaying);

        if (message) {
            ghiChuNhac.textContent = message;
            return;
        }

        if (isPlaying) {
            ghiChuNhac.textContent = `Đang phát: ${layTenBai()}${cheDoPhat === 'shuffle' ? ' · ngẫu nhiên' : ''}.`;
            return;
        }

        if (baiHienTai) {
            ghiChuNhac.textContent = `Nhạc đang tắt. Bài hiện tại: ${layTenBai()}.`;
            return;
        }

        ghiChuNhac.textContent = 'Trình duyệt có thể chặn tự phát. Nếu chưa có tiếng, chạm một lần để bật nhạc.';
    }

    function goBoSuKienKhoiDong() {
        suKienKhoiDong.forEach((tenSuKien) => {
            document.removeEventListener(tenSuKien, batNhacTuongTacDau, true);
        });
    }

    function taoHangPhat(previousTrackIndex = -1) {
        const indices = danhSachNhac.map((_, index) => index);
        if (cheDoPhat === 'shuffle' && indices.length > 1) {
            const mixed = xaoTronDanhSach(indices);
            if (previousTrackIndex >= 0 && mixed[0] === previousTrackIndex) {
                const swapIndex = mixed.findIndex((value) => value !== previousTrackIndex);
                if (swapIndex > 0) {
                    [mixed[0], mixed[swapIndex]] = [mixed[swapIndex], mixed[0]];
                }
            }
            hangPhat = mixed;
            return;
        }

        hangPhat = indices;
    }

    function caiDatDanhSachMacDinh(data = {}) {
        const danhSachLuu = tachDanhSachNhac(data.banner_v2_music_playlist || '');
        if (danhSachLuu.length) {
            return danhSachLuu;
        }

        const legacyUrl = String(data.default_profile_music_url || '').trim();
        if (legacyUrl) {
            return [{
                title: String(data.default_profile_music_title || '').trim() || suyRaTenBai(legacyUrl),
                url: legacyUrl,
                type: loaiNguonNhac(legacyUrl)
            }];
        }

        return [{
            title: 'Nhạc nền Banner',
            url: LINK_NHAC_MAC_DINH,
            type: 'audio'
        }];
    }

    function layVideoYoutubeId(url = '') {
        const raw = String(url || '').trim();
        if (!raw) return '';

        if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) {
            return raw;
        }

        try {
            const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`, document.baseURI);
            const host = parsed.hostname.replace(/^www\./i, '');

            if (host === 'youtu.be') {
                return parsed.pathname.split('/').filter(Boolean)[0] || '';
            }

            if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com') {
                const searchV = parsed.searchParams.get('v');
                if (searchV) return searchV;

                const pathSegments = parsed.pathname.split('/').filter(Boolean);
                if (pathSegments[0] === 'watch') return parsed.searchParams.get('v') || '';
                if (pathSegments[0] === 'shorts') return pathSegments[1] || '';
                if (pathSegments[0] === 'embed') return pathSegments[1] || '';
                if (pathSegments[0] === 'v') return pathSegments[1] || '';
                if (pathSegments[0] === 'live') return pathSegments[1] || '';
            }
        } catch (_) {
            const match = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|u\/\w\/|embed\/|watch\?v=|shorts\/|live\/))([^#&?]*)/);
            return (match && match[1] && match[1].length === 11) ? match[1] : '';
        }

        return '';
    }

    function giaiQuyetChoYouTube(result) {
        if (!pendingYouTubeStart) {
            return;
        }

        const { resolve, timeoutId } = pendingYouTubeStart;
        pendingYouTubeStart = null;
        window.clearTimeout(timeoutId);
        resolve(result);
    }

    function lapLichChuyenBai(message) {
        xoaHenGioChuyenBai();
        capNhatTrangThaiNhac(false, message);
        henGioChuyenBai = window.setTimeout(() => {
            henGioChuyenBai = null;
            phatBaiTiepTheo('auto');
        }, 900);
    }

    async function taiYouTubeApi() {
        if (window.YT && typeof window.YT.Player === 'function') {
            return window.YT;
        }

        if (youtubeApiPromise) {
            return youtubeApiPromise;
        }

        youtubeApiPromise = new Promise((resolve, reject) => {
            const previousReady = window.onYouTubeIframeAPIReady;
            const timeoutId = window.setTimeout(() => {
                reject(new Error('Tải YouTube Player quá lâu'));
            }, 12000);

            window.onYouTubeIframeAPIReady = () => {
                window.clearTimeout(timeoutId);
                if (typeof previousReady === 'function') {
                    try {
                        previousReady();
                    } catch (_) {
                        // ignore
                    }
                }
                resolve(window.YT);
            };

            const existingScript = document.querySelector('script[data-youtube-api="1"]');
            if (existingScript) {
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.dataset.youtubeApi = '1';
            script.onerror = () => {
                window.clearTimeout(timeoutId);
                reject(new Error('Không tải được YouTube Player'));
            };
            document.head.appendChild(script);
        }).catch((error) => {
            youtubeApiPromise = null;
            throw error;
        });

        return youtubeApiPromise;
    }

    function xuLyTrangThaiYouTube(event) {
        if (!window.YT || !event) {
            return;
        }

        if (event.data === window.YT.PlayerState.PLAYING) {
            tamDungThuCong = false;
            capNhatTrangThaiNhac(true);
            updateMusicLabel('Nhạc', 'fi-sr-volume');
            goBoSuKienKhoiDong();
            giaiQuyetChoYouTube(true);
            return;
        }

        if (event.data === window.YT.PlayerState.ENDED) {
            giaiQuyetChoYouTube(true);
            phatBaiTiepTheo('auto');
            return;
        }

        if (event.data === window.YT.PlayerState.PAUSED && !tamDungThuCong && baiHienTai && baiHienTai.type === 'youtube' && !dangChuyenBai) {
            capNhatTrangThaiNhac(false, `Nhạc đã tạm dừng: ${layTenBai()}.`);
            updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
        }
    }

    function xuLyLoiYouTube() {
        giaiQuyetChoYouTube(false);
        lapLichChuyenBai(`Không phát được YouTube: ${layTenBai()}. Đang chuyển bài khác...`);
    }

    async function layYouTubePlayer() {
        if (youtubePlayer) {
            return youtubePlayer;
        }

        if (youtubePlayerPromise) {
            return youtubePlayerPromise;
        }

        youtubePlayerPromise = taiYouTubeApi().then(() => new Promise((resolve, reject) => {
            try {
                youtubePlayer = new window.YT.Player('yt-player', {
                    width: '1',
                    height: '1',
                    videoId: '',
                    playerVars: {
                        autoplay: 1,
                        playsinline: 1,
                        rel: 0,
                        controls: 0,
                        modestbranding: 1,
                        iv_load_policy: 3,
                        origin: window.location.origin
                    },
                    events: {
                        onReady: () => {
                            try {
                                const iframe = youtubePlayer.getIframe();
                                if (iframe) {
                                    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
                                    iframe.setAttribute('tabindex', '-1');
                                }
                            } catch (_) {
                                // ignore
                            }
                            resolve(youtubePlayer);
                        },
                        onStateChange: xuLyTrangThaiYouTube,
                        onError: xuLyLoiYouTube
                    }
                });
            } catch (error) {
                reject(error);
            }
        })).catch((error) => {
            youtubePlayerPromise = null;
            throw error;
        });

        return youtubePlayerPromise;
    }

    async function phatNguonAudio(track, reason = 'manual') {
        if (youtubePlayer) {
            try {
                youtubePlayer.pauseVideo();
            } catch (_) {
                // ignore
            }
        }

        if (nhacNen.dataset.trackUrl !== track.url) {
            nhacNen.pause();
            nhacNen.src = track.url;
            nhacNen.dataset.trackUrl = track.url;
            nhacNen.load();
        }

        tamDungThuCong = false;

        try {
            await nhacNen.play();
            goBoSuKienKhoiDong();
            capNhatTrangThaiNhac(true);
            updateMusicLabel('Nhạc', 'fi-sr-volume');
            return true;
        } catch (_) {
            if (reason === 'auto') {
                capNhatTrangThaiNhac(false, `Trình duyệt có thể đang chặn tự phát: ${layTenBai(track)}. Chạm nút để bật nhạc.`);
                updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
                return 'blocked';
            }

            capNhatTrangThaiNhac(false, `Không thể phát file nhạc: ${layTenBai(track)}.`);
            updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
            return false;
        }
    }

    async function phatNguonYouTube(track, reason = 'manual') {
        const videoId = layVideoYoutubeId(track.url);
        if (!videoId) {
            return false;
        }

        nhacNen.pause();

        try {
            const player = await layYouTubePlayer();
            tamDungThuCong = false;

            return await new Promise((resolve) => {
                const timeoutId = window.setTimeout(() => {
                    pendingYouTubeStart = null;
                    if (reason === 'auto') {
                        capNhatTrangThaiNhac(false, `Trình duyệt có thể đang chặn tự phát: ${layTenBai(track)}. Chạm nút để bật nhạc.`);
                        updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
                        resolve('blocked');
                        return;
                    }

                    capNhatTrangThaiNhac(false, `Không thể phát YouTube: ${layTenBai(track)}.`);
                    updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
                    resolve(false);
                }, 3500);

                pendingYouTubeStart = { resolve, timeoutId };

                try {
                    player.loadVideoById(videoId);
                    player.playVideo();
                } catch (_) {
                    pendingYouTubeStart = null;
                    window.clearTimeout(timeoutId);
                    resolve(false);
                }
            });
        } catch (_) {
            capNhatTrangThaiNhac(false, `Không tải được YouTube Player cho bài ${layTenBai(track)}.`);
            updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
            return false;
        }
    }

    async function phatBai(track, reason = 'manual') {
        xoaHenGioChuyenBai();
        baiHienTai = track;
        dangChuyenBai = true;

        try {
            if (track.type === 'youtube') {
                return await phatNguonYouTube(track, reason);
            }
            return await phatNguonAudio(track, reason);
        } finally {
            dangChuyenBai = false;
        }
    }

    async function batDauPhatTaiViTri(startIndex = 0, reason = 'manual') {
        if (!danhSachNhac.length) {
            capNhatTrangThaiNhac(false, 'Chưa có nhạc nền cho Banner V2.');
            updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
            return false;
        }

        if (!hangPhat.length || hangPhat.length !== danhSachNhac.length) {
            taoHangPhat();
        }

        const maxAttempts = Math.min(danhSachNhac.length, hangPhat.length || danhSachNhac.length);
        let viTriBatDau = Math.max(0, startIndex);

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            if (viTriBatDau >= hangPhat.length) {
                const previousTrackIndex = hangPhat.length ? hangPhat[hangPhat.length - 1] : -1;
                taoHangPhat(previousTrackIndex);
                viTriBatDau = 0;
            }

            const trackIndex = hangPhat[viTriBatDau];
            const track = danhSachNhac[trackIndex];
            viTriHangPhat = viTriBatDau;

            const result = await phatBai(track, reason);
            if (result === true || result === 'blocked') {
                return result;
            }

            viTriBatDau += 1;
        }

        capNhatTrangThaiNhac(false, 'Không phát được nguồn nhạc nào trong playlist.');
        updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
        return false;
    }

    async function phatBaiTiepTheo(reason = 'auto') {
        return batDauPhatTaiViTri(viTriHangPhat + 1, reason);
    }

    async function tiepTucBaiDangMo(reason = 'manual') {
        if (!baiHienTai) {
            return batDauPhatTaiViTri(0, reason);
        }

        if (baiHienTai.type === 'youtube' && youtubePlayer) {
            try {
                tamDungThuCong = false;
                youtubePlayer.playVideo();
                return true;
            } catch (_) {
                // ignore
            }
        }

        if (baiHienTai.type === 'audio' && nhacNen.dataset.trackUrl === baiHienTai.url) {
            try {
                tamDungThuCong = false;
                await nhacNen.play();
                goBoSuKienKhoiDong();
                capNhatTrangThaiNhac(true);
                updateMusicLabel('Nhạc', 'fi-sr-volume');
                return true;
            } catch (_) {
                if (reason === 'auto') {
                    capNhatTrangThaiNhac(false, `Trình duyệt có thể đang chặn tự phát: ${layTenBai()}. Chạm nút để bật nhạc.`);
                    updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
                    return 'blocked';
                }
            }
        }

        return phatBai(baiHienTai, reason);
    }

    function tamDungNguonHienTai() {
        xoaHenGioChuyenBai();
        tamDungThuCong = true;

        if (baiHienTai && baiHienTai.type === 'youtube' && youtubePlayer) {
            try {
                youtubePlayer.pauseVideo();
            } catch (_) {
                // ignore
            }
        } else {
            nhacNen.pause();
        }

        capNhatTrangThaiNhac(false, baiHienTai ? `Nhạc đang tắt: ${layTenBai()}.` : 'Nhạc đang tắt.');
        updateMusicLabel('Nhạc', 'fi-sr-volume-slash');
    }

    async function batNhacTuongTacDau(event) {
        const target = event && event.target;
        if (target && typeof target.closest === 'function' && target.closest('#nut-nhac')) {
            return;
        }

        if (dangPhat) {
            goBoSuKienKhoiDong();
            return;
        }

        const result = await tiepTucBaiDangMo('manual');
        if (result === true) {
            goBoSuKienKhoiDong();
        }
    }

    async function chuyenTrangThaiNhac(event) {
        event.preventDefault();
        _d('Button clicked! dangPhat=' + dangPhat + ' tracks=' + danhSachNhac.length);

        if (dangPhat) {
            tamDungNguonHienTai();
            return;
        }

        try {
            const result = await tiepTucBaiDangMo('manual');
            _d('Play result: ' + result);
            if (result === true) {
                goBoSuKienKhoiDong();
            }
        } catch (err) {
            _d('ERROR in play: ' + (err && err.message || err));
        }
    }

    async function taiCaiDatNhac() {
        _d('taiCaiDatNhac() called');
        if (!initElements()) return;
        _d('Banner Music: Initializing...');

        // Set a temporary default so the button works immediately
        danhSachNhac = [{
            title: 'Nhạc nền Banner',
            url: LINK_NHAC_MAC_DINH,
            type: 'audio'
        }];
        cheDoPhat = 'sequential';
        taoHangPhat();

        // Attach listeners immediately so the button is responsive
        nutNhac.addEventListener('click', chuyenTrangThaiNhac);
        _d('Click listener attached to button');

        nhacNen.addEventListener('play', () => {
            if (baiHienTai && baiHienTai.type === 'audio') {
                tamDungThuCong = false;
                capNhatTrangThaiNhac(true);
            }
        });

        nhacNen.addEventListener('pause', () => {
            if (dangChuyenBai || tamDungThuCong || !baiHienTai || baiHienTai.type !== 'audio') {
                return;
            }

            if (!nhacNen.ended && dangPhat) {
                capNhatTrangThaiNhac(false, `Nhạc đã tạm dừng: ${layTenBai()}.`);
            }
        });

        nhacNen.addEventListener('ended', () => {
            if (baiHienTai && baiHienTai.type === 'audio') {
                phatBaiTiepTheo('auto');
            }
        });

        nhacNen.addEventListener('error', () => {
            if (!baiHienTai || baiHienTai.type !== 'audio') {
                return;
            }

            lapLichChuyenBai(`Không tải được file nhạc: ${layTenBai()}. Đang chuyển bài khác...`);
        });

        try {
            const endpoint = new URL('/api/settings', document.baseURI);
            endpoint.searchParams.set(
                'keys',
                [
                    'banner_v2_music_playlist',
                    'banner_v2_music_order',
                    'default_profile_music_url',
                    'default_profile_music_title'
                ].join(',')
            );

            const response = await fetch(endpoint.toString(), {
                credentials: 'include',
                headers: window.api && typeof window.api.getHeaders === 'function'
                    ? window.api.getHeaders({ method: 'GET' })
                    : {
                        'X-App-Client': 'web',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
            });
            const payload = await response.json();
            const data = payload && payload.success ? (payload.data || {}) : {};

            danhSachNhac = caiDatDanhSachMacDinh(data);
            cheDoPhat = data.banner_v2_music_order === 'shuffle' ? 'shuffle' : 'sequential';
            _d('Settings loaded. Tracks: ' + danhSachNhac.length + ' order: ' + cheDoPhat);
        } catch (fetchErr) {
            _d('Settings fetch error: ' + (fetchErr && fetchErr.message || fetchErr));
            danhSachNhac = [{
                title: 'Nhạc nền Banner',
                url: LINK_NHAC_MAC_DINH,
                type: 'audio'
            }];
            cheDoPhat = 'sequential';
        }

        taoHangPhat();
        capNhatTrangThaiNhac(false);

        window.setTimeout(() => {
            batDauPhatTaiViTri(0, 'auto');
        }, 150);
    }

    suKienKhoiDong.forEach((tenSuKien) => {
        document.addEventListener(tenSuKien, batNhacTuongTacDau, true);
    });

    // Try to initialize immediately since script is at bottom of <body>
    // DOM elements should already exist at this point
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', taiCaiDatNhac, { once: true });
    } else {
        // readyState is 'interactive' or 'complete' - DOM is ready
        taiCaiDatNhac();
    }
})();
