window.pageInit = async function() {
    const pageTitleEl = document.getElementById('checkin-page-title');
    const pageSubtitleEl = document.getElementById('checkin-page-subtitle');
    const timezoneBadgeEl = document.getElementById('checkin-timezone-badge');
    const nextKickerEl = document.getElementById('checkin-next-kicker');
    const nextTitleEl = document.getElementById('checkin-next-title');
    const nextAmountEl = document.getElementById('checkin-next-amount');
    const helpTextEl = document.getElementById('checkin-help-text');
    const streakValueEl = document.getElementById('checkin-streak-value');
    const todayValueEl = document.getElementById('checkin-today-value');
    const statusTextEl = document.getElementById('checkin-status-text');
    const progressEl = document.getElementById('checkin-progress');
    const historyEl = document.getElementById('checkin-history');
    const claimBtn = document.getElementById('checkin-claim-btn');

    let state = null;
    let isClaiming = false;

    if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
            if (!state || isClaiming) return;

            if (!state.enabled) {
                showToast('Tính năng điểm danh đang tạm tắt', 'warning');
                return;
            }

            if (!state.canClaim) {
                showToast('Hôm nay bạn đã điểm danh rồi', 'warning');
                return;
            }

            isClaiming = true;
            claimBtn.disabled = true;
            claimBtn.textContent = 'Đang xử lý...';

            try {
                const response = await api.post('/wallet/daily-checkin/claim');
                if (!response.success) {
                    throw new Error(response.message || 'Không thể điểm danh');
                }

                const result = response.data || {};
                updateLocalBalance(result.balance);
                state = result.state || state;
                renderState();
                showToast(
                    result.reward && Number(result.reward.amount || 0) > 0
                        ? `Bạn vừa nhận ${formatMoney(Number(result.reward.amount || 0))}`
                        : 'Điểm danh thành công',
                    'success'
                );
            } catch (error) {
                showToast(error.message || 'Điểm danh không thành công', 'error');
                await loadState();
            } finally {
                isClaiming = false;
                if (claimBtn) claimBtn.textContent = 'Điểm danh hôm nay';
                renderState();
            }
        });
    }

    await loadState();

    async function loadState() {
        try {
            const response = await api.get('/wallet/daily-checkin', { forceRefresh: true });
            if (!response.success) {
                throw new Error(response.message || 'Điểm danh không thành công');
            }

            state = response.data || {};
            renderState();
        } catch (error) {
            renderError(error.message || 'Điểm danh không thành công');
        }
    }

    function renderState() {
        if (!state) return;

        const rewards = Array.isArray(state.rewards) ? state.rewards : [];
        const progress = getCycleProgress();

        if (pageTitleEl) pageTitleEl.textContent = state.title || 'Sẵn sàng nhận thưởng';
        if (pageSubtitleEl) pageSubtitleEl.textContent = state.subtitle || 'Bấm điểm danh để giữ chuỗi streak và nhận thưởng tăng dần.';
        if (timezoneBadgeEl) timezoneBadgeEl.textContent = formatTimezoneLabel(state.timezone);
        if (todayValueEl) todayValueEl.textContent = state.todayKey || '--';

        renderHighlights(rewards, progress);
        renderProgress(rewards, progress);
        renderHistory(Array.isArray(state.history) ? state.history : []);
    }

    function renderHighlights(rewards, progress) {
        if (!nextTitleEl || !nextAmountEl || !helpTextEl || !claimBtn) return;

        const todayClaim = state.todayClaim || null;
        const nextReward = rewards.find(item => Number(item.day || 1) === progress.activeDay) || rewards[0] || { day: 1, amount: 0, label: 'Ngày 1' };
        const highlightAmount = todayClaim ? Number(todayClaim.rewardAmount || 0) : Number(nextReward.amount || 0);
        const currentStreak = Number(
            todayClaim?.consecutiveDays
            || state.consecutiveDays
            || (state.streakBroken ? 0 : Math.max(0, progress.claimedCount))
            || 0
        );

        if (streakValueEl) {
            streakValueEl.textContent = currentStreak > 0 ? `${currentStreak} ngày` : '0';
        }

        if (nextKickerEl) {
            nextKickerEl.textContent = todayClaim ? 'ĐÃ NHẬN HÔM NAY' : 'Trạng thái hôm nay';
        }

        if (!state.enabled) {
            nextTitleEl.textContent = 'Tạm khóa';
            nextAmountEl.textContent = formatMoney(0);
            helpTextEl.textContent = 'Admin đang tắt tính năng điểm danh.';
            if (statusTextEl) statusTextEl.textContent = 'Tạm khóa';
            claimBtn.disabled = true;
            return;
        }

        if (todayClaim) {
            nextTitleEl.textContent = 'Đã điểm danh';
            nextAmountEl.textContent = formatMoney(highlightAmount);
            helpTextEl.textContent = 'Quay lại vào ngày mai để tiếp tục streak.';
            if (statusTextEl) statusTextEl.textContent = 'Đã nhận';
            claimBtn.disabled = true;
            return;
        }

        nextTitleEl.textContent = state.streakBroken ? 'Bắt đầu lại' : 'Sẵn sàng';
        nextAmountEl.textContent = formatMoney(highlightAmount);
        helpTextEl.textContent = state.streakBroken
            ? 'Chuỗi đã reset. Điểm danh ngay để bắt đầu lại.'
            : 'Nhấn điểm danh để duy trì chuỗi streak và nhận thưởng lớn hơn.';
        if (statusTextEl) statusTextEl.textContent = state.streakBroken ? 'Reset' : 'Có thể nhận';
        claimBtn.disabled = isClaiming ? true : !state.canClaim;
    }

    function renderProgress(rewards, progress) {
        if (!progressEl) return;

        if (!rewards.length) {
            progressEl.innerHTML = '<div class="reward-empty">Chưa có lộ trình thưởng để hiển thị.</div>';
            return;
        }

        progressEl.innerHTML = rewards.map((item, index) => {
            const day = Number(item.day || index + 1);
            const amount = formatMoney(Number(item.amount || 0));
            const isClaimed = day <= Number(progress.claimedCount || 0);
            const isNext = day === Number(progress.activeDay || 1);
            const isLast = index === rewards.length - 1;
            
            let statusClass = '';
            let iconHtml = '';
            let stateLabel = '';

            if (isClaimed) {
                statusClass = 'is-claimed';
                stateLabel = 'Đã nhận';
                iconHtml = '<span class="checkin-day-chip-icon text-success"><i class="fa-solid fa-circle-check"></i></span>';
            } else if (isNext) {
                statusClass = 'is-next';
                stateLabel = 'Hôm nay';
                iconHtml = isLast 
                    ? '<span class="checkin-day-chip-icon text-warning animate-pulse"><i class="fa-solid fa-crown fa-bounce"></i></span>'
                    : '<span class="checkin-day-chip-icon text-primary animate-pulse"><i class="fa-solid fa-gift fa-bounce"></i></span>';
            } else {
                statusClass = 'is-upcoming';
                stateLabel = 'Chờ';
                iconHtml = isLast
                    ? '<span class="checkin-day-chip-icon text-muted"><i class="fa-solid fa-crown"></i></span>'
                    : '<span class="checkin-day-chip-icon text-muted"><i class="fa-solid fa-lock"></i></span>';
            }

            if (isLast) {
                statusClass += ' is-milestone';
            }

            const rewardLabel = escapeHtml(item.label || `Ngày ${day}`);

            return `
                <article class="checkin-day-chip ${statusClass}">
                    <div class="checkin-day-chip-top">
                        <span class="checkin-day-chip-state">${stateLabel}</span>
                        <strong>Ngày ${day}</strong>
                    </div>
                    <div class="checkin-day-chip-center">
                        ${iconHtml}
                        <div class="checkin-day-chip-amount">${amount}</div>
                    </div>
                    <div class="checkin-day-chip-title">${rewardLabel}</div>
                </article>
            `;
        }).join('');
    }

    function renderHistory(items) {
        if (!historyEl) return;

        if (!items.length) {
            historyEl.innerHTML = '<div class="reward-empty">Chưa có lịch sử điểm danh.</div>';
            return;
        }

        historyEl.innerHTML = items.map((item) => `
            <div class="reward-history-item checkin-history-item">
                <div class="checkin-history-icon-wrapper">
                    <span class="checkin-history-icon text-success"><i class="fa-solid fa-circle-check"></i></span>
                </div>
                <div class="checkin-history-body">
                    <strong>${escapeHtml(item.claimDate || '')}</strong>
                    <div class="reward-history-meta"><i class="fa-solid fa-fire text-orange"></i> Chuỗi điểm danh: ${Number(item.consecutiveDays || 1)} ngày</div>
                </div>
                <div class="reward-history-amount is-positive">+${formatMoney(Number(item.rewardAmount || 0))}</div>
            </div>
        `).join('');
    }

    function renderError(message) {
        if (helpTextEl) helpTextEl.textContent = message;
        if (statusTextEl) statusTextEl.textContent = 'Lỗi';
        if (claimBtn) claimBtn.disabled = true;
        if (historyEl) historyEl.innerHTML = '<div class="reward-empty">Không thể tải dữ liệu.</div>';
        if (progressEl) progressEl.innerHTML = '<div class="reward-empty">Không thể tải lộ trình thưởng.</div>';
    }

    function getCycleProgress() {
        const todayClaim = state?.todayClaim || null;
        const nextRewardDay = Number(state?.nextRewardDay || 1);
        const activeDay = todayClaim
            ? Number(todayClaim.rewardDay || nextRewardDay || 1)
            : nextRewardDay;

        let claimedCount = 0;
        if (todayClaim) {
            claimedCount = Number(todayClaim.rewardDay || 0);
        } else if (!state?.streakBroken && nextRewardDay > 1) {
            claimedCount = nextRewardDay - 1;
        }

        return {
            activeDay: Math.min(Math.max(activeDay, 1), 7),
            claimedCount: Math.min(Math.max(claimedCount, 0), 7),
            todayClaim
        };
    }

    function updateLocalBalance(balance) {
        if (!Number.isFinite(Number(balance))) return;
        Auth.updateUser({ balance: Number(balance) });
        window.appInstance?.updateUserSection?.();
    }

    function formatTimezoneLabel(timezone) {
        const value = String(timezone || '').trim();
        if (!value) return 'GMT+7';
        if (value === 'Asia/Bangkok' || value === 'Asia/Ho_Chi_Minh') {
            return 'GMT+7';
        }
        return value;
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
