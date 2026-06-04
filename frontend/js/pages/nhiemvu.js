window.pageInit = async function() {
    const statusEl = document.getElementById('mission-status');
    const linkEl = document.getElementById('mission-link');
    const keyInput = document.getElementById('mission-key');
    const generateBtn = document.getElementById('mission-generate');
    const claimBtn = document.getElementById('mission-claim');

    await loadStatus();

    generateBtn?.addEventListener('click', async () => {
        try {
            const res = await api.post('/mission/generate-link', {});
            const data = res.data || {};
            const shortLink = String(data.shortLink || data.link || '').trim();

            linkEl.innerHTML = `
                <div class="mission-link-card">
                    <div class="mission-link-provider">
                        <span>Link4m</span>
                        <strong>${shortLink ? 'Sẵn sàng' : 'Lỗi'}</strong>
                    </div>
                    <div class="mission-link-field">
                        <label>Link vượt nhiệm vụ</label>
                        <div class="mission-link-input-wrap">
                            <input type="text" value="${escapeHtml(shortLink)}" readonly>
                            <button type="button" class="btn-outline" data-copy-mission-link="${escapeHtml(shortLink)}">Copy</button>
                            <a class="btn-primary" href="${escapeHtml(shortLink || '#')}" target="_blank" rel="noopener noreferrer">Mở link</a>
                        </div>
                    </div>
                    ${data.shortLinkError ? `<div class="mission-link-warning">${escapeHtml(data.shortLinkError)}</div>` : ''}
                </div>
            `;

            linkEl.querySelector('[data-copy-mission-link]')?.addEventListener('click', async () => {
                await copyToClipboard(shortLink);
            });

            showToast('Đã tạo link nhiệm vụ', 'success');
            await loadStatus();
        } catch (error) {
            showToast(error.message || 'Không thể tạo link', 'error');
        }
    });

    claimBtn?.addEventListener('click', async () => {
        try {
            const res = await api.post('/mission/claim', { key: keyInput.value.trim() });
            if (res.data?.newBalance !== undefined) Auth.updateUser({ balance: res.data.newBalance });
            showToast(res.message || 'Đã nhận thưởng', 'success');
            keyInput.value = '';
            await loadStatus();
        } catch (error) {
            showToast(error.message || 'Không thể nhận thưởng', 'error');
        }
    });

    async function loadStatus() {
        try {
            const res = await api.get('/mission/status', {}, { forceRefresh: true });
            const data = res.data || {};
            statusEl.innerHTML = `
                <div class="mission-status-copy ${data.completedToday ? 'is-success' : 'is-pending'}">
                    <strong>${data.completedToday ? 'Hôm nay bạn đã hoàn thành nhiệm vụ.' : 'Hôm nay bạn chưa nhận thưởng nhiệm vụ.'}</strong>
                    <span>${data.completedToday ? `Hoàn thành lúc ${data.usedAt ? formatDateShort(data.usedAt) : 'hôm nay'}.` : 'Tạo link, vượt Link4m, copy key rồi dán lại để nhận thưởng.'}</span>
                </div>
            `;
        } catch (_) {
            statusEl.innerHTML = '<div class="mission-status-copy">Không thể tải trạng thái nhiệm vụ.</div>';
        }
    }
};
