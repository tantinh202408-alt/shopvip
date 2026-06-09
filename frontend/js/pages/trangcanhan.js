// ============================================
// TRANG CA NHAN PAGE
// File: frontend/js/pages/trangcanhan.js
// ============================================

window.pageInit = async function(params) {
    const profileId = params.id;
    const profileInfo = document.getElementById('profile-info');
    const profileSettings = document.getElementById('profile-settings');
    const postsTab = document.getElementById('tab-posts');
    const productsTab = document.getElementById('tab-products');
    const postsTabButton = document.querySelector('.profile-tabs .tab-btn[data-tab="posts"]');
    const productsTabButton = document.querySelector('.profile-tabs .tab-btn[data-tab="products"]');
    const currentUser = Auth.getCurrentUser();
    const isOwner = Auth.isAuthenticated() && currentUser && String(currentUser.id) === String(profileId);
    let settingsVisible = false;
    let frameList = [];
    let selectedFrame = '';
    let currentProfile = null;

    let defaultMusicUrl = '';
    let defaultMusicTitle = 'Nhạc mặc định';
    let cloudinaryPreset = 'audio_upload';

    await loadMusicSettings();
    await loadProfile();
    await loadPosts();
    await loadProducts();
    bindTabs();

    async function loadMusicSettings() {
        const keys = [
            'default_profile_music_url',
            'default_profile_music_title',
            'cloudinary_music_preset'
        ];
        try {
            const res = await api.get('/settings', { keys: keys.join(',') });
            if (res.success) {
                defaultMusicUrl = res.data.default_profile_music_url || '';
                defaultMusicTitle = res.data.default_profile_music_title || 'Nhạc mặc định';
                cloudinaryPreset = res.data.cloudinary_music_preset || cloudinaryPreset;
            }
        } catch (error) {
            // ignore settings load errors
        }
    }

    async function loadProfile() {
        try {
            const response = await api.get(`/users/${profileId}`);
            if (response.success) {
                const user = response.data;
                currentProfile = user;
                renderProfile(user);
                if (settingsVisible) {
                    renderSettings(user);
                } else if (profileSettings) {
                    profileSettings.innerHTML = '';
                }
            }
        } catch (error) {
            profileInfo.innerHTML = `
                <div class="section-card profile-empty-card">
                    <div class="profile-empty-icon"><i class="fas fa-user-xmark"></i></div>
                    <h3>Không thể tải profile</h3>
                    <p>Vui lòng thử lại sau hoặc kiểm tra lại đường dẩn trang ca nhan.</p>
                </div>
            `;
        }
    }

    async function loadPosts() {
        try {
            const response = await api.get('/posts', { user_id: profileId });
            if (response.success) {
                renderPosts(response.data.posts || []);
            }
        } catch (error) {
            postsTab.innerHTML = renderEmptyTabState({
                icon: 'fa-triangle-exclamation',
                title: 'Không thể tải bài đăng',
                description: 'Dữ liệu bài đăng tạm thời không khả dụng. Vui lòng thử lại sau.'
            });
        }
    }

    async function loadProducts() {
        try {
            const response = await api.get('/products', { seller_id: profileId, limit: 50 });
            if (response.success) {
                renderProducts(response.data.products || []);
            }
        } catch (error) {
            productsTab.innerHTML = renderEmptyTabState({
                icon: 'fa-triangle-exclamation',
                title: 'Không thê tải sản phẩm',
                description: 'Dữ liệu sản phẩm tạm thời không khả dụng. Vui lòng thư lại sau.'
            });
        }
    }

    function formatRoleLabel(role = '') {
        const value = String(role || '').trim().toLowerCase();
        if (value === 'admin') return 'Quản trị';
        if (value === 'seller') return 'Nguời bán';
        if (value === 'user') return 'Thành viên';
        return value || 'Thành viên';
    }

    function formatGenderLabel(gender = '') {
        const value = String(gender || '').trim().toLowerCase();
        if (value === 'female') return 'Nữ';
        if (value === 'other') return 'Khác';
        if (value === 'male') return 'Nam';
        return 'Chưa cập nhật';
    }

    function renderEmptyTabState(options = {}) {
        const icon = options.icon || 'fa-box-open';
        const title = options.title || 'Chưa có dữ liệu';
        const description = options.description || '';

        return `
            <div class="section-card profile-empty-card">
                <div class="profile-empty-icon"><i class="fas ${icon}"></i></div>
                <h3>${title}</h3>
                <p>${description}</p>
            </div>
        `;
    }

    function syncTabCounts(stats = {}) {
        const posts = Number(stats.posts || 0);
        const products = Number(stats.products || 0);

        if (postsTabButton) {
            postsTabButton.innerHTML = `Bài đăng <span class="tab-count">${posts}</span>`;
        }

        if (productsTabButton) {
            productsTabButton.innerHTML = `Sản phẩm <span class="tab-count">${products}</span>`;
        }
    }

    function renderPosts(items) {
        if (!items.length) {
            postsTab.innerHTML = renderEmptyTabState({
                icon: 'fa-newspaper',
                title: 'Chưa có bài đăng',
                description: 'Khi tài khoản nay đăng bài, nội dung sẽ hiện thị tại đây.'
            });
            return;
        }

        postsTab.innerHTML = items.map(post => `
            <div class="post-card">
                <div class="post-meta">${formatDate(post.created_at)}</div>
                <div class="post-content">${formatPlainTextHtml(post.content || '')}</div>
                ${renderMedia(post.media || [])}
            </div>
        `).join('');
    }

    function renderMedia(media) {
        if (!media.length) return '';
        return `
            <div class="media-grid">
                ${media.map(m => `
                    <div class="media-item">
                        ${m.media_type === 'video' ? `
                            <video controls src="${m.media_url}"></video>
                        ` : `
                            <img src="${m.media_url}" alt="media">
                        `}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderProducts(items) {
        if (!items.length) {
            productsTab.innerHTML = renderEmptyTabState({
                icon: 'fa-store',
                title: 'Chưa có sản phẩm',
                description: 'Danh sách sản phẩm sẽ xuất hiện tại đây khi người dùng bắt đầu đăng bán.'
            });
            return;
        }

        productsTab.innerHTML = `
            <div class="products-grid">
                ${items.map(product => `
                    <a class="product-card" href="/page2/${product.slug || product.id}" data-link>
                        <img src="${getProductImageUrl(product)}" onerror="${getProductImageErrorHandler()}" class="product-image" alt="${escapeHtml(product.title)}">
                        <div class="product-info">
                            <div class="product-title">${escapeHtml(product.title)}</div>
                            ${renderProductPrice(product)}
                        </div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    function getEffectiveProductPrice(product = {}) {
        const effectivePrice = Number(product.effective_price);
        if (Number.isFinite(effectivePrice)) {
            return effectivePrice;
        }
        return Number(product.price || 0);
    }

    function getOriginalProductPrice(product = {}) {
        const originalPrice = Number(product.original_price);
        if (Number.isFinite(originalPrice)) {
            return originalPrice;
        }
        return Number(product.price || 0);
    }

    function renderProductPrice(product = {}) {
        const effectivePrice = getEffectiveProductPrice(product);
        const originalPrice = getOriginalProductPrice(product);
        const salePercent = Number(product.sale_percent || 0);
        const hasSale = salePercent > 0 && effectivePrice < originalPrice;

        if (!hasSale) {
            return `<div class="product-price">${formatMoney(effectivePrice)}</div>`;
        }

        return `
            <div class="product-price product-price-row">
                <span class="product-price-current">${formatMoney(effectivePrice)}</span>
                <span class="product-price-old">${formatMoney(originalPrice)}</span>
                <span class="product-sale-badge">-${Math.round(salePercent)}%</span>
            </div>
        `;
    }

    function bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
    }

    function renderProfile(user) {
        const bio = user.bio ? escapeHtml(user.bio) : 'Chưa có mô tả';
        const contactItems = parseContactItems(user.contact_info || '');
        const contactButtons = buildContactButtons(contactItems);
        const contactFallback = `
            <div class="profile-empty-inline">
                <i class="fas fa-address-card"></i>
                <span>Chưa có thông tin liên hệ</span>
            </div>
        `;
        const stats = user.stats || { posts: 0, products: 0 };
        selectedFrame = user.frame_url || '';
        const isPriorityAdmin = (user.email || '').toLowerCase() === 'duongthithuyhangkupee@gmail.com' && user.role === 'admin';
        const hasCover = Boolean(user.cover_image);
        const coverStyle = hasCover ? `style="background-image: url('${user.cover_image}');"` : '';
        const contactOverview = renderContactOverview(user, contactItems);
        const contactContent = contactButtons
            ? `
                ${contactOverview}
                <div class="contact-buttons profile-contact-list">${contactButtons}</div>
            `
            : contactFallback;
        const musicBlock = renderMusicSection(user);
        const phoneText = user.phone ? user.phone : 'Chưa cập nhật';

        syncTabCounts(stats);

        profileInfo.innerHTML = `
            <div class="section-card profile-hero">
                <div class="profile-header profile-header-with-cover ${hasCover ? 'has-cover' : 'is-fallback'}" ${coverStyle}></div>

                <div class="profile-identity-strip profile-identity-strip-under-cover">
                    <div class="avatar-frame-wrap profile-identity-avatar">
                        ${renderAvatarWithFrame(user, 'xl', user.full_name || user.email || 'avatar', true)}
                    </div>

                    <div class="profile-identity-text">
                        <div class="profile-name-row">
                            <div class="profile-identity-main">
                                ${user.role === 'admin' ? '<div class="profile-rank-label profile-rank-admin">Quản trị viên</div>' : ''}
                                <h2 class="profile-name profile-name-dark">
                                    ${escapeHtml(user.full_name || user.email || '')}
                                    ${renderVerifiedBadge(user, 'verified-badge-profile')}
                                </h2>
                            </div>
                        </div>
                    </div>

                    <div class="profile-identity-actions">
                        ${isOwner ? `<button type="button" id="toggle-settings" class="btn-outline profile-identity-edit-btn">${settingsVisible ? 'Đóng cài đặt' : 'Chỉnh sửa hồ sơ'}</button>` : ''}
                    </div>
                </div>
            </div>

            <div class="profile-summary-strip">
                <div class="profile-stats profile-stats-standalone">
                    <div class="profile-stat">
                        <div class="profile-stat-label">Bài đăng</div>
                        <div class="profile-stat-value">${stats.posts}</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-label">Sản phẩm</div>
                        <div class="profile-stat-value">${stats.products}</div>
                    </div>
                </div>
            </div>

            <div class="profile-about-grid">
                <div class="section-card profile-section">
                    <div class="profile-section-head">
                        <div>
                        <div class="profile-section-kicker">Giới thiệu</div>
                            <h3>Thông tin cá nhân</h3>
                        </div>
                    </div>
                    <p class="profile-bio">${bio}</p>
                    <div class="profile-detail-grid">
                        <div class="profile-detail-item">
                            <span>Email</span>
                            <strong>${escapeHtml(user.email || '')}</strong>
                        </div>
                        <div class="profile-detail-item">
                            <span>Vai trò</span>
                            <strong>${formatRoleLabel(user.role)}</strong>
                        </div>
                        <div class="profile-detail-item">
                            <span>Giới tính</span>
                            <strong>${formatGenderLabel(user.gender)}</strong>
                        </div>
                        <div class="profile-detail-item">
                            <span>số điện thoại</span>
                            <strong>${phoneText}</strong>
                        </div>
                    </div>
                </div>
                <div class="section-card profile-section">
                    <div class="profile-section-head">
                        <div>
                            <div class="profile-section-kicker">Kết nối</div>
                            <h3>Liên hệ</h3>
                        </div>
                    </div>
                    <p class="profile-section-note">tổng hợp nhanh các kênh liên hệ và đường dẫn kết nối của tài khoản.</p>
                    ${contactContent}
                </div>
            </div>
            ${musicBlock}
        `;

        if (isOwner) {
            const toggleBtn = document.getElementById('toggle-settings');
            const musicEditBtn = document.getElementById('music-edit-btn');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    settingsVisible = !settingsVisible;
                    toggleBtn.textContent = settingsVisible ? 'Dong cai dat' : 'Chinh sua ho so';
                    if (settingsVisible) {
                        renderSettings(user);
                    } else if (profileSettings) {
                        profileSettings.innerHTML = '';
                    }
                });
            }
            if (musicEditBtn) {
                musicEditBtn.addEventListener('click', () => {
                    if (!settingsVisible) {
                        settingsVisible = true;
                        if (toggleBtn) toggleBtn.textContent = 'Dong cai dat';
                        renderSettings(currentProfile || user);
                    }
                    const musicForm = document.getElementById('music-form');
                    if (musicForm) {
                        musicForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
        }
    }

    function renderMusicSection(user) {
        const personalUrl = user.profile_music_url;
        const url = personalUrl || defaultMusicUrl;
        if (!url) return '';

        const title = user.profile_music_title ||
            (personalUrl ? 'Nhạc cá nhân' : (defaultMusicTitle || 'Nhạc mặc định'));
        const sourceLabel = personalUrl ? 'Nhạc do bạn chọn' : 'Nhạc mặc định từ admin';

        const isYoutube = /(?:youtu\.be\/|youtube\.com\/)/i.test(url);

        return `
            <div class="section-card profile-music profile-music-compact ${personalUrl ? 'is-personal' : 'is-default'}">
                <div class="profile-music-row">
                    <div class="profile-music-icon"><i class="fas fa-music"></i></div>
                    <div class="profile-music-text">
                        <div class="profile-music-title">${title}</div>
                        <div class="profile-music-note">${sourceLabel}</div>
                    </div>
                    <div class="profile-music-actions">
                        <span class="profile-music-pill">${personalUrl ? 'Cá nhân' : 'Mặc định'}</span>
                        ${isOwner ? `<button type="button" id="music-edit-btn" class="btn-ghost profile-music-edit">Chỉnh sửa</button>` : ''}
                    </div>
                </div>
                <div class="profile-music-audio" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md);">
                    <div class="profile-music-player-status" style="display: flex; align-items: center; gap: 10px;">
                        <div class="music-wave-animation paused" id="music-wave-indicator">
                            <span class="stroke"></span>
                            <span class="stroke"></span>
                            <span class="stroke"></span>
                            <span class="stroke"></span>
                            <span class="stroke"></span>
                        </div>
                        <span id="profile-music-status-text" style="font-weight: 600; font-size: 14px; color: var(--ink);">Đang tải nhạc...</span>
                    </div>
                    <div class="profile-music-controls-btn">
                        <button type="button" id="profile-music-global-toggle" class="btn-primary" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                            <i class="fas fa-play"></i> <span>Phát nhạc</span>
                        </button>
                    </div>
                    ${isYoutube ? `
                        <div id="profile-yt-player-shell" style="position:absolute; width:1px; height:1px; overflow:hidden; left:-1000px; top:-1000px; pointer-events:none;">
                            <div id="profile-yt-player"></div>
                        </div>
                    ` : `
                        <audio id="profile-audio-player" src="${url}" preload="auto" style="display:none;"></audio>
                    `}
                </div>
            </div>
        `;
    }

    function renderSettings(user) {
        if (!profileSettings) return;
        if (!isOwner) {
            profileSettings.innerHTML = '';
            return;
        }

        profileSettings.innerHTML = `
            <div class="profile-settings-grid">
                <div class="section-card profile-settings">
                    <h3>Cập nhật hồ sơ</h3>
                    <form id="profile-form">
                        <div class="form-group">
                            <label>Họ tên</label>
                            <input type="text" name="full_name" value="${user.full_name || ''}">
                        </div>
                        <div class="form-group">
                            <label>Giới tính</label>
                            <select name="gender">
                                <option value="male" ${user.gender === 'male' ? 'selected' : ''}>Nam</option>
                                <option value="female" ${user.gender === 'female' ? 'selected' : ''}>Nữ</option>
                                <option value="other" ${user.gender === 'other' ? 'selected' : ''}>Khác</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Số điện thoại</label>
                            <input type="text" name="phone" value="${user.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label>Mô tả</label>
                            <textarea name="bio" placeholder="Viết mô tả ngắn...">${user.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Thông tin liên hệ</label>
                            <textarea name="contact_info" placeholder="Mỗi dòng là 1 liên hệ. Ví dụ: Zalo | https://zalo.me/0123456789">${user.contact_info || ''}</textarea>
                            <small>Cú pháp hỗ trợ: <strong>Tên | link</strong> hoặc chỉ link/email/số điện thoại. Có thể thêm nhiều dòng.</small>
                        </div>
                        <div class="form-group">
                            <label>Ảnh nền (cover)</label>
                            <div class="file-picker">
                                <input type="file" name="cover" id="cover-input" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="cover-input" data-file-label="cover-input-label">Chọn ảnh</button>
                                <span id="cover-input-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <div id="cover-preview" class="upload-preview"></div>
                        </div>
                        <div class="form-group">
                            <label>Đổi avatar</label>
                            <div class="file-picker">
                                <input type="file" name="avatar" id="avatar-input" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="avatar-input" data-file-label="avatar-input-label">Chọn ảnh</button>
                                <span id="avatar-input-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <small>Chưa chọn ảnh sẽ dùng mặc định theo giới tính.</small>
                        </div>
                        <div class="form-group">
                            <div id="avatar-preview" class="upload-preview"></div>
                        </div>
                        <button type="submit" class="btn-primary">Lưu thay đổi</button>
                    </form>
                </div>

                <div class="section-card profile-settings">
                    <h3>Nhạc trang cá nhân</h3>
                    <p class="section-subtitle">Upload file hoặc dán link để phát nhạc trên trang cá nhân.</p>
                    <form id="music-form" class="form-grid form-grid-2">
                        <div class="form-group full">
                            <label>Link nhạc (YouTube / mp3 / mp4)</label>
                            <input type="text" name="music_url" value="${user.profile_music_url || ''}" placeholder="Dán link YouTube hoặc mp3 vào đây...">
                        </div>
                        <div class="form-group">
                            <label>Tên hiển thị</label>
                            <input type="text" name="music_title" value="${user.profile_music_title || ''}" placeholder="Nhạc của tôi">
                        </div>
                        <div class="form-group">
                            <label>Upload file (Cloudinary)</label>
                            <div class="file-picker">
                                <input type="file" id="music-file-input" class="file-input" accept="audio/*,video/mp4">
                                <button type="button" class="btn-outline file-btn" data-file-target="music-file-input" data-file-label="music-file-label">Chọn file</button>
                                <span id="music-file-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <small>File sẽ được tải qua Cloudinary (preset: ${cloudinaryPreset}).</small>
                        </div>
                        <div class="form-group full">
                            <div id="music-preview" class="upload-preview"></div>
                        </div>
                        <div class="form-group full music-actions">
                            <button type="submit" class="btn-primary">Lưu nhạc</button>
                            <button type="button" id="use-default-music" class="btn-outline">Dùng nhạc mặc định</button>
                            <button type="button" id="clear-music" class="btn-ghost btn-danger">Xóa nhạc</button>
                        </div>
                    </form>
                </div>

                <div class="section-card profile-settings">
                    <h3>Đổi mật khẩu</h3>
                    <form id="password-form">
                        <div class="form-group">
                            <label>Mật khẩu cũ</label>
                            <input type="password" name="old_password" required>
                        </div>
                        <div class="form-group">
                            <label>Mật khẩu mới</label>
                            <input type="password" name="new_password" required>
                        </div>
                        <div class="form-group">
                            <label>Xác nhận mật khẩu mới</label>
                            <input type="password" name="confirm_password" required>
                        </div>
                        <button type="submit" class="btn-primary">Đổi mật khẩu</button>
                    </form>
                </div>

                <div class="section-card profile-settings">
                    <h3>Chọn khung avatar</h3>
                    <div id="frame-grid" class="frame-grid"></div>
                    <div class="frame-actions">
                        <button type="button" id="save-frame" class="btn-primary">Lưu khung</button>
                        <button type="button" id="clear-frame" class="btn-outline">Bỏ khung</button>
                    </div>
                </div>
            </div>
        `;
        initFilePickers(profileSettings);

        const profileForm = document.getElementById('profile-form');
        const passwordForm = document.getElementById('password-form');
        const musicForm = document.getElementById('music-form');
        const musicFileInput = document.getElementById('music-file-input');
        const musicFileLabel = document.getElementById('music-file-label');
        const musicPreview = document.getElementById('music-preview');
        const useDefaultBtn = document.getElementById('use-default-music');
        const clearMusicBtn = document.getElementById('clear-music');
        let musicFile = null;

        if (profileForm) {
            const avatarPreview = document.getElementById('avatar-preview');
            const avatarInput = document.getElementById('avatar-input');
            const avatarLabel = document.getElementById('avatar-input-label');
            let avatarFile = null;
            const coverPreview = document.getElementById('cover-preview');
            const coverInput = document.getElementById('cover-input');
            const coverLabel = document.getElementById('cover-input-label');
            let coverFile = null;

            if (avatarInput) {
                avatarInput.addEventListener('change', () => {
                    avatarFile = avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null;
                    renderAvatarPreview();
                });
            }
            if (coverInput) {
                coverInput.addEventListener('change', () => {
                    coverFile = coverInput.files && coverInput.files[0] ? coverInput.files[0] : null;
                    renderCoverPreview();
                });
            }

            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const formData = new FormData(profileForm);
                    let avatarUrl = '';
                    let coverUrl = '';
                    if (avatarFile && avatarFile.name) {
                        if (!avatarFile.type.startsWith('image/')) {
                            showToast('Ảnh avatar phải là file ảnh', 'error');
                            return;
                        }

                        const fd = new FormData();
                        fd.append('file', avatarFile);
                        const bar = avatarPreview ? avatarPreview.querySelector('.upload-progress-bar') : null;
                        const text = avatarPreview ? avatarPreview.querySelector('.upload-progress-text') : null;
                        const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                            if (bar) bar.style.width = `${percent}%`;
                            if (text) text.textContent = `${percent}%`;
                        });
                        if (upload.success) {
                            avatarUrl = upload.data.url;
                        }
                    }

                    if (coverFile && coverFile.name) {
                        if (!coverFile.type.startsWith('image/')) {
                            showToast('Ảnh nền phải là file ảnh', 'error');
                            return;
                        }
                        const fd = new FormData();
                        fd.append('file', coverFile);
                        const bar = coverPreview ? coverPreview.querySelector('.upload-progress-bar') : null;
                        const text = coverPreview ? coverPreview.querySelector('.upload-progress-text') : null;
                        const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                            if (bar) bar.style.width = `${percent}%`;
                            if (text) text.textContent = `${percent}%`;
                        });
                        if (upload.success) {
                            coverUrl = upload.data.url;
                        }
                    }

                    const payload = {
                        full_name: formData.get('full_name'),
                        gender: formData.get('gender'),
                        phone: formData.get('phone'),
                        bio: formData.get('bio'),
                        contact_info: formData.get('contact_info')
                    };
                    if (avatarUrl) payload.avatar = avatarUrl;
                    if (coverUrl) payload.cover_image = coverUrl;

                    const res = await api.put('/auth/update-profile', payload);
                    if (res.success) {
                        showToast('Đã cập nhật hồ sơ', 'success');
                        Auth.updateUser(res.data);
                        renderProfile(res.data);
                        avatarFile = null;
                        coverFile = null;
                        if (avatarInput) avatarInput.value = '';
                        if (coverInput) coverInput.value = '';
                        setFileLabel(avatarInput, avatarLabel);
                        setFileLabel(coverInput, coverLabel);
                        renderAvatarPreview();
                        renderCoverPreview();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể cập nhật hồ sơ', 'error');
                }
            });

            function renderAvatarPreview() {
                if (!avatarPreview) return;
                if (!avatarFile) {
                    avatarPreview.innerHTML = '';
                    return;
                }

                const url = URL.createObjectURL(avatarFile);
                avatarPreview.innerHTML = `
                    <div class="upload-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="avatar preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;

                const btn = avatarPreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        avatarFile = null;
                        if (avatarInput) avatarInput.value = '';
                        setFileLabel(avatarInput, avatarLabel);
                        renderAvatarPreview();
                    });
                }
            }

            function renderCoverPreview() {
                if (!coverPreview) return;
                if (!coverFile) {
                    coverPreview.innerHTML = '';
                    return;
                }
                const url = URL.createObjectURL(coverFile);
                coverPreview.innerHTML = `
                    <div class="upload-preview-item cover-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="cover preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;
                const btn = coverPreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        coverFile = null;
                        if (coverInput) coverInput.value = '';
                        setFileLabel(coverInput, coverLabel);
                        renderCoverPreview();
                    });
                }
            }
        }

        if (musicFileInput) {
            musicFileInput.addEventListener('change', () => {
                musicFile = musicFileInput.files && musicFileInput.files[0] ? musicFileInput.files[0] : null;
                setFileLabel(musicFileInput, musicFileLabel);
                renderMusicPreview(musicFile);
            });
        }

        if (musicForm) {
            musicForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    let finalUrl = (musicForm.music_url.value || '').trim();
                    const title = (musicForm.music_title.value || '').trim();

                    if (musicFile) {
                        if (!isAudioFile(musicFile)) {
                            showToast('File nhạc không hợp lệ', 'error');
                            return;
                        }
                        const bar = musicPreview ? musicPreview.querySelector('.upload-progress-bar') : null;
                        const text = musicPreview ? musicPreview.querySelector('.upload-progress-text') : null;
                        const ring = musicPreview ? musicPreview.querySelector('.upload-ring-inner') : null;
                        const ringWrap = musicPreview ? musicPreview.querySelector('.upload-ring') : null;

                        const updateProgress = (percent) => {
                            if (bar) bar.style.width = `${percent}%`;
                            if (text) text.textContent = `${percent}%`;
                            if (ring) ring.style.setProperty('--progress', percent);
                            if (ring) ring.textContent = `${percent}%`;
                            if (ringWrap) ringWrap.style.display = percent >= 100 ? 'none' : 'flex';
                        };

                        const uploadResult = await uploadToCloudinary(musicFile, {
                            uploadPreset: cloudinaryPreset,
                            onProgress: updateProgress
                        });
                        finalUrl = uploadResult.url;
                    }

                    const payload = {
                        profile_music_url: finalUrl || null,
                        profile_music_title: title || null
                    };

                    const res = await api.put('/auth/update-profile', payload);
                    if (res.success) {
                        showToast('Đã lưu nhạc trang cá nhân', 'success');
                        musicFile = null;
                        if (musicFileInput) musicFileInput.value = '';
                        setFileLabel(musicFileInput, musicFileLabel);
                        renderMusicPreview(null, finalUrl || defaultMusicUrl);
                        Auth.updateUser(res.data);
                        renderProfile(res.data);
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể lưu nhạc', 'error');
                }
            });
        }

        if (useDefaultBtn) {
            useDefaultBtn.addEventListener('click', () => {
                if (musicForm) {
                    musicForm.music_url.value = defaultMusicUrl || '';
                    musicForm.music_title.value = defaultMusicTitle || 'Nhạc mặc định';
                }
                renderMusicPreview(null, defaultMusicUrl);
            });
        }

        if (clearMusicBtn) {
            clearMusicBtn.addEventListener('click', () => {
                if (musicForm) {
                    musicForm.music_url.value = '';
                    musicForm.music_title.value = '';
                }
                musicFile = null;
                if (musicFileInput) musicFileInput.value = '';
                setFileLabel(musicFileInput, musicFileLabel);
                renderMusicPreview(null);
            });
        }

        function renderMusicPreview(file, urlOverride = '') {
            if (!musicPreview) return;
            const currentUrl = urlOverride || (musicForm ? musicForm.music_url.value.trim() : '');
            const previewUrl = file ? URL.createObjectURL(file) : currentUrl;

            if (!previewUrl) {
                musicPreview.innerHTML = '<p class="upload-empty">Chưa có nhạc.</p>';
                return;
            }

            musicPreview.innerHTML = `
                <div class="upload-preview-item audio-preview">
                    <audio controls src="${previewUrl}" preload="metadata"></audio>
                    <div class="upload-ring" style="${file ? '' : 'display:none;'}">
                        <div class="upload-ring-inner" style="--progress:0;">0%</div>
                    </div>
                    <div class="upload-progress">
                        <div class="upload-progress-bar"></div>
                    </div>
                    <div class="upload-progress-text">0%</div>
                </div>
            `;
        }

        renderMusicPreview(null, user.profile_music_url || defaultMusicUrl || '');
        initSingleAudio();

        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const oldPassword = passwordForm.old_password.value.trim();
                const newPassword = passwordForm.new_password.value.trim();
                const confirmPassword = passwordForm.confirm_password.value.trim();

                if (newPassword !== confirmPassword) {
                    showToast('Mật khẩu xác nhận không khớp', 'error');
                    return;
                }

                try {
                    const res = await api.put('/auth/change-password', {
                        old_password: oldPassword,
                        new_password: newPassword
                    });
                    if (res.success) {
                        showToast('Đổi mật khẩu thành công', 'success');
                        passwordForm.reset();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể đổi mật khẩu', 'error');
                }
            });
        }

        // Frame picker
        const saveFrameBtn = document.getElementById('save-frame');
        const clearFrameBtn = document.getElementById('clear-frame');

        async function loadFrames() {
            try {
                const res = await api.get('/users/frames/list');
                if (res.success) {
                    frameList = res.data || [];
                    renderFramePicker();
                }
            } catch (_) {
                // ignore
            }
        }

        function renderFramePicker() {
            const grid = document.getElementById('frame-grid');
            if (!grid) return;
            if (!frameList.length) {
                grid.innerHTML = '<p class="chart-empty">Chưa có khung.</p>';
                return;
            }
            grid.innerHTML = frameList.map(f => `
                <button type="button" class="frame-item ${selectedFrame === f.url ? 'active' : ''}" data-frame="${f.url}">
                    <img src="${f.url}" alt="${f.name}">
                </button>
            `).join('');
            grid.querySelectorAll('.frame-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedFrame = btn.dataset.frame || '';
                    renderFramePicker();
                });
            });
        }

        if (saveFrameBtn) {
            saveFrameBtn.addEventListener('click', async () => {
                try {
                    const res = await api.put('/users/me/frame', { frame_url: selectedFrame });
                    if (res.success) {
                        showToast('Đã lưu khung avatar', 'success');
                        Auth.updateUser(res.data);
                        renderProfile(res.data);
                        renderFramePicker();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể lưu khung', 'error');
                }
            });
        }

        if (clearFrameBtn) {
            clearFrameBtn.addEventListener('click', () => {
                selectedFrame = '';
                renderFramePicker();
            });
        }

        loadFrames();
    }

    function parseContactItems(contactInfo) {
        return String(contactInfo || '')
            .split(/\r?\n|,/)
            .map(item => item.trim())
            .filter(Boolean)
            .map(raw => normalizeContactItem(raw))
            .filter(Boolean);
    }

    function buildContactButtons(contactItems = []) {
        if (!contactItems.length) return '';

        const buttons = contactItems
            .map(item => `
                <a class="btn-outline contact-button" href="${item.href}" target="_blank" rel="noopener noreferrer">
                    ${item.label}
                </a>
            `)
            .join('');

        if (!buttons) return '';

        return `<div class="contact-buttons">${buttons}</div>`;
    }

    function formatContactDisplay(item = {}) {
        const href = String(item.href || '');
        if (!href) return '';

        if (href.startsWith('mailto:')) {
            return href.replace(/^mailto:/i, '');
        }

        if (href.startsWith('tel:')) {
            return href.replace(/^tel:/i, '');
        }

        try {
            const url = new URL(href);
            return `${url.hostname.replace(/^www\./i, '')}${url.pathname && url.pathname !== '/' ? url.pathname : ''}`;
        } catch (_) {
            return href;
        }
    }

    function renderContactOverview(user, contactItems = []) {
        const cards = [];

        contactItems.slice(0, 3).forEach((item) => {
            cards.push({
                label: item.label || 'Kênh liên hệ',
                value: formatContactDisplay(item) || item.label || 'Đang cập nhật',
                icon: item.href.startsWith('tel:') ? 'fa-phone' : item.href.startsWith('mailto:') ? 'fa-envelope' : 'fa-link'
            });
        });

        if (!cards.length && user.email) {
            cards.push({
                label: 'Email',
                value: user.email,
                icon: 'fa-envelope'
            });
        }

        if (cards.length < 2 && user.phone) {
            cards.push({
                label: 'So dien thoai',
                value: user.phone,
                icon: 'fa-phone'
            });
        }

        cards.push({
            label: 'So kenh da khai bao',
            value: String(contactItems.length || (user.email ? 1 : 0) + (user.phone ? 1 : 0)),
            icon: 'fa-address-book'
        });

        return `
            <div class="profile-contact-grid">
                ${cards.slice(0, 3).map(card => `
                    <div class="profile-contact-card">
                        <div class="profile-contact-card-label">
                            <i class="fas ${card.icon}"></i>
                            <span>${card.label}</span>
                        </div>
                        <div class="profile-contact-card-value">${card.value}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function normalizeContactItem(raw) {
        let label = raw;
        let value = raw;

        if (raw.includes('|')) {
            const parts = raw.split('|');
            label = (parts[0] || '').trim();
            value = parts.slice(1).join('|').trim();
        } else if (raw.includes(':')) {
            const idx = raw.indexOf(':');
            const left = raw.slice(0, idx).trim();
            const right = raw.slice(idx + 1).trim();
            if (looksLikeContactValue(right)) {
                label = left;
                value = right;
            }
        }

        if (!value) return null;

        const normalized = normalizeContactHref(value);
        if (!normalized) return null;

        const finalLabel = label && label !== value ? label : deriveContactLabel(normalized);
        return {
            label: finalLabel,
            href: normalized
        };
    }

    function looksLikeContactValue(value) {
        return /^(https?:\/\/|www\.)/i.test(value) ||
            /@/.test(value) ||
            /^[+()\d\s-]{6,}$/.test(value) ||
            /\.[a-z]{2,}/i.test(value);
    }

    function normalizeContactHref(value) {
        const trimmed = value.trim();
        if (!trimmed) return '';

        if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
            return trimmed;
        }

        if (/@/.test(trimmed) && !/\s/.test(trimmed)) {
            return `mailto:${trimmed}`;
        }

        const digits = trimmed.replace(/[^\d+]/g, '');
        if (/^[+]?[\d]{6,}$/.test(digits)) {
            return `tel:${digits}`;
        }

        if (/^www\./i.test(trimmed)) {
            return `https://${trimmed}`;
        }

        if (/\.[a-z]{2,}/i.test(trimmed)) {
            return `https://${trimmed}`;
        }

        return '';
    }

    function deriveContactLabel(href) {
        if (href.startsWith('mailto:')) {
            return href.replace('mailto:', '');
        }
        if (href.startsWith('tel:')) {
            return href.replace('tel:', '');
        }
        try {
            const url = new URL(href);
            return url.hostname.replace(/^www\./, '');
        } catch (error) {
            return href;
        }
    }

    // Only allow one audio playing at a time
    function initSingleAudio() {
        const toggleBtn = document.getElementById('profile-music-global-toggle');
        const statusText = document.getElementById('profile-music-status-text');
        const waveIndicator = document.getElementById('music-wave-indicator');

        if (!toggleBtn) return;

        const player = document.getElementById('profile-audio-player');
        const isYoutube = !player; // If there is no HTML5 audio player, it's YouTube
        
        let ytPlayer = null;
        let isPlaying = false;

        function updatePlayerUI(playing) {
            isPlaying = playing;
            if (playing) {
                toggleBtn.className = 'btn-outline';
                toggleBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                toggleBtn.style.color = '#ef4444';
                toggleBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                toggleBtn.innerHTML = '<i class="fas fa-pause"></i> <span>Tắt nhạc</span>';
                if (statusText) statusText.textContent = 'Đang phát nhạc';
                if (waveIndicator) waveIndicator.classList.remove('paused');
            } else {
                toggleBtn.className = 'btn-primary';
                toggleBtn.style.background = '';
                toggleBtn.style.color = '';
                toggleBtn.style.borderColor = '';
                toggleBtn.innerHTML = '<i class="fas fa-play"></i> <span>Phát nhạc</span>';
                if (statusText) statusText.textContent = 'Đang tạm dừng';
                if (waveIndicator) waveIndicator.classList.add('paused');
            }
        }

        if (player) {
            player.addEventListener('play', () => {
                document.querySelectorAll('audio').forEach(el => {
                    if (el !== player) el.pause();
                });
                updatePlayerUI(true);
            });

            player.addEventListener('pause', () => {
                updatePlayerUI(false);
            });

            player.addEventListener('ended', () => {
                updatePlayerUI(false);
            });

            toggleBtn.addEventListener('click', () => {
                if (player.paused) {
                    player.play().catch(err => {
                        console.error('Playback failed:', err);
                    });
                } else {
                    player.pause();
                }
            });

            const startAutoplay = () => {
                if (statusText) statusText.textContent = 'Đang phát nhạc';
                player.play().then(() => {
                    updatePlayerUI(true);
                }).catch(err => {
                    console.log('Autoplay blocked by browser. Waiting for user interaction...', err);
                    updatePlayerUI(false);
                    if (statusText) statusText.textContent = 'Click bất kỳ để phát nhạc';
                    
                    const playOnInteraction = () => {
                        player.play().then(() => {
                            updatePlayerUI(true);
                            document.removeEventListener('click', playOnInteraction);
                            document.removeEventListener('keydown', playOnInteraction);
                        }).catch(e => {
                            console.error('Interaction play failed:', e);
                        });
                    };
                    document.addEventListener('click', playOnInteraction);
                    document.addEventListener('keydown', playOnInteraction);
                });
            };

            if (player.readyState >= 2) {
                startAutoplay();
            } else {
                player.addEventListener('canplay', startAutoplay, { once: true });
            }
        }

        if (isYoutube) {
            const handleYoutubePlay = async () => {
                if (!ytPlayer) {
                    if (statusText) statusText.textContent = 'Đang tải YouTube...';
                    toggleBtn.disabled = true;
                    try {
                        ytPlayer = await loadYoutubePlayer();
                        isPlaying = true;
                        updatePlayerUI(true);
                    } catch (err) {
                        console.error('Error loading YouTube:', err);
                        if (statusText) statusText.textContent = 'Lỗi tải nhạc YouTube';
                        updatePlayerUI(false);
                    } finally {
                        toggleBtn.disabled = false;
                    }
                } else {
                    ytPlayer.playVideo();
                    updatePlayerUI(true);
                }
            };

            const handleYoutubePause = () => {
                if (ytPlayer) {
                    ytPlayer.pauseVideo();
                    updatePlayerUI(false);
                }
            };

            toggleBtn.addEventListener('click', () => {
                if (isPlaying) {
                    handleYoutubePause();
                } else {
                    handleYoutubePlay();
                }
            });

            // Autoplay YouTube on page load
            setTimeout(async () => {
                try {
                    ytPlayer = await loadYoutubePlayer();
                    isPlaying = true;
                    updatePlayerUI(true);
                    
                    if (ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
                        setTimeout(() => {
                            const state = ytPlayer.getPlayerState();
                            if (state !== 1 && state !== 3) {
                                console.log('YouTube autoplay blocked or waiting.');
                                updatePlayerUI(false);
                                if (statusText) statusText.textContent = 'Click nút để phát nhạc';
                            }
                        }, 1500);
                    }
                } catch (err) {
                    console.log('YouTube autoplay initiation blocked or deferred.', err);
                    updatePlayerUI(false);
                    if (statusText) statusText.textContent = 'Click nút để phát nhạc';
                }
            }, 500);
        }
    }

    async function loadYoutubePlayer() {
        const url = (currentProfile && currentProfile.profile_music_url) || defaultMusicUrl;
        const videoId = extractYoutubeId(url);
        if (!videoId) throw new Error('Invalid YouTube ID');

        return new Promise((resolve, reject) => {
            const initPlayer = () => {
                new YT.Player('profile-yt-player', {
                    height: '1',
                    width: '1',
                    videoId: videoId,
                    playerVars: {
                        autoplay: 1,
                        playsinline: 1,
                        controls: 0,
                        modestbranding: 1
                    },
                    events: {
                        onReady: (event) => resolve(event.target),
                        onError: (err) => reject(err)
                    }
                });
            };

            if (window.YT && window.YT.Player) {
                initPlayer();
            } else {
                let tag = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
                if (!tag) {
                    tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    const firstScriptTag = document.getElementsByTagName('script')[0];
                    if (firstScriptTag && firstScriptTag.parentNode) {
                        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                    } else {
                        document.head.appendChild(tag);
                    }
                }
                const previousCallback = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = () => {
                    if (typeof previousCallback === 'function') previousCallback();
                    initPlayer();
                };
            }
        });
    }

    function extractYoutubeId(url = '') {
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|u\/\w\/|embed\/|watch\?v=|shorts\/|live\/))([^#&?]*)/);
        return (match && match[1] && match[1].length === 11) ? match[1] : null;
    }
};
