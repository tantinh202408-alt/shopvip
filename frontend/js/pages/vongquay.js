window.pageInit = async function(params, query = {}) {
    const titleEl = document.getElementById('spin-title');
    const subtitleEl = document.getElementById('spin-subtitle');
    const statusBadgeEl = document.getElementById('spin-status-badge');
    const cooldownBadgeEl = document.getElementById('spin-cooldown-badge');
    const eventDateEl = document.getElementById('spin-event-date');
    const eventNoteEl = document.getElementById('spin-event-note');
    const stageNoteEl = document.getElementById('spin-stage-note');
    const wheelEl = document.getElementById('spin-wheel');
    const centerLabelEl = document.getElementById('spin-wheel-center-label');
    const centerNoteEl = document.getElementById('spin-wheel-center-note');
    const playBtn = document.getElementById('spin-play-btn');
    const helpTextEl = document.getElementById('spin-help-text');
    const rewardListEl = document.getElementById('spin-reward-list');
    const historyEl = document.getElementById('spin-history');
    const bonusLinkBtn = document.getElementById('spin-bonus-link-btn');
    const bonusLinkResultEl = document.getElementById('spin-bonus-link-result');
    const bonusCodeInput = document.getElementById('spin-bonus-code-input');
    const bonusPlayBtn = document.getElementById('spin-bonus-play-btn');
    const bonusRevealEl = document.getElementById('spin-bonus-reveal');
    const bonusHelpEl = document.getElementById('spin-bonus-help');

    let state = null;
    let countdownTimer = null;
    let currentRotation = 0;
    let isSpinning = false;

    const LEGACY_TITLE_VALUES = ['Vong quay may man'];
    const LEGACY_SUBTITLE_VALUES = ['He thong mo 1 ngay trong tuan va xu ly ket qua tai server.'];

    window.pageCleanup = () => {
        if (countdownTimer) clearInterval(countdownTimer);
    };

    if (playBtn) {
        playBtn.addEventListener('click', async () => {
            if (!state || isSpinning) return;

            if (!state.enabled) {
                showToast('Tính năng vòng quay đang tạm tắt', 'warning');
                return;
            }

            if (!state.canPlay) {
                syncCountdown();
                showToast(buildUnavailableMessage(), 'warning');
                return;
            }

            await submitSpin({});
        });
    }

    if (bonusLinkBtn) {
        bonusLinkBtn.addEventListener('click', async () => {
            if (isSpinning) return;

            bonusLinkBtn.disabled = true;
            bonusLinkBtn.textContent = 'Đang tạo link...';

            try {
                const response = await api.post('/wallet/lucky-spin/free-link', {});
                if (!response.success) {
                    throw new Error(response.message || 'Không tạo được link nhận mã');
                }

                renderBonusLinkResult(response.data || {});
                if (response.data?.code && bonusCodeInput) {
                    bonusCodeInput.value = response.data.code;
                }

                showToast(
                    response.data?.reused
                        ? 'Đã mở lại mã quay miễn phí chưa dùng'
                        : 'Đã tạo link nhận mã quay miễn phí',
                    'success'
                );
            } catch (error) {
                showToast(error.message || 'Không tạo được link nhận mã', 'error');
            } finally {
                bonusLinkBtn.disabled = false;
                bonusLinkBtn.textContent = 'Lấy link nhận mã';
            }
        });
    }

    if (bonusPlayBtn) {
        bonusPlayBtn.addEventListener('click', async () => {
            if (isSpinning) return;

            const code = String(bonusCodeInput?.value || '').trim();
            if (!code) {
                showToast('Vui lòng nhập mã quay miễn phí', 'warning');
                return;
            }

            await submitSpin({ bonusCode: code });
        });
    }

    if (bonusCodeInput) {
        bonusCodeInput.addEventListener('input', syncBonusControls);
    }

    await loadState();
    await maybeRevealBonusCodeFromQuery(query.spin_bonus_token || '');

    async function loadState() {
        try {
            const response = await api.get('/wallet/lucky-spin', { forceRefresh: true });
            if (!response.success) {
                throw new Error(response.message || 'Không thể tải vòng quay');
            }

            state = response.data || {};
            renderState();
        } catch (error) {
            renderError(error.message || 'Không thể tải vòng quay');
        }
    }

    async function maybeRevealBonusCodeFromQuery(token = '') {
        const normalizedToken = String(token || '').trim();
        if (!normalizedToken) {
            return;
        }

        try {
            const response = await api.post('/wallet/lucky-spin/free-link/reveal', {
                token: normalizedToken
            });
            if (!response.success) {
                throw new Error(response.message || 'Không nhận được mã quay miễn phí');
            }

            const bonusCode = response.data || {};
            revealBonusCode(bonusCode);
            showToast('Đã nhận mã quay miễn phí. Dán mã vào ô bên dưới để quay.', 'success');
            clearBonusTokenFromUrl();
            await loadState();
        } catch (error) {
            showToast(error.message || 'Không nhận được mã quay miễn phí', 'error');
            clearBonusTokenFromUrl();
        }
    }

    async function submitSpin(payload = {}) {
        isSpinning = true;
        syncPrimaryButtonLoading(true, payload.bonusCode ? 'Đang quay bằng mã...' : 'Đang quay...');
        syncBonusControls();

        if (centerLabelEl) centerLabelEl.textContent = 'Đang xử lý';
        if (centerNoteEl) {
            centerNoteEl.textContent = payload.bonusCode
                ? 'Đang xác thực mã quay miễn phí trên server.'
                : 'Server đang trả kết quả.';
        }

        try {
            const response = await api.post('/wallet/lucky-spin/play', payload);
            if (!response.success) {
                throw new Error(response.message || 'Không thể quay lúc này');
            }

            const result = response.data || {};
            const reward = result.reward || {};
            await animateToReward(reward, (result.state && result.state.rewards) || state?.rewards || []);
            updateLocalBalance(result.balance);
            state = result.state || state;

            if (payload.bonusCode && bonusCodeInput) {
                bonusCodeInput.value = '';
            }

            renderState();
            showToast(
                reward.amount > 0
                    ? `Bạn vừa nhận ${formatMoney(reward.amount)}`
                    : (reward.label || 'Chúc bạn may mắn lần sau'),
                reward.amount > 0 ? 'success' : 'info'
            );
        } catch (error) {
            if (error?.data?.nextSpinAt) {
                state = {
                    ...(state || {}),
                    nextSpinAt: error.data.nextSpinAt
                };
            }
            syncCountdown();
            showToast(error.message || 'Không thể quay lúc này', 'error');
        } finally {
            isSpinning = false;
            syncPrimaryButtonLoading(false);
            renderState();
        }
    }

    function renderState() {
        if (!state) return;

        if (titleEl) {
            titleEl.textContent = normalizeKnownText(state.title, 'Vòng quay may mắn', LEGACY_TITLE_VALUES);
        }
        if (subtitleEl) {
            subtitleEl.textContent = normalizeKnownText(
                state.subtitle,
                'Hệ thống mở 1 ngày trong tuần và xử lý kết quả hoàn toàn ở phía server.',
                LEGACY_SUBTITLE_VALUES
            );
        }
        if (stageNoteEl) {
            stageNoteEl.textContent = 'Bánh quay chỉ hiển thị màu. Bảng bên cạnh cho biết màu nào tương ứng với phần thưởng nào.';
        }

        renderWheel(Array.isArray(state.rewards) ? state.rewards : []);
        renderRewardList(Array.isArray(state.rewards) ? state.rewards : []);
        renderHistory(Array.isArray(state.history) ? state.history : []);
        hydrateActiveBonusCode();
        syncCountdown();
        syncBonusControls();
    }

    function renderWheel(rewards) {
        if (!wheelEl) return;

        if (!rewards.length) {
            wheelEl.innerHTML = '<div class="reward-empty">Chưa có phần thưởng.</div>';
            wheelEl.style.background = 'linear-gradient(135deg, #e2e8f0, #cbd5e1)';
            return;
        }

        const segmentDeg = 360 / rewards.length;
        const gradient = rewards
            .map((reward, index) => {
                const start = index * segmentDeg;
                const end = start + segmentDeg;
                return `${reward.color || '#0ea5e9'} ${start}deg ${end}deg`;
            })
            .join(', ');

        wheelEl.style.background = `conic-gradient(${gradient})`;
        wheelEl.innerHTML = '';
    }

    function renderRewardList(rewards) {
        if (!rewardListEl) return;

        if (!rewards.length) {
            rewardListEl.innerHTML = '<div class="reward-empty">Admin chưa cấu hình phần thưởng.</div>';
            return;
        }

        rewardListEl.innerHTML = rewards.map((reward, index) => `
            <div class="reward-item spin-legend-item">
                <div class="reward-item-main">
                    <span class="reward-color-dot" style="--reward-color:${escapeHtml(reward.color || '#0ea5e9')}"></span>
                    <div>
                        <strong>${escapeHtml(reward.label || `Phần thưởng ${index + 1}`)}</strong>
                    </div>
                </div>
                <div class="reward-item-amount">${formatMoney(Number(reward.amount || 0))}</div>
            </div>
        `).join('');
    }

    function renderHistory(items) {
        if (!historyEl) return;

        if (!items.length) {
            historyEl.innerHTML = '<div class="reward-empty">Bạn chưa quay lần nào.</div>';
            return;
        }

        historyEl.innerHTML = items.map((item) => `
            <div class="reward-history-item">
                <div>
                    <strong>${escapeHtml(item.rewardLabel || 'Phần thưởng')}</strong>
                    <div class="reward-history-meta">
                        ${item.spinSource === 'bonus_code' ? 'Quay bằng mã miễn phí' : 'Vòng quay sự kiện'}
                        · ${formatDateShort(item.createdAt)}
                    </div>
                </div>
                <div class="reward-history-amount ${Number(item.rewardAmount || 0) > 0 ? 'is-positive' : ''}">
                    ${formatMoney(Number(item.rewardAmount || 0))}
                </div>
            </div>
        `).join('');
    }

    function hydrateActiveBonusCode() {
        const activeBonusCode = state?.activeBonusCode || null;

        if (activeBonusCode?.revealedAt && activeBonusCode.code && bonusCodeInput && !bonusCodeInput.value.trim()) {
            bonusCodeInput.value = activeBonusCode.code;
        }

        if (!activeBonusCode) {
            if (bonusHelpEl) {
                bonusHelpEl.textContent = 'Mỗi mã chỉ dùng 1 lần và không tiêu hao lượt quay của ngày sự kiện.';
            }
            return;
        }

        renderBonusLinkResult({
            shortUrl: activeBonusCode.shortUrl,
            expiresAt: activeBonusCode.expiresAt,
            code: activeBonusCode.code || '',
            revealed: !!activeBonusCode.revealedAt,
            reused: true
        });
    }

    function syncCountdown() {
        if (!statusBadgeEl || !cooldownBadgeEl || !playBtn || !helpTextEl) return;

        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }

        const applyState = () => {
            const remainingMs = getRemainingMs(state?.nextSpinAt);
            const eventLabel = formatEventLabel(state?.event) || formatEventLabel(state?.activeEvent) || 'Đang cập nhật';
            const nextEventLabel = formatEventLabel(state?.nextEvent) || formatNextSpinAt(state?.nextSpinAt);

            if (eventDateEl) {
                eventDateEl.textContent = eventLabel;
            }

            if (!state?.enabled) {
                statusBadgeEl.className = 'badge badge-warning';
                statusBadgeEl.textContent = 'Tạm tắt';
                cooldownBadgeEl.className = 'badge badge-secondary';
                cooldownBadgeEl.textContent = eventLabel;
                if (eventNoteEl) eventNoteEl.textContent = 'Admin đang tắt mini game. Lịch sự kiện vẫn được giữ để theo dõi.';
                helpTextEl.textContent = 'Mini game đang tạm khóa trong phần quản trị.';
                playBtn.disabled = true;
                if (!isSpinning && centerLabelEl) centerLabelEl.textContent = 'Tạm tắt';
                if (!isSpinning && centerNoteEl) centerNoteEl.textContent = 'Chờ admin mở lại mini game.';
                return;
            }

            if (state?.canPlay && state?.activeEvent) {
                statusBadgeEl.className = 'badge badge-success';
                statusBadgeEl.textContent = 'Đang mở';
                cooldownBadgeEl.className = 'badge badge-info';
                cooldownBadgeEl.textContent = formatEventLabel(state.activeEvent) || 'Sự kiện hôm nay';
                if (eventNoteEl) eventNoteEl.textContent = 'Sự kiện đang mở hôm nay. Mỗi tài khoản có 1 lượt quay.';
                helpTextEl.textContent = 'Quay ngay để nhận kết quả từ server.';
                playBtn.disabled = !!isSpinning;
                if (!isSpinning && centerLabelEl) centerLabelEl.textContent = 'Quay ngay';
                if (!isSpinning && centerNoteEl) centerNoteEl.textContent = '1 lượt mỗi tài khoản trong ngày sự kiện.';
                return;
            }

            if (state?.activeEvent && state?.hasPlayedCurrentEvent) {
                statusBadgeEl.className = 'badge badge-info';
                statusBadgeEl.textContent = 'Đã quay';
                cooldownBadgeEl.className = 'badge badge-secondary';
                cooldownBadgeEl.textContent = nextEventLabel || 'Chờ đợt tiếp theo';
                if (eventNoteEl) {
                    eventNoteEl.textContent = nextEventLabel
                        ? `Bạn đã dùng lượt quay tuần này. Đợt tiếp theo: ${nextEventLabel}.`
                        : 'Bạn đã dùng lượt quay tuần này.';
                }
                helpTextEl.textContent = remainingMs > 0
                    ? `Sự kiện tiếp theo sau ${formatDuration(remainingMs)}.`
                    : 'Bạn đã dùng lượt quay của sự kiện hiện tại.';
                playBtn.disabled = true;
                if (!isSpinning && centerLabelEl) centerLabelEl.textContent = 'Đã quay';
                if (!isSpinning && centerNoteEl) {
                    centerNoteEl.textContent = nextEventLabel
                        ? `Hẹn bạn vào ${nextEventLabel}.`
                        : 'Hẹn bạn ở sự kiện tuần sau.';
                }
                return;
            }

            statusBadgeEl.className = 'badge badge-warning';
            statusBadgeEl.textContent = 'Sắp mở';
            cooldownBadgeEl.className = 'badge badge-secondary';
            cooldownBadgeEl.textContent = remainingMs > 0 ? `Còn ${formatDuration(remainingMs)}` : eventLabel;
            if (eventNoteEl) {
                if (state?.event?.distanceDays === 1) {
                    eventNoteEl.textContent = state?.event?.announcementSentAt
                        ? 'Sự kiện sẽ mở vào ngày mai. Thông báo toàn server đã được gửi.'
                        : 'Sự kiện sẽ mở vào ngày mai. Hệ thống sẽ thông báo toàn server trước khi mở.';
                } else if (state?.event?.distanceDays > 1) {
                    eventNoteEl.textContent = `Vòng quay sẽ mở vào ${eventLabel}.`;
                } else {
                    eventNoteEl.textContent = 'Hệ thống đang cập nhật lịch sự kiện.';
                }
            }
            helpTextEl.textContent = remainingMs > 0
                ? `Vòng quay sẽ mở sau ${formatDuration(remainingMs)}.`
                : 'Đang chờ lịch sự kiện tuần hiện tại.';
            playBtn.disabled = true;
            if (!isSpinning && centerLabelEl) {
                centerLabelEl.textContent = state?.event?.distanceDays === 1 ? 'Mai mở' : 'Chờ lịch';
            }
            if (!isSpinning && centerNoteEl) {
                centerNoteEl.textContent = eventLabel;
            }
        };

        applyState();
        if (state?.enabled && !state?.canPlay && getRemainingMs(state?.nextSpinAt) > 0) {
            countdownTimer = setInterval(applyState, 1000);
        }
    }

    function syncPrimaryButtonLoading(isLoading, loadingText = 'Đang quay...') {
        if (!playBtn) return;
        playBtn.textContent = isLoading ? loadingText : 'Quay ngay';
    }

    function syncBonusControls() {
        if (!bonusPlayBtn || !bonusCodeInput) return;

        const hasCode = !!String(bonusCodeInput.value || '').trim();
        bonusPlayBtn.disabled = isSpinning || !hasCode || !state?.enabled;
        bonusCodeInput.disabled = isSpinning || !state?.enabled;

        if (bonusHelpEl && state?.enabled) {
            bonusHelpEl.textContent = hasCode
                ? 'Mã quay miễn phí cho phép quay ngay, không cần chờ đến lịch sự kiện.'
                : 'Mỗi mã chỉ dùng 1 lần và không tiêu hao lượt quay của ngày sự kiện.';
        }
    }

    function renderBonusLinkResult(payload = {}) {
        if (!bonusLinkResultEl) return;

        const shortUrl = String(payload.shortUrl || '').trim();
        const code = String(payload.code || '').trim();
        const expiresAt = payload.expiresAt ? formatDateShort(payload.expiresAt) : '';

        if (!shortUrl && !code) {
            bonusLinkResultEl.innerHTML = '';
            return;
        }

        bonusLinkResultEl.innerHTML = `
            <div class="spin-bonus-result-card">
                ${shortUrl ? `
                    <a href="${escapeHtml(shortUrl)}" target="_blank" rel="noopener noreferrer" class="spin-bonus-link-anchor">
                        Mở link nhận mã
                    </a>
                ` : ''}
                ${expiresAt ? `<div class="spin-bonus-result-meta">Hiệu lực đến ${escapeHtml(expiresAt)}</div>` : ''}
                ${code ? `<div class="spin-bonus-result-code">Mã hiện tại: <strong>${escapeHtml(code)}</strong></div>` : ''}
            </div>
        `;
    }

    function revealBonusCode(payload = {}) {
        if (bonusCodeInput && payload.code) {
            bonusCodeInput.value = payload.code;
        }

        if (bonusRevealEl) {
            bonusRevealEl.hidden = false;
            bonusRevealEl.innerHTML = `
                <div class="spin-bonus-reveal-card">
                    <span class="spin-bonus-reveal-label">Mã quay miễn phí của bạn</span>
                    <strong>${escapeHtml(payload.code || '')}</strong>
                    <span>Dán mã này vào ô bên trên rồi bấm “Quay bằng mã”.</span>
                </div>
            `;
        }

        renderBonusLinkResult({
            shortUrl: payload.shortUrl || '',
            expiresAt: payload.expiresAt || '',
            code: payload.code || '',
            revealed: true,
            reused: true
        });
        syncBonusControls();
    }

    async function animateToReward(reward, rewards) {
        if (!wheelEl || !Array.isArray(rewards) || !rewards.length) {
            return;
        }

        const targetIndex = Math.max(0, rewards.findIndex(item => item.id === reward.id));
        const segmentDeg = 360 / rewards.length;
        const centerDeg = (targetIndex * segmentDeg) + (segmentDeg / 2);
        const targetNormalized = (360 - centerDeg) % 360;
        const currentNormalized = ((currentRotation % 360) + 360) % 360;
        const travel = ((targetNormalized - currentNormalized) + 360) % 360;
        currentRotation += (360 * 6) + travel;

        wheelEl.style.transition = 'transform 4.8s cubic-bezier(0.16, 1, 0.3, 1)';
        wheelEl.style.transform = `rotate(${currentRotation}deg)`;

        await waitForTransition(wheelEl, 5000);

        if (centerLabelEl) centerLabelEl.textContent = reward.label || 'Hoàn tất';
        if (centerNoteEl) {
            centerNoteEl.textContent = Number(reward.amount || 0) > 0
                ? `Nhận ${formatMoney(Number(reward.amount || 0))} vào ví.`
                : 'Lần này chưa có tiền thưởng.';
        }
    }

    function buildUnavailableMessage() {
        if (!state?.enabled) {
            return 'Tính năng vòng quay đang tạm tắt';
        }
        if (state?.activeEvent && state?.hasPlayedCurrentEvent) {
            return 'Bạn đã quay trong sự kiện tuần này';
        }

        const eventLabel = formatEventLabel(state?.event);
        return eventLabel
            ? `Vòng quay sẽ mở vào ${eventLabel}`
            : 'Hôm nay chưa đến lịch mở vòng quay';
    }

    function renderError(message) {
        if (rewardListEl) rewardListEl.innerHTML = `<div class="reward-empty">${escapeHtml(message)}</div>`;
        if (historyEl) historyEl.innerHTML = '<div class="reward-empty">Không có dữ liệu lịch sử.</div>';
        if (statusBadgeEl) {
            statusBadgeEl.className = 'badge badge-danger';
            statusBadgeEl.textContent = 'Lỗi';
        }
        if (cooldownBadgeEl) {
            cooldownBadgeEl.className = 'badge badge-secondary';
            cooldownBadgeEl.textContent = 'Không tải được dữ liệu';
        }
        if (eventDateEl) eventDateEl.textContent = 'Không tải được lịch';
        if (eventNoteEl) eventNoteEl.textContent = message;
        if (playBtn) playBtn.disabled = true;
        if (bonusPlayBtn) bonusPlayBtn.disabled = true;
        if (bonusCodeInput) bonusCodeInput.disabled = true;
        if (helpTextEl) helpTextEl.textContent = message;
    }

    function clearBonusTokenFromUrl() {
        if (!window.history?.replaceState) return;

        const url = new URL(window.location.href);
        if (!url.searchParams.has('spin_bonus_token')) return;

        url.searchParams.delete('spin_bonus_token');
        const nextUrl = `${url.pathname}${url.search ? url.search : ''}${url.hash || ''}`;
        window.history.replaceState({}, '', nextUrl || '/vongquay');
    }

    function formatEventLabel(event) {
        if (!event || !event.eventDate) {
            return '';
        }

        const dateText = formatDateKey(event.eventDate);
        const weekdayText = getWeekdayLabel(event.eventWeekday);
        return weekdayText && dateText ? `${weekdayText}, ${dateText}` : (dateText || weekdayText);
    }

    function formatDateKey(dateKey = '') {
        const normalized = String(dateKey || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            return '';
        }

        const [year, month, day] = normalized.split('-');
        return `${day}/${month}/${year}`;
    }

    function getWeekdayLabel(weekday) {
        const labels = {
            1: 'Thứ 2',
            2: 'Thứ 3',
            3: 'Thứ 4',
            4: 'Thứ 5',
            5: 'Thứ 6',
            6: 'Thứ 7',
            7: 'Chủ nhật'
        };
        return labels[Number(weekday)] || '';
    }

    function normalizeKnownText(value, fallback, legacyValues = []) {
        const text = String(value || '').trim();
        if (!text || legacyValues.includes(text)) {
            return fallback;
        }
        return text;
    }

    function updateLocalBalance(balance) {
        if (!Number.isFinite(Number(balance))) return;
        Auth.updateUser({ balance: Number(balance) });
        window.appInstance?.updateUserSection?.();
    }

    function getRemainingMs(nextSpinAt) {
        const timestamp = Date.parse(nextSpinAt || '');
        if (!Number.isFinite(timestamp)) {
            return 0;
        }
        return Math.max(0, timestamp - Date.now());
    }

    function formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 0) return `${days} ngày ${String(hours).padStart(2, '0')} giờ`;
        if (hours > 0) return `${hours} giờ ${String(minutes).padStart(2, '0')} phút`;
        if (minutes > 0) return `${minutes} phút ${String(seconds).padStart(2, '0')} giây`;
        return `${seconds} giây`;
    }

    function formatNextSpinAt(nextSpinAt) {
        const timestamp = Date.parse(nextSpinAt || '');
        if (!Number.isFinite(timestamp)) {
            return '';
        }
        return formatDateShort(new Date(timestamp).toISOString());
    }

    function waitForTransition(element, timeoutMs = 5000) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                element.removeEventListener('transitionend', onEnd);
                resolve();
            };
            const onEnd = (event) => {
                if (event.target === element) {
                    finish();
                }
            };
            element.addEventListener('transitionend', onEnd);
            setTimeout(finish, timeoutMs);
        });
    }

    function escapeHtml(value = '') {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
