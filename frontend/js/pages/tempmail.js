// ============================================
// TEMPORARY EMAIL CLIENT SIDE LOGIC
// File: frontend/js/pages/tempmail.js
// ============================================

window.pageInit = async function() {
    let sidToken = localStorage.getItem('tempmail_sid_token') || null;
    let autoRefreshInterval = null;
    let countdownInterval = null;
    let currentMailId = null;

    // Elements
    const emailAddrInput   = document.getElementById('tempmail-address');
    const copyBtn          = document.getElementById('btn-copy-tempmail');
    const customPrefixInp  = document.getElementById('tempmail-custom-prefix');
    const customDomainSel  = document.getElementById('tempmail-custom-domain');
    const savePrefixBtn    = document.getElementById('btn-save-custom-prefix');
    const refreshInboxBtn  = document.getElementById('btn-refresh-inbox');
    const renewEmailBtn    = document.getElementById('btn-renew-email');
    const autoRefreshCb    = document.getElementById('tempmail-auto-refresh');
    const countBadge       = document.getElementById('tempmail-count-badge');
    const messagesList     = document.getElementById('tempmail-messages-list');
    
    // Modal Elements
    const msgModal         = document.getElementById('tempmail-message-modal');
    const closeBtn         = document.getElementById('btn-close-msg-modal');
    const closeBtnFoot     = document.getElementById('btn-close-msg-modal-foot');
    const deleteBtn        = document.getElementById('btn-delete-current-msg');
    const msgSubject       = document.getElementById('msg-view-subject');
    const msgSender        = document.getElementById('msg-view-sender');
    const msgTime          = document.getElementById('msg-view-time');
    const msgIframe        = document.getElementById('msg-view-iframe');

    // Initialize session
    await initSession();

    // Bind event listeners
    if (copyBtn)          copyBtn.addEventListener('click', copyEmailToClipboard);
    if (savePrefixBtn)    savePrefixBtn.addEventListener('click', handleCustomPrefix);
    if (refreshInboxBtn)  refreshInboxBtn.addEventListener('click', () => loadInbox(true));
    if (renewEmailBtn)    renewEmailBtn.addEventListener('click', handleRenewEmail);
    if (closeBtn)         closeBtn.addEventListener('click', closeModal);
    if (closeBtnFoot)     closeBtnFoot.addEventListener('click', closeModal);
    if (deleteBtn)        deleteBtn.addEventListener('click', deleteCurrentMessage);
    if (autoRefreshCb) {
        autoRefreshCb.addEventListener('change', () => {
            if (autoRefreshCb.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }

    // ── Core functions ───────────────────────────────────────────────────

    async function initSession() {
        try {
            showLoadingEmail();
            const url = sidToken ? `/tempmail/session?sid_token=${encodeURIComponent(sidToken)}` : '/tempmail/session';
            const res = await api.get(url);
            
            if (res.success && res.data) {
                sidToken = res.data.sid_token;
                localStorage.setItem('tempmail_sid_token', sidToken);
                
                if (emailAddrInput) {
                    emailAddrInput.value = res.data.email || '';
                }
                
                // Update change limit hint
                updateChangeLimitHint(res.data.changeCount || 0);

                // Start active session countdown timer
                if (res.data.expiresAt) {
                    startTimer(res.data.expiresAt);
                }

                await loadInbox();
                startAutoRefresh();
            } else {
                throw new Error(res.message || 'Không thể tạo phiên email.');
            }
        } catch (error) {
            showToast(error.message || 'Lỗi kết nối máy chủ.', 'error');
            if (emailAddrInput) {
                emailAddrInput.value = 'Lỗi tạo email tạm thời...';
            }
        }
    }

    async function handleCustomPrefix() {
        const prefix = customPrefixInp ? customPrefixInp.value.trim() : '';
        const domain = customDomainSel ? customDomainSel.value : 'grr.la';

        if (!prefix) {
            showToast('Vui lòng nhập tên tùy chỉnh.', 'warning');
            return;
        }

        if (savePrefixBtn) savePrefixBtn.disabled = true;

        try {
            const res = await api.post('/tempmail/customize', {
                sid_token: sidToken,
                prefix: prefix,
                domain: domain
            });

            if (res.success && res.data) {
                if (emailAddrInput) emailAddrInput.value = res.data.email;
                if (customPrefixInp) customPrefixInp.value = '';
                showToast('Cập nhật email thành công!', 'success');
                
                // Update remaining manual changes
                updateChangeLimitHint(res.data.changeCount || 0);

                await loadInbox();
            } else {
                showToast(res.message || 'Không thể thay đổi email.', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Lỗi hệ thống.', 'error');
        } finally {
            if (savePrefixBtn) savePrefixBtn.disabled = false;
        }
    }

    async function loadInbox(isManual = false) {
        if (!sidToken) return;

        try {
            const res = await api.get(`/tempmail/inbox?sid_token=${encodeURIComponent(sidToken)}`);
            if (res.success && res.data) {
                renderInbox(res.data.list || []);
                if (isManual) {
                    showToast('Đã cập nhật hộp thư mới nhất!', 'success');
                }
            }
        } catch (error) {
            if (isManual) {
                showToast(error.message || 'Không thể làm mới hộp thư.', 'error');
            }
        }
    }

    function renderInbox(messages) {
        if (countBadge) {
            if (messages.length > 0) {
                countBadge.textContent = messages.length;
                countBadge.style.display = 'inline-block';
            } else {
                countBadge.style.display = 'none';
            }
        }

        if (!messagesList) return;

        if (messages.length === 0) {
            messagesList.innerHTML = `
                <div style="text-align:center; padding:48px 16px; color:var(--muted);">
                    <i class="fas fa-inbox" style="font-size:28px; margin-bottom:12px; opacity:0.5;"></i>
                    <p style="margin:0; font-weight:500;">Hộp thư trống</p>
                    <small style="color:var(--muted);">Thư mới gửi đến hộp thư này sẽ tự động xuất hiện tại đây.</small>
                </div>
            `;
            return;
        }

        messagesList.innerHTML = messages.map(msg => {
            const formattedTime = formatTimestamp(msg.mail_timestamp);
            return `
                <div class="tempmail-row" data-id="${msg.mail_id}">
                    <span style="font-weight:700; color:var(--ink);">${escapeHtml(msg.mail_from)}</span>
                    <div style="display:flex; flex-direction:column; gap:4px; overflow:hidden;">
                        <span style="font-weight:600; color:var(--primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(msg.mail_subject || '(Không có tiêu đề)')}</span>
                        <span style="color:var(--muted); font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(msg.mail_excerpt)}</span>
                    </div>
                    <span class="tempmail-time" style="text-align:right; font-weight:500; color:var(--muted);">${formattedTime}</span>
                </div>
            `;
        }).join('');

        // Bind click event to each message row
        messagesList.querySelectorAll('.tempmail-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                openMessage(id);
            });
        });
    }

    async function openMessage(mailId) {
        if (!sidToken || !mailId) return;

        try {
            showPageLoading();
            const res = await api.get(`/tempmail/message/${mailId}?sid_token=${encodeURIComponent(sidToken)}`);
            hidePageLoading();

            if (res.success && res.data) {
                currentMailId = mailId;
                
                if (msgSubject) msgSubject.textContent = res.data.mail_subject || '(Không có tiêu đề)';
                if (msgSender)  msgSender.textContent = res.data.mail_from || '';
                if (msgTime)    msgTime.textContent = formatTimestamp(res.data.mail_timestamp);

                if (msgModal) {
                    msgModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden'; // Lock body scroll
                }

                // Render secure iframe body content
                if (msgIframe) {
                    const doc = msgIframe.contentDocument || msgIframe.contentWindow.document;
                    doc.open();
                    
                    // Inject CSS to normalize iframe look
                    const cleanHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body {
                                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                    font-size: 14px;
                                    line-height: 1.6;
                                    color: #1e293b;
                                    margin: 10px;
                                    word-break: break-word;
                                }
                                a { color: #6366f1; text-decoration: underline; }
                                img { max-width: 100%; height: auto; }
                            </style>
                        </head>
                        <body>
                            ${res.data.mail_body || ''}
                        </body>
                        </html>
                    `;
                    doc.write(cleanHtml);
                    doc.close();
                }
            } else {
                showToast(res.message || 'Không thể xem nội dung thư.', 'error');
            }
        } catch (error) {
            hidePageLoading();
            showToast(error.message || 'Lỗi tải thư.', 'error');
        }
    }

    async function deleteCurrentMessage() {
        if (!sidToken || !currentMailId) return;

        if (!confirm('Bạn có chắc chắn muốn xóa thư này khỏi hộp thư?')) return;

        if (deleteBtn) deleteBtn.disabled = true;

        try {
            const res = await api.post('/tempmail/delete', {
                sid_token: sidToken,
                email_ids: [currentMailId]
            });

            if (res.success) {
                showToast('Đã xóa thư!', 'success');
                closeModal();
                await loadInbox();
            } else {
                showToast(res.message || 'Không thể xóa thư.', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Lỗi kết nối.', 'error');
        } finally {
            if (deleteBtn) deleteBtn.disabled = false;
        }
    }

    async function handleRenewEmail() {
        if (!confirm('Bạn có chắc chắn muốn làm mới? Một hòm thư hoàn toàn mới sẽ được tạo sau khi email cũ hết hạn, hoặc nếu bạn đổi email ngẫu nhiên.')) return;

        localStorage.removeItem('tempmail_sid_token');
        sidToken = null;
        stopAutoRefresh();
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        await initSession();
    }

    function closeModal() {
        if (msgModal) {
            msgModal.style.display = 'none';
            document.body.style.overflow = ''; // Restore body scroll
        }
        currentMailId = null;
        if (msgIframe) {
            const doc = msgIframe.contentDocument || msgIframe.contentWindow.document;
            doc.open();
            doc.write('');
            doc.close();
        }
    }

    function copyEmailToClipboard() {
        if (!emailAddrInput) return;
        const val = emailAddrInput.value;
        if (!val || val.includes('...')) return;

        navigator.clipboard.writeText(val).then(() => {
            showToast('Đã sao chép địa chỉ email vào bộ nhớ tạm!', 'success');
        }).catch(() => {
            showToast('Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.', 'warning');
        });
    }

    // Cooldown expiry countdown timer
    function startTimer(expiresAt) {
        if (countdownInterval) clearInterval(countdownInterval);
        
        const timerEl = document.getElementById('tempmail-timer');
        const progressBar = document.getElementById('cooldown-progress-bar');
        if (!timerEl) return;

        function updateTimer() {
            const now = Date.now();
            const diff = expiresAt - now;

            if (diff <= 0) {
                timerEl.innerHTML = '<span style="color:#ef4444; font-weight:700;"><i class="fas fa-circle-exclamation"></i> Phiên email tạm thời đã hết hạn (60 phút). Bạn có thể nhấp đổi Email để bắt đầu phiên mới.</span>';
                if (progressBar) progressBar.style.width = '0%';
                clearInterval(countdownInterval);
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            timerEl.innerHTML = `<i class="fas fa-clock" style="color:var(--primary); margin-right:4px;"></i> Thời gian hoạt động còn lại: <strong style="color:var(--ink);">${minutes} phút ${seconds} giây</strong>`;
            
            if (progressBar) {
                const percent = (diff / (60 * 60 * 1000)) * 100;
                progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
            }
        }

        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    }

    function updateChangeLimitHint(changeCount) {
        const hint = document.getElementById('tempmail-change-limit-hint');
        if (hint) {
            const remaining = Math.max(0, 2 - changeCount);
            hint.textContent = `Độ dài từ 3-30 ký tự. Tối đa 2 lần đổi/phiên (còn lại: ${remaining} lượt).`;
        }
    }

    // Auto refresh timer
    function startAutoRefresh() {
        stopAutoRefresh();
        autoRefreshInterval = setInterval(() => {
            loadInbox();
        }, 10000); // 10 seconds interval
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    function showLoadingEmail() {
        if (emailAddrInput) emailAddrInput.value = 'Đang tạo địa chỉ email...';
    }

    function formatTimestamp(ts) {
        if (!ts) return '';
        const date = new Date(Number(ts) * 1000);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
               date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }

    // Helper functions for full page loading block during fetch details
    function showPageLoading() {
        const loading = document.createElement('div');
        loading.id = 'tempmail-page-loader';
        loading.style.position = 'fixed';
        loading.style.top = '0';
        loading.style.left = '0';
        loading.style.right = '0';
        loading.style.bottom = '0';
        loading.style.background = 'rgba(0,0,0,0.3)';
        loading.style.zIndex = '10000';
        loading.style.display = 'flex';
        loading.style.alignItems = 'center';
        loading.style.justifyContent = 'center';
        loading.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:32px; color:#fff;"></i>';
        document.body.appendChild(loading);
    }

    function hidePageLoading() {
        const loading = document.getElementById('tempmail-page-loader');
        if (loading) loading.remove();
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    window.pageCleanup = () => {
        stopAutoRefresh();
        closeModal();
        if (countdownInterval) clearInterval(countdownInterval);
    };
};
