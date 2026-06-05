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

            if (!shortLink) {
                linkEl.innerHTML = `
                    <div class="mission-link-card is-error">
                        <div class="mission-link-header">
                            <div class="provider-info">
                                <div class="provider-logo error">
                                    <i class="fa-solid fa-circle-xmark text-danger"></i>
                                </div>
                                <div class="provider-details">
                                    <span class="provider-lbl">Đối tác rút gọn</span>
                                    <strong class="provider-name">Link4m</strong>
                                </div>
                            </div>
                            <div class="status-badge is-error">
                                <span class="pulse-dot-red"></span> Lỗi
                            </div>
                        </div>
                        <div class="mission-link-body">
                            <p style="margin:0; font-size:13px; color:var(--muted); line-height:1.5;">
                                Không thể khởi tạo liên kết nhiệm vụ từ đối tác. Vui lòng thử lại sau giây lát.
                            </p>
                        </div>
                    </div>
                `;
                return;
            }

            linkEl.innerHTML = `
                <div class="mission-link-card">
                    <div class="mission-link-header">
                        <div class="provider-info">
                            <div class="provider-logo">
                                <i class="fa-solid fa-link text-primary"></i>
                            </div>
                            <div class="provider-details">
                                <span class="provider-lbl">Đối tác rút gọn</span>
                                <strong class="provider-name">Link4m</strong>
                            </div>
                        </div>
                        <div class="status-badge is-ready">
                            <span class="pulse-dot"></span> Sẵn sàng
                        </div>
                    </div>
                    <div class="mission-link-body">
                        <div class="field-label">Đường dẫn vượt nhiệm vụ</div>
                        <div class="mission-link-input-group">
                            <div class="input-icon-wrapper">
                                <i class="fa-solid fa-link-slash"></i>
                                <input type="text" value="${escapeHtml(shortLink)}" readonly>
                            </div>
                            <div class="btn-group">
                                <button type="button" class="btn-outline btn-copy" data-copy-mission-link="${escapeHtml(shortLink)}">
                                    <i class="fa-regular fa-copy"></i> Sao chép
                                </button>
                                <a class="btn-primary btn-open" href="${escapeHtml(shortLink)}" target="_blank" rel="noopener noreferrer">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Mở link
                                </a>
                            </div>
                        </div>
                        ${data.shortLinkError ? `
                            <div class="mission-link-warning">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                                <span>${escapeHtml(data.shortLinkError)}</span>
                            </div>
                        ` : ''}
                    </div>
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
                <div class="mission-status-card ${data.completedToday ? 'is-success' : 'is-pending'}">
                    <div class="status-icon-wrapper">
                        <i class="${data.completedToday ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation fa-fade'}"></i>
                    </div>
                    <div class="status-text-content">
                        <h4 class="status-title">${data.completedToday ? 'Hoàn thành hôm nay!' : 'Nhiệm vụ đang chờ'}</h4>
                        <p class="status-desc">
                            ${data.completedToday 
                                ? `Bạn đã nhận phần thưởng vào lúc <strong>${data.usedAt ? formatDateShort(data.usedAt) : 'hôm nay'}</strong>. Quay lại vào ngày mai nhé!` 
                                : 'Bạn chưa hoàn thành nhiệm vụ hôm nay. Hãy tạo liên kết rút gọn bên dưới và vượt qua liên kết để nhận key.'}
                        </p>
                    </div>
                </div>
            `;
        } catch (_) {
            statusEl.innerHTML = `
                <div class="mission-status-card is-error">
                    <div class="status-icon-wrapper">
                        <i class="fa-solid fa-circle-xmark text-danger"></i>
                    </div>
                    <div class="status-text-content">
                        <h4 class="status-title">Lỗi kết nối</h4>
                        <p class="status-desc">Không thể tải trạng thái nhiệm vụ. Vui lòng tải lại trang.</p>
                    </div>
                </div>
            `;
        }
    }
};
