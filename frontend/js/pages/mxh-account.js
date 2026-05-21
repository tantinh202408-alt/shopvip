// ============================================
// MXH ACCOUNT DETAIL PAGE
// File: frontend/js/pages/mxh-account.js
// ============================================

window.pageInit = async function(params) {
    const accountId = params.id;
    const content = document.getElementById('mxh-account-content');
    if (!content) return;

    function getPlatformMeta(slug = '') {
        const map = {
            facebook: { label: 'Facebook', icon: 'fab fa-facebook', color: '#1877f2' },
            tiktok: { label: 'TikTok', icon: 'fab fa-tiktok', color: '#010101' },
            instagram: { label: 'Instagram', icon: 'fab fa-instagram', color: '#e1306c' },
            youtube: { label: 'YouTube', icon: 'fab fa-youtube', color: '#ff0000' },
            twitter: { label: 'X / Twitter', icon: 'fab fa-x-twitter', color: '#000000' },
            zalo: { label: 'Zalo', icon: 'fas fa-comment-dots', color: '#0068ff' },
            telegram: { label: 'Telegram', icon: 'fab fa-telegram', color: '#26a5e4' },
            other: { label: 'Khac', icon: 'fas fa-ellipsis', color: '#64748b' }
        };
        return map[String(slug || '').toLowerCase()] || map.other;
    }

    function buildCredentialPanel(creds = {}) {
        const items = [];
        if (creds.account_email) items.push({ label: 'Email / SDT', value: creds.account_email, icon: 'fa-envelope' });
        if (creds.account_password) items.push({ label: 'Mat khau', value: creds.account_password, icon: 'fa-lock' });
        if (creds.backup_email) items.push({ label: 'Email backup', value: creds.backup_email, icon: 'fa-envelope-circle-check' });
        if (creds.backup_email_password) items.push({ label: 'MK backup', value: creds.backup_email_password, icon: 'fa-key' });
        if (creds.cookie) items.push({ label: 'Cookie', value: 'Co', icon: 'fa-cookie-bite' });
        if (creds.extra_info) items.push({ label: 'Ghi chu', value: 'Co', icon: 'fa-circle-info' });

        return `
            <section class="mxh-account-credentials">
                <div class="mxh-account-section-head">
                    <div>
                        <div class="mxh-account-section-kicker">Thong tin sau mua</div>
                        <h2>Thong tin dang nhap</h2>
                    </div>
                    <div class="mxh-account-section-pill">
                        <i class="fas fa-shield-halved"></i>
                        Da xac minh
                    </div>
                </div>

                <div class="mxh-account-cred-summary">
                    ${items.map(item => `
                        <span class="mxh-account-cred-chip">
                            <i class="fas ${item.icon}"></i>
                            ${escapeHtml(item.label)}
                        </span>
                    `).join('')}
                </div>

                <div class="mxh-account-cred-grid">
                    ${creds.account_email ? credRow('Email / SDT dang nhap', creds.account_email, 'fa-envelope') : ''}
                    ${creds.account_password ? credRow('Mat khau', creds.account_password, 'fa-lock') : ''}
                    ${creds.backup_email ? credRow('Email backup', creds.backup_email, 'fa-envelope-circle-check') : ''}
                    ${creds.backup_email_password ? credRow('MK email backup', creds.backup_email_password, 'fa-key') : ''}
                    ${creds.cookie ? credRow('Cookie', creds.cookie, 'fa-cookie', true) : ''}
                    ${creds.extra_info ? credTextRow('Thong tin them', creds.extra_info) : ''}
                </div>
            </section>
        `;
    }

    function credRow(label, value, icon, full = false) {
        const copyValue = String(value || '');
        return `
            <div class="mxh-account-cred-row ${full ? 'full' : ''}">
                <div class="mxh-account-cred-label"><i class="fas ${icon}"></i>${escapeHtml(label)}</div>
                <div class="mxh-account-cred-value-wrap">
                    <code class="mxh-account-cred-value">${escapeHtml(copyValue)}</code>
                    <button type="button" class="mxh-account-copy" data-copy="${escapeHtml(copyValue)}">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function credTextRow(label, value) {
        return `
            <div class="mxh-account-cred-row full">
                <div class="mxh-account-cred-label"><i class="fas fa-circle-info"></i>${escapeHtml(label)}</div>
                <div class="mxh-account-cred-note">${escapeHtml(value)}</div>
            </div>
        `;
    }

    async function loadAccount() {
        content.innerHTML = `
            <div class="loading-container">
                <img class="spinner" src="/img/gif_loaderB46.png" alt="Dang tai tai khoan">
                <p>Dang tai tai khoan...</p>
            </div>
        `;

        try {
            const response = await api.get(`/mxh/accounts/${accountId}`);
            if (!response.success) throw new Error(response.message || 'Khong the tai tai khoan');
            renderAccount(response.data);
        } catch (error) {
            content.innerHTML = `
                <div class="mxh-account-error">
                    <h2>Khong the tai tai khoan</h2>
                    <p>${escapeHtml(error.message || 'Da co loi xay ra')}</p>
                    <button type="button" class="btn-primary" id="mxh-account-retry">Thu lai</button>
                </div>
            `;
            document.getElementById('mxh-account-retry')?.addEventListener('click', loadAccount);
        }
    }

    function renderAccount(acc) {
        const platform = getPlatformMeta(acc.category_slug || acc.category_platform);
        const images = Array.isArray(acc.images) ? acc.images : (acc.main_image ? [acc.main_image] : []);
        const availableCount = Number(acc.available_count ?? (acc.status === 'active' ? 1 : 0));
        const isSold = availableCount <= 0 || acc.status === 'sold';
        const canBuy = Auth.isAuthenticated() && !isSold;
        const heroTag = isSold ? 'Da ban' : 'Con hang';

        content.innerHTML = `
            <div class="mxh-account-page-shell">
                <section class="mxh-account-hero" style="--platform-color:${platform.color};">
                    <div class="mxh-account-hero-copy">
                        <div class="mxh-account-kicker">
                            <i class="${platform.icon}"></i>
                            ${escapeHtml(platform.label)}
                        </div>
                        <h1>${escapeHtml(acc.title || 'Tai khoan MXH')}</h1>
                        <p>${escapeHtml(acc.category_name || acc.mxh_category_name || 'Chi tiet tai khoan va thong tin dang nhap sau khi mua')}</p>
                    </div>
                    <div class="mxh-account-hero-meta">
                        <div class="mxh-account-price">${formatMoney(acc.price)}</div>
                        <div class="mxh-account-status ${isSold ? 'is-sold' : 'is-active'}">
                            ${heroTag}
                        </div>
                        <div class="mxh-account-hero-actions">
                            <a class="btn-outline" href="/lichsumua" data-link>
                                <i class="fas fa-arrow-left"></i> Lich su mua
                            </a>
                            <a class="btn-outline" href="/mxh" data-link>
                                <i class="fas fa-share-nodes"></i> Ve MXH
                            </a>
                            ${!Auth.isAuthenticated() ? `
                                <a class="btn-primary" href="/login" data-link>
                                    <i class="fas fa-right-to-bracket"></i> Dang nhap de mua
                                </a>
                            ` : canBuy ? `
                                <button type="button" class="btn-primary" id="mxh-account-buy-btn">
                                    <i class="fas fa-bolt"></i> Mua ngay
                                </button>
                            ` : `
                                <button type="button" class="btn-primary" disabled>
                                    <i class="fas fa-ban"></i> Da ban het
                                </button>
                            `}
                        </div>
                    </div>
                </section>

                <section class="mxh-account-grid">
                    <div class="mxh-account-media">
                        <div class="mxh-account-main-image">
                            ${images[0]
                                ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(acc.title || 'Tai khoan')}">`
                                : `<div class="mxh-account-no-image" style="background:${platform.color}18">
                                        <i class="${platform.icon}" style="color:${platform.color}"></i>
                                   </div>`
                            }
                        </div>
                        ${images.length > 1 ? `
                            <div class="mxh-account-thumbs">
                                ${images.map((img, index) => `
                                    <button type="button" class="mxh-account-thumb ${index === 0 ? 'active' : ''}" data-full="${escapeHtml(img)}">
                                        <img src="${escapeHtml(img)}" alt="Anh ${index + 1}">
                                    </button>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>

                    <aside class="mxh-account-panel">
                        <div class="mxh-account-info-block">
                            <div class="mxh-account-info-row">
                                <span>Người bán</span>
                                <strong>${escapeHtml(acc.seller_name || 'An danh')}</strong>
                            </div>
                            <div class="mxh-account-info-row">
                                <span>Luot xem</span>
                                <strong>${acc.view_count || 0}</strong>
                            </div>
                            <div class="mxh-account-info-row">
                                <span>Da ban</span>
                                <strong>${acc.purchase_count || 0}</strong>
                            </div>
                            <div class="mxh-account-info-row">
                                <span>Dang thai</span>
                                <strong>${isSold ? 'Da ban' : 'Dang ban'}</strong>
                            </div>
                            <div class="mxh-account-info-row">
                                <span>Ngay tao</span>
                                <strong>${acc.created_at ? formatDateShort(acc.created_at) : '-'}</strong>
                            </div>
                        </div>

                        <div class="mxh-account-description">
                            <h3>Mo ta</h3>
                            <p>${escapeHtml(acc.description || 'Khong co mo ta').replace(/\n/g, '<br>')}</p>
                        </div>

                        <div class="mxh-account-note">
                            <i class="fas fa-shield-halved"></i>
                            <span>Thong tin dang nhap duoc ma hoa va chi hien thi sau khi thanh toan thanh cong.</span>
                        </div>

                        ${acc.credentials ? buildCredentialPanel(acc.credentials) : ''}
                    </aside>
                </section>
            </div>
        `;

        const buyBtn = document.getElementById('mxh-account-buy-btn');
        if (buyBtn) {
            buyBtn.addEventListener('click', async () => {
                buyBtn.disabled = true;
                const oldHtml = buyBtn.innerHTML;
                buyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Dang xu ly...';
                try {
                    const res = await api.post(`/mxh/accounts/${acc.id}/purchase`);
                    if (!res.success) throw new Error(res.message || 'Khong the mua tai khoan');
                    showToast('Mua tai khoan thanh cong!', 'success');
                    await loadAccount();
                } catch (error) {
                    showToast(error.message || 'Khong the mua tai khoan', 'error');
                    buyBtn.disabled = false;
                    buyBtn.innerHTML = oldHtml;
                }
            });
        }

        content.querySelectorAll('.mxh-account-thumb').forEach((btn) => {
            btn.addEventListener('click', () => {
                const image = btn.getAttribute('data-full') || '';
                const main = content.querySelector('.mxh-account-main-image img');
                if (main && image) {
                    main.src = image;
                    content.querySelectorAll('.mxh-account-thumb').forEach((thumb) => thumb.classList.toggle('active', thumb === btn));
                }
            });
        });

        content.querySelectorAll('.mxh-account-copy').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const text = btn.getAttribute('data-copy') || '';
                if (!text) return;
                try {
                    await navigator.clipboard.writeText(text);
                    showToast('Da copy', 'success');
                } catch (_) {
                    showToast('Khong the copy', 'error');
                }
            });
        });

        content.querySelectorAll('a[data-link]').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                window.router?.navigate(a.getAttribute('href'));
            });
        });
    }

    await loadAccount();
};
