window.pageInit = async function() {
    const form = document.getElementById('withdraw-form');
    const historyEl = document.getElementById('withdraw-history');
    const balanceEl = document.getElementById('withdraw-balance');
    const qrInput = document.getElementById('withdraw-qr-input');
    const qrLabel = document.getElementById('withdraw-qr-label');
    const qrPreview = document.getElementById('withdraw-qr-preview');
    let qrFile = null;

    initFilePickers(document);
    await loadHistory();

    if (qrInput) {
        qrInput.addEventListener('change', () => {
            qrFile = qrInput.files && qrInput.files[0] ? qrInput.files[0] : null;
            renderQrPreview();
        });
    }

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const amount = Number(form.amount.value || 0);
            if (amount < 100000) {
                showToast('So tien rut toi thieu 100.000d', 'error');
                return;
            }

            const bankName = String(form.bank_name.value || '').trim();
            const accountNumber = String(form.account_number.value || '').trim();
            const accountName = String(form.account_name.value || '').trim();
            const note = String(form.note.value || '').trim();

            if (!bankName || !accountNumber || !accountName) {
                showToast('Vui long nhap day du thong tin tai khoan nhan tien', 'error');
                return;
            }

            if (!qrFile) {
                showToast('Vui long upload ma QR nhan tien', 'error');
                return;
            }

            try {
                let qrImageUrl = '';
                if (qrFile) {
                    if (!String(qrFile.type || '').startsWith('image/')) {
                        showToast('Ma QR phai la file anh', 'error');
                        return;
                    }

                    const formData = new FormData();
                    formData.append('file', qrFile);
                    const bar = qrPreview ? qrPreview.querySelector('.upload-progress-bar') : null;
                    const text = qrPreview ? qrPreview.querySelector('.upload-progress-text') : null;
                    const upload = await api.uploadWithProgress('/uploads', formData, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        qrImageUrl = upload.data.url || '';
                    }
                }

                const payload = {
                    amount,
                    bankInfo: {
                        bankName,
                        accountNumber,
                        accountName,
                        qrImageUrl,
                        note
                    }
                };

                const res = await api.post('/withdraw/request', payload);
                if (res.success) {
                    showToast(res.message || 'Da gui lenh rut', 'success');
                    if (res.data?.newBalance !== undefined) {
                        Auth.updateUser({ balance: res.data.newBalance });
                    }
                    form.reset();
                    qrFile = null;
                    if (qrInput) qrInput.value = '';
                    if (qrLabel) qrLabel.textContent = 'Chua chon file';
                    renderQrPreview();
                    await loadHistory();
                }
            } catch (error) {
                showToast(error.message || 'Khong the rut tien', 'error');
            }
        });
    }

    function renderQrPreview() {
        if (!qrPreview) return;
        if (!qrFile) {
            qrPreview.innerHTML = '';
            return;
        }

        const objectUrl = URL.createObjectURL(qrFile);
        qrPreview.innerHTML = `
            <div class="upload-preview-item withdraw-qr-preview-item">
                <img src="${objectUrl}" class="upload-preview-img" alt="qr preview">
                <button type="button" class="upload-remove" aria-label="Xoa">×</button>
                <div class="upload-progress">
                    <div class="upload-progress-bar"></div>
                </div>
                <div class="upload-progress-text">0%</div>
            </div>
        `;

        qrPreview.querySelector('.upload-remove')?.addEventListener('click', () => {
            qrFile = null;
            if (qrInput) qrInput.value = '';
            if (qrLabel) qrLabel.textContent = 'Chua chon file';
            renderQrPreview();
        });
    }

    async function loadHistory() {
        const user = Auth.getCurrentUser() || {};
        if (balanceEl) balanceEl.textContent = formatMoney(user.balance || 0);

        try {
            const res = await api.get('/withdraw/history', {}, { forceRefresh: true });
            const rows = res.success ? (res.data || []) : [];
            historyEl.innerHTML = rows.length ? `
                <div class="withdraw-history-list">
                    ${rows.map((row) => renderWithdrawHistoryCard(row)).join('')}
                </div>
            ` : '<div class="income-empty-state">Chua co lenh rut tien nao.</div>';
        } catch (error) {
            historyEl.innerHTML = '<div class="income-empty-state">bị lag rồi ko tải được</div>';
        }
    }

    function renderWithdrawHistoryCard(row = {}) {
        const bank = parseWithdrawBankInfo(row.bank_info);
        const status = String(row.status || 'pending').toLowerCase();
        const statusLabel = ({
            pending: 'Dang xu ly',
            approved: 'Da duyet',
            rejected: 'Bi tu choi'
        })[status] || escapeHtml(row.status || 'pending');

        return `
            <article class="withdraw-history-card">
                <div class="withdraw-history-top">
                    <div>
                        <strong>${formatMoney(row.net_amount || 0)}</strong>
                        <div class="withdraw-history-sub">Nhan thuc te sau phi</div>
                    </div>
                    <span class="income-status-chip is-${escapeHtml(status)}">${statusLabel}</span>
                </div>
                <div class="withdraw-history-grid">
                    <div class="withdraw-history-item">
                        <span>So tien rut</span>
                        <strong>${formatMoney(row.amount || 0)}</strong>
                    </div>
                    <div class="withdraw-history-item">
                        <span>Phi</span>
                        <strong>${formatMoney(row.fee || 0)}</strong>
                    </div>
                    <div class="withdraw-history-item">
                        <span>Ngay tao</span>
                        <strong>${formatDateShort(row.created_at)}</strong>
                    </div>
                    <div class="withdraw-history-item">
                        <span>Du kien</span>
                        <strong>${row.expected_at ? formatDateShort(row.expected_at) : '5-7 ngay'}</strong>
                    </div>
                </div>
                <div class="withdraw-bank-card">
                    <div class="withdraw-bank-copy">
                        <div><span>Ngan hang</span><strong>${escapeHtml(bank.bankName || 'Chua ro')}</strong></div>
                        <div><span>So tai khoan</span><strong>${escapeHtml(bank.accountNumber || bank.raw || '-')}</strong></div>
                        <div><span>Chu tai khoan</span><strong>${escapeHtml(bank.accountName || '-')}</strong></div>
                        ${bank.note ? `<div><span>Ghi chu</span><strong>${escapeHtml(bank.note)}</strong></div>` : ''}
                    </div>
                    ${bank.qrImageUrl ? `
                        <a class="withdraw-bank-qr" href="${escapeHtml(bank.qrImageUrl)}" target="_blank" rel="noopener noreferrer">
                            <img src="${escapeHtml(bank.qrImageUrl)}" alt="QR rut tien">
                        </a>
                    ` : ''}
                </div>
                ${row.admin_note ? `<div class="withdraw-admin-note">Ghi chu admin: ${escapeHtml(row.admin_note)}</div>` : ''}
            </article>
        `;
    }
};
