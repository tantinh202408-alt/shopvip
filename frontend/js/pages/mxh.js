// ============================================
// MXH LIST PAGE — Trang mạng xã hội
// File: frontend/js/pages/mxh.js
// ============================================

window.pageInit = async function (params, query = {}) {
    // ── Platform definitions ──────────────────────────────────────────────
    // ── Platform definitions (Dynamic from categories) ─────────────────────
    const PLATFORM_META = {
        'facebook':  { label: 'Facebook',   icon: 'fab fa-facebook',     color: '#1877f2' },
        'tiktok':    { label: 'TikTok',     icon: 'fab fa-tiktok',       color: '#010101' },
        'instagram': { label: 'Instagram',  icon: 'fab fa-instagram',    color: '#e1306c' },
        'youtube':   { label: 'YouTube',    icon: 'fab fa-youtube',      color: '#ff0000' },
        'twitter':   { label: 'X / Twitter',icon: 'fab fa-x-twitter',    color: '#000000' },
        'zalo':      { label: 'Zalo',       icon: 'fas fa-comment-dots', color: '#0068ff' },
        'telegram':  { label: 'Telegram',   icon: 'fab fa-telegram',     color: '#26a5e4' },
        'other':     { label: 'Khác',       icon: 'fas fa-ellipsis',     color: '#64748b' }
    };
    let dynamicPlatforms = [];

    // ── State ─────────────────────────────────────────────────────────────
    let currentPlatform = query.platform || 'all';
    let currentCat      = query.category_id || query.mxh_category_id || query.category || '';
    let currentSort     = query.sort || 'newest';
    let currentPage     = parseInt(query.page || '1', 10) || 1;
    const initialAccountId = query.account_id || query.detail_id || query.purchase_id || '';
    const ALLOWED_PLATFORMS = ['facebook', 'tiktok', 'instagram'];

    function getPlatformMeta(platformId) {
        return PLATFORM_META[platformId] || PLATFORM_META.other;
    }

    function getPlatformCount(platformId) {
        if (!allCats.length) return 0;
        if (platformId === 'all') return allCats.length;
        return allCats.filter(cat => (cat.platform || 'other') === platformId).length;
    }

    function getCategoryMeta(cat) {
        const platformMeta = getPlatformMeta(cat.platform || 'other');
        return {
            icon: cat.icon || platformMeta.icon || 'fas fa-tag',
            color: cat.color || platformMeta.color || '#6366f1',
            platformLabel: platformMeta.label || 'Khác'
        };
    }

    // ── Render Platform Tabs ──────────────────────────────────────────────
    function renderPlatformTabs() {
        const tabs = document.getElementById('mxh-platform-tabs');
        if (!tabs) return;
        tabs.innerHTML = dynamicPlatforms.map(p => {
            const count = getPlatformCount(p.id);
            const isActive = currentPlatform === p.id;
            const subtitle = p.id === 'all' ? 'Tất cả danh mục' : `${count} danh mục`;
            return `
            <button class="mxh-tab-btn ${isActive ? 'active' : ''}" data-platform="${p.id}" style="--pcolor:${p.color}">
                <span class="mxh-tab-icon"><i class="${p.icon}"></i></span>
                <span class="mxh-tab-copy">
                    <strong>${escapeHtml(p.label)}</strong>
                </span>
                <span class="mxh-tab-count">${count}</span>
            </button>
        `;}).join('');
        tabs.querySelectorAll('.mxh-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPlatform = btn.dataset.platform;
                currentCat = '';
                currentPage = 1;
                loadAll();
                syncUrl();
            });
        });
    }

    // ── Render Sell Button (if seller/admin) ──────────────────────────────
    function renderSellBtn() {
        const wrap = document.getElementById('mxh-sell-btn-wrap');
        if (!wrap) return;
        const user = Auth.getCurrentUser?.();
        if (!user || !['admin', 'seller'].includes(user.role)) return;
        wrap.innerHTML = `
            <a href="/banmxh" data-link class="btn-primary mxh-sell-btn">
                <i class="fas fa-plus" style="margin-right:6px"></i>Đăng bán tài khoản
            </a>
        `;
        wrap.querySelector('a[data-link]')?.addEventListener('click', e => {
            e.preventDefault();
            window.router?.navigate('/banmxh');
        });
    }

    // ── Load Categories ───────────────────────────────────────────────────
    let allCats = [];
    async function loadCategories() {
        try {
            const res = await api.get('/mxh/categories');
            const apiCats = res.success ? (res.data || []) : [];
            allCats = apiCats.filter(c => ALLOWED_PLATFORMS.includes(c.platform || ''));
            
            dynamicPlatforms = [
                { id: 'all', label: 'Tất cả', icon: 'fas fa-globe', color: '#6366f1' },
                ...ALLOWED_PLATFORMS.map(pKey => ({
                    id: pKey,
                    label: PLATFORM_META[pKey]?.label || (pKey.charAt(0).toUpperCase() + pKey.slice(1)),
                    icon: PLATFORM_META[pKey]?.icon || 'fas fa-share-nodes',
                    color: PLATFORM_META[pKey]?.color || '#6366f1'
                }))
            ];
            
            renderPlatformTabs();
        } catch (e) { console.error('Error loading cats:', e); allCats = []; }
        renderCategoryChips();
    }

    function renderCategoryChips() {
        const wrap = document.getElementById('mxh-category-chips');
        if (!wrap) return;

        // Hide the second row only when the user is truly browsing everything.
        if (currentPlatform === 'all' && !currentCat) {
            wrap.style.display = 'none';
            return;
        }

        const visible = currentPlatform === 'all'
            ? allCats
            : allCats.filter(c => c.platform === currentPlatform);

        // If only 1 category in this platform and it's basically the platform name, hide
        if (visible.length <= 1) {
            wrap.style.display = 'none';
            return;
        }

        wrap.style.display = 'flex';
        wrap.innerHTML = `
            <button class="mxh-chip ${!currentCat ? 'active' : ''}" data-cat="">
                <span class="mxh-chip-icon"><i class="fas fa-layer-group"></i></span>
                <span class="mxh-chip-copy">
                    <strong>Tất cả loại</strong>
                </span>
            </button>
            ${visible.map(c => {
                const meta = getCategoryMeta(c);
                const isActive = currentCat === String(c.id);
                return `
                <button class="mxh-chip ${isActive ? 'active' : ''}" data-cat="${c.id}" style="--chip-color:${meta.color}">
                    <span class="mxh-chip-icon"><i class="${meta.icon}"></i></span>
                    <span class="mxh-chip-copy">
                        <strong>${escapeHtml(c.name)}</strong>
                    </span>
                </button>
            `;}).join('')}
        `;

        wrap.querySelectorAll('.mxh-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                currentCat = btn.dataset.cat;
                currentPage = 1;
                loadAccounts();
                syncUrl();
                renderCategoryChips(); // Update active state
            });
        });
    }

    // ── Load Accounts ─────────────────────────────────────────────────────
    async function loadAccounts() {
        const grid = document.getElementById('mxh-grid');
        if (!grid) return;

        showLoading('mxh-grid');

        try {
            const params = { page: currentPage, limit: 12, sort: currentSort };
            if (currentPlatform !== 'all') {
            params.platform = currentPlatform; // Backend filters by platform field now
        }
            if (currentCat) params.mxh_category_id = currentCat;

            const res = await api.get('/mxh/accounts', params);
            const accounts = res.success ? (res.data?.accounts || res.data || []) : [];
            const pagination = res.success ? res.data?.pagination : null;

            renderAccountGrid(accounts, grid);
            renderPagination(pagination);
        } catch (err) {
            grid.innerHTML = `
                <div class="mxh-empty">
                    <i class="fas fa-triangle-exclamation"></i>
                    <p>Không thể tải danh sách tài khoản</p>
                </div>
            `;
        }
    }

    function renderAccountGrid(accounts, grid) {
        if (!accounts.length) {
            grid.innerHTML = `
                <div class="mxh-empty">
                    <i class="fas fa-share-nodes"></i>
                    <p>Chưa có tài khoản nào được đăng bán</p>
                    ${Auth.getCurrentUser?.()?.role && ['admin','seller'].includes(Auth.getCurrentUser().role)
                        ? '<a href="/banmxh" data-link class="btn-primary" style="margin-top:12px;display:inline-flex">Đăng bán ngay</a>'
                        : ''}
                </div>
            `;
            grid.querySelectorAll('a[data-link]').forEach(a => {
                a.addEventListener('click', e => { e.preventDefault(); window.router?.navigate('/banmxh'); });
            });
            return;
        }

        grid.innerHTML = accounts.map(acc => renderAccountCard(acc)).join('');
        grid.querySelectorAll('.mxh-account-card').forEach(card => {
            card.addEventListener('click', () => openDetailModal(card.dataset.id));
        });
        grid.querySelectorAll('.mxh-card-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openDetailModal(btn.dataset.id, {
                    focusBuy: btn.dataset.buyable === '1'
                });
            });
        });
    }

    function renderAccountCard(acc) {
        const platform = dynamicPlatforms.find(p => p.id === acc.category_slug) || dynamicPlatforms[0];
        const img = acc.main_image || acc.images?.[0] || '';
        const availableCount = Number(acc.available_count ?? (acc.status === 'active' ? 1 : 0));
        const isSold = availableCount <= 0 || acc.status === 'sold';
        const user = Auth.getCurrentUser?.();
        const canBuy = !!user && !isSold;
        const actionLabel = !user ? 'Đăng nhập để mua' : (isSold ? 'Đã bán' : 'Mua ngay');
        const actionIcon = !user ? 'right-to-bracket' : (isSold ? 'ban' : 'bolt');
        return `
            <div class="mxh-account-card ${isSold ? 'is-sold' : ''}" data-id="${acc.id}" role="button" tabindex="0">
                <div class="mxh-card-img-wrap">
                    ${img
                        ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(acc.title)}" class="mxh-card-img" loading="lazy">`
                        : `<div class="mxh-card-no-img" style="background:${platform.color}20">
                                <i class="${platform.icon}" style="color:${platform.color};font-size:40px"></i>
                           </div>`
                    }
                    <div class="mxh-card-platform-badge" style="background:${platform.color}">
                        <i class="${platform.icon}"></i>
                        ${escapeHtml(platform.label)}
                    </div>
                    ${isSold ? '<div class="mxh-card-sold-overlay"><span>Đã bán</span></div>' : ''}
                </div>
                <div class="mxh-card-body">
                    <div class="mxh-card-cat">${escapeHtml(acc.category_name || acc.mxh_category_name || 'Tài khoản')}</div>
                    <div class="mxh-card-title">${escapeHtml(acc.title)}</div>
                    <div class="mxh-card-footer">
                        <div class="mxh-card-price">${formatMoney(acc.price)}</div>
                        <div class="mxh-card-qty ${isSold ? 'is-sold' : ''}">
                            <i class="fas fa-${isSold ? 'ban' : 'box'}"></i> ${isSold ? 'Đã bán' : 'Còn 1 tài khoản'}
                        </div>
                    </div>
                    <div class="mxh-card-actions">
                        <button type="button" class="mxh-card-action-btn ${canBuy ? 'is-buy' : ''}" data-id="${acc.id}" data-buyable="${canBuy ? '1' : '0'}">
                            <i class="fas fa-${actionIcon}"></i> ${escapeHtml(actionLabel)}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Detail Modal ──────────────────────────────────────────────────────
    async function openDetailModal(id, options = {}) {
        if (window.appInstance && typeof window.appInstance.closeAccountDrawer === 'function') {
            window.appInstance.closeAccountDrawer({ persist: false });
        }
        const modal   = document.getElementById('mxh-detail-modal');
        const content = document.getElementById('mxh-detail-content');
        if (!modal || !content) return;

        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        content.innerHTML = `
            <div class="mxh-detail-loading">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
        `;

        try {
            const res = await api.get(`/mxh/accounts/${id}`);
            if (!res.success) throw new Error(res.message || 'Không thể tải chi tiết');
            renderDetail(res.data, content, options);
        } catch (err) {
            content.innerHTML = `<div class="mxh-detail-error"><i class="fas fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
        }
    }

    function renderDetail(acc, container, options = {}) {
        const platform = dynamicPlatforms.find(p => p.id === acc.category_slug) || dynamicPlatforms[0];
        const availableCount = Number(acc.available_count ?? (acc.status === 'active' ? 1 : 0));
        const isSold = availableCount <= 0 || acc.status === 'sold';
        const images = Array.isArray(acc.images) ? acc.images : (acc.main_image ? [acc.main_image] : []);
        const user = Auth.getCurrentUser?.();
        const canBuy = user && !isSold;
        const hasMoreThanOneImage = images.length > 1;

        container.innerHTML = `
            <div class="mxhd">
                <!-- Left: Images -->
                <div class="mxhd-left">
                    <div class="mxhd-img-main">
                        ${images[0]
                            ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(acc.title)}" id="mxhd-main-img">`
                            : `<div class="mxhd-no-img" style="background:${platform.color}15">
                                    <i class="${platform.icon}" style="color:${platform.color};font-size:60px"></i>
                               </div>`
                        }
                        <div class="mxhd-platform-tag" style="background:${platform.color}">
                            <i class="${platform.icon}"></i> ${escapeHtml(platform.label)}
                        </div>
                        ${isSold ? '<div class="mxhd-sold-ribbon">Đã bán hết</div>' : ''}
                    </div>
                    ${images.length > 1 ? `
                        <div class="mxhd-img-thumbs">
                            ${images.map((img, i) => `
                                <img src="${escapeHtml(img)}" alt="Ảnh ${i+1}"
                                    class="mxhd-thumb ${i === 0 ? 'active' : ''}"
                                    data-full="${escapeHtml(img)}"
                                    onclick="document.getElementById('mxhd-main-img').src=this.dataset.full;
                                             document.querySelectorAll('.mxhd-thumb').forEach(t=>t.classList.remove('active'));
                                             this.classList.add('active')">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <!-- Right: Info -->
                <div class="mxhd-right">
                    <div class="mxhd-cat">${escapeHtml(acc.category_name || acc.mxh_category_name || '')}</div>
                    <h2 class="mxhd-title">${escapeHtml(acc.title)}</h2>

                    <div class="mxhd-meta-row">
                        <div class="mxhd-price">${formatMoney(acc.price)}</div>
                        <div class="mxhd-qty-badge ${isSold ? 'sold' : ''}">
                            <i class="fas fa-${isSold ? 'ban' : 'layer-group'}"></i>
                            ${isSold ? 'Hết hàng' : 'Còn 1 tài khoản'}
                        </div>
                    </div>

                    <!-- Seller info -->
                    <div class="mxhd-seller">
                        <i class="fas fa-store"></i>
                        <span>Người bán: <strong>${escapeHtml(acc.seller_name || 'Ẩn danh')}</strong></span>
                    </div>

                    <!-- Stats row -->
                    <div class="mxhd-stats">
                        <div class="mxhd-stat">
                            <i class="fas fa-eye"></i>
                            <span>${acc.view_count || 0} lượt xem</span>
                        </div>
                        <div class="mxhd-stat">
                            <i class="fas fa-shopping-bag"></i>
                            <span>${acc.purchase_count || 0} đã bán</span>
                        </div>
                        <div class="mxhd-stat">
                            <i class="fas fa-clock"></i>
                            <span>${acc.created_at ? formatDateShort(acc.created_at) : ''}</span>
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="mxhd-desc-box">
                        <div class="mxhd-desc-label"><i class="fas fa-align-left"></i> Mô tả</div>
                        <div class="mxhd-desc">${escapeHtml(acc.description || '').replace(/\n/g, '<br>')}</div>
                    </div>

                    <!-- Tags/features -->
                    ${acc.tags?.length ? `
                        <div class="mxhd-tags">
                            ${acc.tags.map(t => `<span class="mxhd-tag">#${escapeHtml(t)}</span>`).join('')}
                        </div>
                    ` : ''}

                    <!-- Actions -->
                    <div class="mxhd-actions">
                        ${!user ? `
                            <a href="/login" data-link class="btn-primary mxhd-buy-btn">
                                <i class="fas fa-right-to-bracket" style="margin-right:8px"></i>Đăng nhập để mua
                            </a>
                        ` : canBuy ? `
                            <button type="button" class="btn-primary mxhd-buy-btn" id="mxhd-buy-btn" data-id="${acc.id}">
                                <i class="fas fa-bolt" style="margin-right:8px"></i>Mua ngay — ${formatMoney(acc.price)}
                            </button>
                        ` : `
                            <button type="button" class="btn-primary mxhd-buy-btn" disabled>
                                <i class="fas fa-ban" style="margin-right:8px"></i>Đã bán hết
                            </button>
                        `}
                        <button type="button" class="btn-outline mxhd-report-btn" data-id="${acc.id}">
                            <i class="fas fa-flag"></i>
                        </button>
                    </div>

                    <!-- Security note -->
                    <div class="mxhd-security-note">
                        <i class="fas fa-shield-halved"></i>
                        <span>Thông tin đăng nhập được mã hóa và chỉ hiển thị sau khi thanh toán thành công.</span>
                    </div>
                </div>
            </div>

                    ${acc.credentials ? buildCredentialReveal(acc.credentials) : ''}

            ${images.length ? `
                <div class="mxhd-gallery-section">
                    <div class="mxhd-gallery-head">
                        <div>
                            <h3>Thư viện ảnh</h3>
                            <p>Bấm vào từng ảnh để xem lớn, rõ hơn.</p>
                        </div>
                        <span class="mxhd-gallery-count">${images.length} ảnh</span>
                    </div>
                    <div class="mxhd-gallery-grid">
                        ${images.map((img, i) => `
                            <button type="button"
                                class="mxhd-gallery-card"
                                data-full="${escapeHtml(img)}"
                                data-title="${escapeHtml(acc.title)} - Ảnh ${i + 1}">
                                <img src="${escapeHtml(img)}" alt="Ảnh ${i + 1}" loading="lazy">
                                <span class="mxhd-gallery-badge">${i === 0 ? 'Ảnh bìa' : `Ảnh ${i + 1}`}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div id="mxhd-image-lightbox" class="mxhd-image-lightbox" aria-hidden="true">
                <div class="mxhd-image-lightbox-backdrop" data-close="1"></div>
                <div class="mxhd-image-lightbox-panel" role="dialog" aria-modal="true" aria-label="Xem ảnh lớn">
                    <button type="button" class="mxhd-image-lightbox-close" data-close="1" aria-label="Đóng">
                        <i class="fas fa-xmark"></i>
                    </button>
                    <img id="mxhd-image-lightbox-img" src="" alt="">
                    <div class="mxhd-image-lightbox-caption" id="mxhd-image-lightbox-caption"></div>
                </div>
            </div>
        `;

        // Buy button
        const buyBtn = container.querySelector('#mxhd-buy-btn');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => handleBuy(acc, buyBtn));
        }

        if (options.focusBuy && buyBtn) {
            window.setTimeout(() => {
                buyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                buyBtn.focus({ preventScroll: true });
            }, 120);
        }

        const lightbox = container.querySelector('#mxhd-image-lightbox');
        const lightboxImg = container.querySelector('#mxhd-image-lightbox-img');
        const lightboxCaption = container.querySelector('#mxhd-image-lightbox-caption');
        const closeLightbox = () => {
            if (!lightbox) return;
            lightbox.classList.remove('active');
            lightbox.setAttribute('aria-hidden', 'true');
        };
        const openLightbox = (src, caption) => {
            if (!lightbox || !lightboxImg) return;
            lightboxImg.src = src;
            if (lightboxCaption) lightboxCaption.textContent = caption || '';
            lightbox.classList.add('active');
            lightbox.setAttribute('aria-hidden', 'false');
        };

        container.querySelectorAll('.mxhd-gallery-card').forEach((btn) => {
            btn.addEventListener('click', () => {
                openLightbox(btn.dataset.full || '', btn.dataset.title || '');
            });
        });

        container.querySelectorAll('[data-close="1"]').forEach((el) => {
            el.addEventListener('click', closeLightbox);
        });

        // Login link
        container.querySelectorAll('a[data-link]').forEach(a => {
            a.addEventListener('click', e => {
                e.preventDefault();
                closeDetailModal();
                window.router?.navigate(a.getAttribute('href'));
            });
        });
    }

    function buildCredentialReveal(creds = {}) {
        const hasBackupEmail = Boolean(creds.backup_email);
        const hasBackupPassword = Boolean(creds.backup_email_password);
        const hasCookie = Boolean(creds.cookie);
        const hasExtraInfo = Boolean(creds.extra_info);
        const summaryItems = [
            { label: 'Email/SDT', value: creds.account_email, icon: 'fa-envelope' },
            { label: 'Mat khau', value: creds.account_password, icon: 'fa-lock' },
            hasBackupEmail ? { label: 'Backup', value: creds.backup_email, icon: 'fa-envelope-circle-check' } : null,
            hasBackupPassword ? { label: 'MK backup', value: creds.backup_email_password, icon: 'fa-key' } : null,
            hasCookie ? { label: 'Cookie', value: 'Co', icon: 'fa-cookie-bite' } : null,
            hasExtraInfo ? { label: 'Ghi chu', value: 'Co', icon: 'fa-circle-info' } : null
        ].filter(Boolean);

        return `
            <div class="mxhd-cred-reveal">
                <div class="mxhd-cred-banner">
                    <div class="mxhd-cred-banner-icon">
                        <i class="fas fa-circle-check"></i>
                    </div>
                    <div class="mxhd-cred-banner-copy">
                        <div class="mxhd-cred-eyebrow">Giao dịch hoàn tất</div>
                        <h3>Thông tin tài khoản này </h3>
                    </div>
                    <div class="mxhd-cred-status">
                        <i class="fas fa-shield-halved"></i>
                        <span>đã xác minh</span>
                    </div>
                </div>
                <div class="mxhd-cred-summary">
                    ${summaryItems.map(item => `
                        <div class="mxhd-cred-chip">
                            <i class="fas ${item.icon}"></i>
                            <span>${escapeHtml(item.label)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mxhd-cred-grid">
                    <div class="mxhd-cred-row">
                        <span class="mxhd-cred-label"><i class="fas fa-envelope"></i> Email/SDT dang nhap</span>
                        <div class="mxhd-cred-val-wrap">
                            <code class="mxhd-cred-val">${escapeHtml(creds.account_email || '')}</code>
                            <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.account_email || '')}');showToast('Da copy','success')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    <div class="mxhd-cred-row">
                        <span class="mxhd-cred-label"><i class="fas fa-lock"></i> Mat khau</span>
                        <div class="mxhd-cred-val-wrap">
                            <code class="mxhd-cred-val">${escapeHtml(creds.account_password || '')}</code>
                            <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.account_password || '')}');showToast('Da copy','success')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    ${hasBackupEmail ? `
                    <div class="mxhd-cred-row">
                        <span class="mxhd-cred-label"><i class="fas fa-envelope-circle-check"></i> Email backup</span>
                        <div class="mxhd-cred-val-wrap">
                            <code class="mxhd-cred-val">${escapeHtml(creds.backup_email)}</code>
                            <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.backup_email)}');showToast('Da copy','success')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>` : ''}
                    ${hasBackupPassword ? `
                    <div class="mxhd-cred-row">
                        <span class="mxhd-cred-label"><i class="fas fa-key"></i> MK email backup</span>
                        <div class="mxhd-cred-val-wrap">
                            <code class="mxhd-cred-val">${escapeHtml(creds.backup_email_password)}</code>
                            <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.backup_email_password)}');showToast('Da copy','success')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>` : ''}
                    ${hasCookie ? `
                    <div class="mxhd-cred-row full">
                        <span class="mxhd-cred-label"><i class="fas fa-cookie"></i> Cookie</span>
                        <div class="mxhd-cred-val-wrap">
                            <code class="mxhd-cred-val mxhd-cred-cookie">${escapeHtml(creds.cookie)}</code>
                            <button class="mxhd-copy-btn" onclick="copyToClipboard(this.previousElementSibling.textContent);showToast('Da copy cookie','success')">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>` : ''}
                    ${hasExtraInfo ? `
                    <div class="mxhd-cred-row full">
                        <span class="mxhd-cred-label"><i class="fas fa-circle-info"></i> Thong tin them</span>
                        <code class="mxhd-cred-val mxhd-cred-note">${escapeHtml(creds.extra_info)}</code>
                    </div>` : ''}
                </div>
                <div class="mxhd-cred-footer">
                    <div class="mxhd-cred-warning">
                        <i class="fas fa-triangle-exclamation"></i>
                        <span>Hay luu thong tin ngay. Trang nay khong luu sau khi dong.</span>
                    </div>
                </div>
            </div>
        `;
    }

    async function handleBuy(acc, btn) {
        if (window.appInstance && typeof window.appInstance.closeAccountDrawer === 'function') {
            window.appInstance.closeAccountDrawer({ persist: false });
        }
        if (!confirm(`Xác nhận mua tài khoản "${acc.title}" với giá ${formatMoney(acc.price)}?`)) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Đang xử lý...';

        try {
            const res = await api.post(`/mxh/accounts/${acc.id}/purchase`);
            if (!res.success) throw new Error(res.message || 'Không thể mua tài khoản');

            // Show credentials to buyer
            const creds = res.data.credentials;
            const content = document.getElementById('mxh-detail-content');
            if (content) {
                const hasBackupEmail = Boolean(creds.backup_email);
                const hasBackupPassword = Boolean(creds.backup_email_password);
                const hasCookie = Boolean(creds.cookie);
                const hasExtraInfo = Boolean(creds.extra_info);
                const summaryItems = [
                    { label: 'Email/SĐT', value: creds.account_email, icon: 'fa-envelope' },
                    { label: 'Mật khẩu', value: creds.account_password, icon: 'fa-lock' },
                    hasBackupEmail ? { label: 'Backup', value: creds.backup_email, icon: 'fa-envelope-circle-check' } : null,
                    hasBackupPassword ? { label: 'MK backup', value: creds.backup_email_password, icon: 'fa-key' } : null,
                    hasCookie ? { label: 'Cookie', value: 'Có', icon: 'fa-cookie-bite' } : null,
                    hasExtraInfo ? { label: 'Ghi chú', value: 'Có', icon: 'fa-circle-info' } : null
                ].filter(Boolean);

                const credBox = document.createElement('div');
                credBox.className = 'mxhd-cred-reveal';
                credBox.innerHTML = `
                    <div class="mxhd-cred-banner">
                        <div class="mxhd-cred-banner-icon">
                            <i class="fas fa-circle-check"></i>
                        </div>
                        <div class="mxhd-cred-banner-copy">
                            <div class="mxhd-cred-eyebrow">Giao dịch hoàn tất</div>
                            <h3>Thông tin tài khoản đã mở khóa</h3>
                            <p>Lưu lại ngay. Thông tin này chỉ hiển thị sau khi thanh toán thành công.</p>
                        </div>
                        <div class="mxhd-cred-status">
                            <i class="fas fa-shield-halved"></i>
                            <span>Đã xác minh</span>
                        </div>
                    </div>
                    <div class="mxhd-cred-summary">
                        ${summaryItems.map(item => `
                            <div class="mxhd-cred-chip">
                                <i class="fas ${item.icon}"></i>
                                <span>${escapeHtml(item.label)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mxhd-cred-grid">
                        <div class="mxhd-cred-row">
                            <span class="mxhd-cred-label"><i class="fas fa-envelope"></i> Email/SĐT đăng nhập</span>
                            <div class="mxhd-cred-val-wrap">
                                <code class="mxhd-cred-val">${escapeHtml(creds.account_email || '')}</code>
                                <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.account_email || '')}');showToast('Đã copy','success')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mxhd-cred-row">
                            <span class="mxhd-cred-label"><i class="fas fa-lock"></i> Mật khẩu</span>
                            <div class="mxhd-cred-val-wrap">
                                <code class="mxhd-cred-val">${escapeHtml(creds.account_password || '')}</code>
                                <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.account_password || '')}');showToast('Đã copy','success')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        ${hasBackupEmail ? `
                        <div class="mxhd-cred-row">
                            <span class="mxhd-cred-label"><i class="fas fa-envelope-circle-check"></i> Email backup</span>
                            <div class="mxhd-cred-val-wrap">
                                <code class="mxhd-cred-val">${escapeHtml(creds.backup_email)}</code>
                                <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.backup_email)}');showToast('Đã copy','success')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>` : ''}
                        ${hasBackupPassword ? `
                        <div class="mxhd-cred-row">
                            <span class="mxhd-cred-label"><i class="fas fa-key"></i> MK email backup</span>
                            <div class="mxhd-cred-val-wrap">
                                <code class="mxhd-cred-val">${escapeHtml(creds.backup_email_password)}</code>
                                <button class="mxhd-copy-btn" onclick="copyToClipboard('${escapeHtml(creds.backup_email_password)}');showToast('Đã copy','success')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>` : ''}
                        ${hasCookie ? `
                        <div class="mxhd-cred-row full">
                            <span class="mxhd-cred-label"><i class="fas fa-cookie"></i> Cookie</span>
                            <div class="mxhd-cred-val-wrap">
                                <code class="mxhd-cred-val mxhd-cred-cookie">${escapeHtml(creds.cookie)}</code>
                                <button class="mxhd-copy-btn" onclick="copyToClipboard(this.previousElementSibling.textContent);showToast('Đã copy cookie','success')">
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>` : ''}
                        ${hasExtraInfo ? `
                        <div class="mxhd-cred-row full">
                            <span class="mxhd-cred-label"><i class="fas fa-circle-info"></i> Thông tin thêm</span>
                            <code class="mxhd-cred-val mxhd-cred-note">${escapeHtml(creds.extra_info)}</code>
                        </div>` : ''}
                    </div>
                    <div class="mxhd-cred-footer">
                        <div class="mxhd-cred-warning">
                            <i class="fas fa-triangle-exclamation"></i>
                            <span>Lưu thông tin ngay. Trang này không lưu sau khi đóng.</span>
                        </div>
                    </div>
                `;
                content.querySelector('.mxhd')?.prepend(credBox);
                credBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            showToast('Mua tài khoản thành công! 🎉', 'success');
            loadAccounts(); // refresh grid

        } catch (err) {
            showToast(err.message || 'Không thể mua tài khoản', 'error');
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-bolt" style="margin-right:8px"></i>Mua ngay — ${formatMoney(acc.price)}`;
        }
    }

    function closeDetailModal() {
        const modal = document.getElementById('mxh-detail-modal');
        if (modal) modal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }

    // ── Pagination ────────────────────────────────────────────────────────
    function renderPagination(pagination) {
        const container = document.getElementById('mxh-pagination');
        if (!container || !pagination || pagination.totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = `<button ${pagination.page === 1 ? 'disabled' : ''} onclick="mxhGoPage(${pagination.page - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>`;

        for (let i = 1; i <= pagination.totalPages; i++) {
            if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 2 && i <= pagination.page + 2)) {
                html += `<button class="${i === pagination.page ? 'active' : ''}" onclick="mxhGoPage(${i})">${i}</button>`;
            } else if (i === pagination.page - 3 || i === pagination.page + 3) {
                html += '<span>...</span>';
            }
        }

        html += `<button ${pagination.page === pagination.totalPages ? 'disabled' : ''} onclick="mxhGoPage(${pagination.page + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>`;

        container.innerHTML = html;
    }

    window.mxhGoPage = (page) => {
        currentPage = page;
        syncUrl();
        loadAccounts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Sort ──────────────────────────────────────────────────────────────
    function bindSort() {
        const sortSel = document.getElementById('mxh-sort');
        if (!sortSel) return;
        sortSel.value = currentSort;
        sortSel.addEventListener('change', () => {
            currentSort = sortSel.value;
            currentPage = 1;
            loadAccounts();
            syncUrl();
        });
    }

    // ── URL sync ──────────────────────────────────────────────────────────
    function syncUrl() {
        const qs = new URLSearchParams();
        if (currentPlatform !== 'all') qs.set('platform', currentPlatform);
        if (currentCat) qs.set('category_id', currentCat);
        if (currentSort !== 'newest') qs.set('sort', currentSort);
        if (currentPage > 1) qs.set('page', currentPage);
        const url = qs.toString() ? `/mxh?${qs}` : '/mxh';
        window.history.replaceState({}, '', url);
    }

    // ── Modal close ───────────────────────────────────────────────────────
    document.getElementById('mxh-detail-close')?.addEventListener('click', closeDetailModal);
    document.getElementById('mxh-detail-modal')?.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeDetailModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeDetailModal();
    });

    // ── Load all ──────────────────────────────────────────────────────────
    async function loadAll() {
        renderPlatformTabs();
        renderCategoryChips();
        await loadAccounts();
    }

    // ── Init ─────────────────────────────────────────────────────────────
    bindSort();
    await loadCategories(); // This will call renderPlatformTabs and renderCategoryChips
    await loadAccounts();
    if (initialAccountId) {
        await openDetailModal(initialAccountId);
    }

    window.pageCleanup = () => {
        delete window.mxhGoPage;
    };
};
