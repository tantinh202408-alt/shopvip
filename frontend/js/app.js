// ============================================
// MAIN APPLICATION
// File: frontend/js/app.js
// ============================================

class App {
    constructor() {
        this.router = null;
        this.currentUser = null;
        this.checkAuthPromise = null;
        this.aiChatOpen = false;
        this.aiChatBusy = false;
        this.notificationPollTimer = null;
        this.notificationPollIntervalMs = 60000;
        this.notificationsHydrated = false;
        this.notificationIdSet = new Set();
        this.activeImportantNoticeId = null;
        this.browserNotifiedIds = new Set();
        this.accountDrawerStorageKey = 'account-side-menu-state';
        this.accountDrawerCategoriesStorageKey = 'account-side-menu-categories-state';
        this.accountMenuCategories = null;
        this.accountMenuExtraLinks = [];
        this.accountMenuConfigLoaded = false;
        this.accountSideMenuTemplate = '';
        this.accountMenuResizeObserver = null;
        this.anonymousVisitorBootstrapped = false;
        this.anonymousVisitorBootstrapPromise = null;
        this.balancePollIntervalMs = 120000;
        this.themeStorageKey = 'site-theme-mode';
        this.themeMode = 'light';
        this.handleAccountMenuResize = () => {
            this.syncAccountSideMenuLayout();
        };
        this.handleAccountMenuScroll = () => {
            this.syncAccountSideMenuLayout();
        };
        this.lockedFeatures = new Set();
    }

    async init() {
        try {
            this.initTheme();

            // Khởi chạy đồng thời các tác vụ tải tài nguyên/cấu hình ban đầu để tối ưu tốc độ load
            const layoutPromise = this.loadLayout();
            const configPromise = this.loadAccountMenuConfig();
            const noticePromise = this.loadStartupImportantNotice();
            const locksPromise = this.syncLockedFeatures();

            // Chờ phần layout chính (header/footer) được đưa vào DOM
            await layoutPromise;

            // Render phần thông tin người dùng từ localStorage ngay lập tức để giảm thời gian phản hồi giao diện
            this.updateUserSection();

            // Khởi tạo router và xử lý route ngay để hiển thị trang đích nhanh nhất
            this.initRouter();
            window.router = this.router;
            router = this.router;
            const routePromise = this.router.handleRoute();

            // Kiểm tra phiên đăng nhập (auth check) âm thầm dưới background
            const authPromise = this.checkAuth();

            this.initAiWidget();
            window.PublicIpManager?.warmup?.();

            // Đợi tất cả cấu hình nền, route và auth check hoàn thành
            await Promise.all([
                configPromise,
                noticePromise,
                locksPromise,
                routePromise,
                authPromise
            ]);

            // Cập nhật lại giao diện người dùng & menu bên sau khi đã có dữ liệu chính xác từ server
            this.updateUserSection();

            this.startBalanceSync();
            void this.bootstrapAnonymousVisitor();

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.stopNotificationSync();
                    this.stopBalanceSync();
                    return;
                }
                // Resume background sync when tab is active again
                this.startBalanceSync();
                this.startNotificationSync();
            });

            window.addEventListener('popstate', () => {
                this.router.handleRoute();
            });

        } catch (error) {
            console.error('App init error:', error);
            showToast('Có lỗi khi khởi động ứng dụng', 'error');
        }
    }

    async fetchProtectedMarkup(assetPath) {
        try {
            if (window.ProtectedAssets && typeof window.ProtectedAssets.fetchTextAsset === 'function') {
                return await window.ProtectedAssets.fetchTextAsset(assetPath);
            }
        } catch (error) {
            console.warn('Protected asset failed, fallback to direct fetch:', assetPath, error);
        }

        return fetch(assetPath, { credentials: 'include' }).then(r => r.text());
    }

    async syncLockedFeatures() {
        try {
            const features = ['deposit', 'withdraw', 'spin', 'checkin', 'mission', 'community', 'mxh'];
            const keys = features.map(f => `feature_lock_${f}`).join(',');
            const res = await api.get('/settings', { keys });
            if (res.success) {
                this.lockedFeatures.clear();
                features.forEach(f => {
                    const val = res.data[`feature_lock_${f}`];
                    if (val === 'true' || val === '1') {
                        this.lockedFeatures.add(f);
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to sync feature locks:', error);
        }
    }

    isFeatureLocked(feature) {
        return this.lockedFeatures.has(feature);
    }

    async loadLayout() {
        const [headerHTML, footerHTML, accountSideMenuHTML] = await Promise.all([
            this.fetchProtectedMarkup('/pages/header.html'),
            this.fetchProtectedMarkup('/pages/footer.html'),
            this.fetchProtectedMarkup('/pages/account-side-menu.html')
                .catch(() => '')
        ]);

        document.getElementById('header-container').innerHTML = headerHTML;
        document.getElementById('footer-container').innerHTML = footerHTML;
        this.accountSideMenuTemplate = accountSideMenuHTML || '';

        this.bindHeaderEvents();
        this.initAccountMenuLayoutObservers();
        window.addEventListener('resize', this.handleAccountMenuResize);
        window.addEventListener('scroll', this.handleAccountMenuScroll, { passive: true });
        await this.loadFooterSettings();
    }

    initAccountMenuLayoutObservers() {
        if (this.accountMenuResizeObserver || typeof ResizeObserver === 'undefined') {
            return;
        }

        this.accountMenuResizeObserver = new ResizeObserver(() => {
            this.syncAccountSideMenuLayout();
        });

        ['main-content', 'footer-container', 'header-container'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                this.accountMenuResizeObserver.observe(el);
            }
        });
    }

    async loadFooterSettings() {
        try {
            const response = await api.get('/settings', {
                keys: [
                    'contact_button_text',
                    'contact_button_link',
                    'footer_title',
                    'footer_subtitle',
                    'footer_links_title',
                    'footer_links',
                    'footer_contact_title',
                    'footer_contact_email',
                    'footer_copyright'
                ].join(',')
            });
            if (!response.success) return;
            const text = response.data.contact_button_text || '';
            const link = response.data.contact_button_link || '';
            const container = document.getElementById('contact-button');
            if (!container) return;
            if (!text || !link) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = `
                <a class="btn btn-outline" href="${link}" target="_blank" rel="noopener noreferrer">
                    ${text}
                </a>
            `;

            const titleEl = document.getElementById('footer-title');
            const subtitleEl = document.getElementById('footer-subtitle');
            const linksTitleEl = document.getElementById('footer-links-title');
            const linksEl = document.getElementById('footer-links');
            const contactTitleEl = document.getElementById('footer-contact-title');
            const contactEmailEl = document.getElementById('footer-contact-email');
            const copyrightEl = document.getElementById('footer-copyright');

            if (titleEl && response.data.footer_title) titleEl.textContent = response.data.footer_title;
            if (subtitleEl && response.data.footer_subtitle) subtitleEl.textContent = response.data.footer_subtitle;
            if (linksTitleEl && response.data.footer_links_title) linksTitleEl.textContent = response.data.footer_links_title;
            if (contactTitleEl && response.data.footer_contact_title) contactTitleEl.textContent = response.data.footer_contact_title;
            if (contactEmailEl && response.data.footer_contact_email) contactEmailEl.textContent = response.data.footer_contact_email;
            if (copyrightEl && response.data.footer_copyright) copyrightEl.textContent = response.data.footer_copyright;

            if (linksEl && response.data.footer_links) {
                const items = response.data.footer_links
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(line => {
                        const parts = line.split('|').map(p => p.trim());
                        return { text: parts[0], href: parts[1] || '#' };
                    });
                if (items.length) {
                    linksEl.innerHTML = items.map(item => `
                        <li><a href="${item.href}" data-link>${item.text}</a></li>
                    `).join('');
                    linksEl.querySelectorAll('a[data-link]').forEach(linkEl => {
                        linkEl.addEventListener('click', (e) => {
                            e.preventDefault();
                            const path = linkEl.getAttribute('href');
                            this.router.navigate(path);
                        });
                    });
                }
            }
        } catch (error) {
            // ignore
        }
    }

    bindHeaderEvents() {
        this.bindThemeToggle();

        // Search form
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const keyword = e.target.querySelector('input').value;
                if (keyword.trim()) {
                    this.router.navigate(`/?search=${encodeURIComponent(keyword)}`);
                }
            });
        }

        // Navigation links
        document.querySelectorAll('a[data-link]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = e.target.closest('a').getAttribute('href');
                this.router.navigate(path);
            });
        });

        // NOTE: Do NOT call updateUserSection() here.
        // checkAuth() will call it after fetching fresh data from the API.
    }

    initTheme() {
        const saved = localStorage.getItem(this.themeStorageKey);
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved === 'light' || saved === 'dark' ? saved : (prefersDark ? 'dark' : 'light');
        this.applyTheme(theme, { persist: false });
    }

    applyTheme(theme, { persist = true } = {}) {
        const normalized = theme === 'dark' ? 'dark' : 'light';
        this.themeMode = normalized;
        document.documentElement.dataset.theme = normalized;
        document.documentElement.style.colorScheme = normalized;
        if (persist) {
            localStorage.setItem(this.themeStorageKey, normalized);
        }
        this.updateThemeToggle();
    }

    toggleTheme() {
        this.applyTheme(this.themeMode === 'dark' ? 'light' : 'dark');
    }

    bindThemeToggle() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;

        button.addEventListener('click', () => {
            this.toggleTheme();
        });

        this.updateThemeToggle();
    }

    updateThemeToggle() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;

        const icon = button.querySelector('i');
        const label = button.querySelector('span');
        const isDark = this.themeMode === 'dark';
        button.setAttribute('aria-pressed', String(isDark));
        button.title = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
        button.setAttribute('aria-label', button.title);
        if (icon) {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
        if (label) {
            label.textContent = isDark ? 'Sáng' : 'Tối';
        }
    }

    async checkAuth() {
        if (this.checkAuthPromise) {
            return this.checkAuthPromise;
        }

        if (Auth.isAuthenticated()) {
            this.updateUserSection();
            this.checkAuthPromise = (async () => {
                try {
                    // Force-refresh to always get the latest balance/user data from server
                    const response = await api.get('/auth/me', {}, { forceRefresh: true });
                    if (response.success) {
                        this.currentUser = response.data;
                        Auth.saveAuth(localStorage.getItem('token'), response.data);
                        this.updateUserSection();
                    }
                } catch (error) {
                    Auth.clearAuth();
                    this.updateUserSection();
                } finally {
                    this.checkAuthPromise = null;
                }
            })();
            return this.checkAuthPromise;
        } else {
            this.updateUserSection();
            return Promise.resolve();
        }
    }

    async bootstrapAnonymousVisitor(force = false) {
        if (Auth.isAuthenticated()) {
            this.anonymousVisitorBootstrapped = false;
            this.anonymousVisitorBootstrapPromise = null;
            return null;
        }

        if (this.anonymousVisitorBootstrapped && !force) {
            return null;
        }

        if (this.anonymousVisitorBootstrapPromise && !force) {
            return this.anonymousVisitorBootstrapPromise;
        }

        const task = api.post('/security/visitor-entry', {
            path: `${window.location.pathname}${window.location.search}${window.location.hash}`
        })
            .catch(() => null)
            .finally(() => {
                this.anonymousVisitorBootstrapPromise = null;
            });

        this.anonymousVisitorBootstrapPromise = task;
        const result = await task;
        this.anonymousVisitorBootstrapped = true;
        return result;
    }

    startBalanceSync() {
        if (!Auth.isAuthenticated()) return;
        if (this.balanceInterval) return;
        this.balanceInterval = setInterval(async () => {
            if (document.hidden) return;
            try {
                const response = await api.get('/auth/me', {}, { forceRefresh: true });
                if (response.success) {
                    const newBalance = response.data?.balance;
                    const oldBalance = Auth.getCurrentUser()?.balance;
                    this.currentUser = response.data;
                    Auth.saveAuth(localStorage.getItem('token'), response.data);
                    // Only re-render if balance actually changed
                    if (newBalance !== oldBalance) {
                        this.updateUserSection();
                    }
                }
            } catch (error) {
                // ignore
            }
        }, this.balancePollIntervalMs);
    }

    stopBalanceSync() {
        if (this.balanceInterval) {
            clearInterval(this.balanceInterval);
            this.balanceInterval = null;
        }
    }

    updateUserSection() {
        const userSection = document.getElementById('user-section');
        if (!userSection) return;
        this.closeAccountDrawer({ persist: false });
        this.resetCommunityBadge();

        if (Auth.isAuthenticated()) {
            const user = Auth.getCurrentUser();
            this.renderAccountSideMenu(user);

            // CRITICAL: sync layout immediately so has-account-side-menu class is on body
            // before the user section (balance, avatar, etc.) is rendered
            this.syncAccountSideMenuLayout();



            userSection.innerHTML = `
                <div class="user-menu header-user-menu">
                    <div class="header-balance-badge" title="Số dư của bạn">
                        <div class="header-balance-icon">
                            <i class="fas fa-wallet"></i>
                        </div>
                        <div class="header-balance-text">${formatMoney(user.balance || 0)}</div>
                    </div>
                    <div class="notification-dropdown">
                        <button id="notif-btn" class="header-action-btn" type="button" aria-label="Thông báo">
                            <i class="fas fa-bell"></i>
                            <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
                        </button>
                        <div id="notif-menu" class="dropdown-menu notif-menu"></div>
                    </div>
                    <a href="/trangcanhan/${user.id}" data-link class="user-avatar-shell" aria-label="Trang cá nhân" title="Trang cá nhân">
                        ${renderAvatarWithFrame(user, 'header', user.full_name || user.email || 'avatar')}
                    </a>
                </div>
            `;

            // Bind events
            this.bindNotificationEvents();
            this.loadBrowserNotifiedCache();
            this.loadNotifications({ browserNotify: false });
            this.loadAdminSupportBadge();
            this.startNotificationSync();

            // Bind dropdown links
            userSection.querySelectorAll('a[data-link]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const path = e.currentTarget.getAttribute('href');
                    this.router.navigate(path);
                });
            });

        } else {
            this.renderAccountSideMenu(null);
            this.stopNotificationSync();
            userSection.innerHTML = `
                <a href="/login" data-link class="btn-login">Đăng nhập</a>
                <a href="/register" data-link class="btn-register">Đăng ký</a>
            `;

            // Bind links
            userSection.querySelectorAll('a[data-link]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const path = e.currentTarget.getAttribute('href');
                    this.router.navigate(path);
                });
            });
        }
    }

    async loadAccountMenuConfig(force = false) {
        if (this.accountMenuConfigLoaded && !force) {
            return this.accountMenuExtraLinks;
        }

        try {
            const response = await api.get('/settings', {
                keys: 'account_menu_extra_links'
            });
            const raw = response?.success ? response.data.account_menu_extra_links || '' : '';
            this.accountMenuExtraLinks = this.parseAccountMenuExtraLinks(raw);
        } catch (error) {
            this.accountMenuExtraLinks = [];
        }

        this.accountMenuConfigLoaded = true;
        return this.accountMenuExtraLinks;
    }

    parseAccountMenuExtraLinks(raw = '') {
        return raw
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => {
                const parts = line.split('|').map(item => item.trim()).filter(Boolean);
                if (parts.length < 2) return null;

                const label = parts[0];
                const href = parts.slice(1).join('|').trim();
                if (!label || !href) return null;

                const normalizedHref = /^(https?:)?\/\//i.test(href) || href.startsWith('/')
                    ? href
                    : `/${href.replace(/^\/+/, '')}`;

                return { label, href: normalizedHref };
            })
            .filter(Boolean)
            .slice(0, 12);
    }

    renderAccountSideMenu(user) {
        const slot = document.getElementById('account-side-menu-slot');
        if (!slot) return;
        this.removeExistingAccountSideMenuElements();

        const currentPath = window.location.pathname || '/';
        const currentSearch = window.location.search || '';
        const currentSection = new URLSearchParams(currentSearch).get('section') || '';
        const currentAdminTab = new URLSearchParams(currentSearch).get('tab') || 'dashboard';
        const adminPortalPath = Auth.getAdminPortalPath();
        const isAdminPage = !!adminPortalPath && currentPath === adminPortalPath;
        const template = this.accountSideMenuTemplate || this.getFallbackAccountSideMenuTemplate();
        const currentUrl = `${currentPath}${currentSearch}`;
        const isExternalHref = (href = '') => /^(https?:)?\/\//i.test(href);
        const isMenuLinkActive = (href = '') => {
            if (!href || isExternalHref(href)) return false;
            return currentUrl === href;
        };

        const buildMenuLink = ({ href, label, icon, active = false }) => {
            const safeHref = this.escapeHtml(href || '/');
            const safeLabel = this.escapeHtml(label || 'Menu');
            const externalAttrs = isExternalHref(href)
                ? ' target="_blank" rel="noopener noreferrer"'
                : ' data-link';
            return `
                <a href="${safeHref}"${externalAttrs} class="account-side-menu-list-link ${active ? 'active' : ''}" data-title="${safeLabel}">
                    ${icon ? `<i class="${this.escapeHtml(icon)}"></i>` : ''}
                    <span>${safeLabel}</span>
                </a>
            `;
        };
        const buildMenuSection = (title, items) => `
            <section class="account-side-menu-section">
                <div class="account-side-menu-section-title">${title}</div>
                <div class="account-side-menu-section-links">
                    ${items.map(buildMenuLink).join('')}
                </div>
            </section>
        `;
        const buildAdminMenu = (items = []) => `
            <section class="account-side-menu-section">
                <button
                    id="account-admin-menu-toggle"
                    class="account-side-menu-group-toggle ${isAdminPage ? 'active' : ''}"
                    type="button"
                    aria-expanded="${isAdminPage ? 'true' : 'false'}"
                    aria-controls="account-admin-menu-panel"
                >
                    <div class="account-side-menu-group-toggle-title">
                        <i class="fas fa-shield-halved"></i>
                        <span>Quản trị</span>
                    </div>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div id="account-admin-menu-panel" class="account-side-menu-submenu ${isAdminPage ? 'active' : ''}">
                    ${items.map(item => `
                        <a
                            href="${this.escapeHtml(`${adminPortalPath || '/'}?tab=${item.tab}`)}"
                            data-link
                            class="account-side-menu-submenu-link ${isAdminPage && currentAdminTab === item.tab ? 'active' : ''}"
                            data-title="${this.escapeHtml(item.label)}"
                        >
                            <i class="${this.escapeHtml(item.icon || 'fas fa-circle-dot')}"></i>
                            <span>${this.escapeHtml(item.label)}</span>
                        </a>
                    `).join('')}
                </div>
            </section>
        `;
        const extraLinks = Array.isArray(this.accountMenuExtraLinks) ? this.accountMenuExtraLinks : [];
        const adminMenuItems = [
            { tab: 'dashboard', label: 'Dashboard', icon: 'fas fa-gauge' },
            { tab: 'users', label: 'Người dùng', icon: 'fas fa-users' },
            { tab: 'deposits', label: 'Nạp tiền', icon: 'fas fa-wallet' },
            { tab: 'withdrawals', label: 'Rút tiền', icon: 'fas fa-money-bill-transfer' },
            { tab: 'products', label: 'Sản phẩm', icon: 'fas fa-box' },
            { tab: 'categories', label: 'Danh mục', icon: 'fas fa-list' },
            { tab: 'mxh_categories', label: 'Danh mục MXH', icon: 'fas fa-share-nodes' },
            { tab: 'mxh_services', label: 'Dịch vụ MXH', icon: 'fas fa-bullhorn' },
            { tab: 'posts', label: 'Bài đăng', icon: 'fas fa-newspaper' },
            { tab: 'messages', label: 'Tin nhắn', icon: 'fas fa-comment' },
            { tab: 'support', label: 'Hỗ trợ', icon: 'fas fa-headset' },
            { tab: 'notifications', label: 'Thông báo', icon: 'fas fa-bell' },
            { tab: 'inspect', label: 'Check tài khoản', icon: 'fas fa-user-check' },
            { tab: 'security', label: 'Bảo mật', icon: 'fas fa-lock' },
            { tab: 'logs', label: 'Logs', icon: 'fas fa-file-lines' },
            { tab: 'storage', label: 'Lưu trữ', icon: 'fas fa-database' },
            { tab: 'coupons', label: 'Mã giảm giá', icon: 'fas fa-ticket-simple' },
            { tab: 'cronjobs', label: 'Cron Jobs', icon: 'fas fa-clock' },
            { tab: 'settings', label: 'Cài đặt', icon: 'fas fa-gear' }
        ];

        slot.innerHTML = template;
        this.moveAccountSideMenuToBody(slot);

        const sections = document.getElementById('account-side-menu-sections');
        if (sections) {
            sections.innerHTML = `
                ${buildMenuSection('Điều hướng', [
                {
                    href: '/',
                    label: 'Trang chủ',
                    icon: 'fas fa-house',
                    active: currentPath === '/' && currentSection !== 'source'
                },
                {
                    href: '/?section=source',
                    label: 'Mã nguồn',
                    icon: 'fas fa-code',
                    active: currentPath === '/' && currentSection === 'source'
                },
                {
                    href: '/mxh',
                    label: 'Tài khoản MXH',
                    icon: 'fas fa-share-nodes',
                    active: currentPath === '/mxh'
                },
                {
                    href: '/dichvu-mxh',
                    label: 'Dịch vụ MXH',
                    icon: 'fas fa-server',
                    active: currentPath === '/dichvu-mxh'
                },
                ...(user && ['admin', 'seller'].includes(user.role) ? [{
                    href: '/banmxh',
                    label: 'Đăng bán MXH',
                    icon: 'fas fa-plus',
                    active: currentPath === '/banmxh'
                }] : []),
                {
                    href: '/vongquay',
                    label: 'Vòng quay',
                    icon: 'fas fa-dharmachakra',
                    active: currentPath === '/vongquay'
                },
                {
                    href: '/diemdanh',
                    label: 'Điểm danh',
                    icon: 'fas fa-calendar-check',
                    active: currentPath === '/diemdanh'
                },
                {
                    href: '/nhiemvu',
                    label: 'Nhiệm vụ 400đ',
                    icon: 'fas fa-tasks',
                    active: currentPath === '/nhiemvu'
                },
                {
                    href: '/tempmail',
                    label: 'Email tạm thời',
                    icon: 'fas fa-envelope-open-text',
                    active: currentPath === '/tempmail'
                },
                {
                    href: '/cronjobs',
                    label: 'Quản lý Cron Jobs',
                    icon: 'fas fa-clock',
                    active: currentPath === '/cronjobs'
                }
            ])}
                ${(user && ['admin', 'seller'].includes(user.role)) ? buildMenuSection('Thu nhập', [
                {
                    href: '/seller-dashboard',
                    label: 'Doanh thu',
                    icon: 'fas fa-chart-line',
                    active: currentPath === '/seller-dashboard'
                },
                {
                    href: '/ruttien',
                    label: 'Rút tiền',
                    icon: 'fas fa-money-bill-transfer',
                    active: currentPath === '/ruttien'
                }
            ]) : ''}
                ${extraLinks.length ? buildMenuSection('Tùy chỉnh', extraLinks.map(item => ({
                href: item.href,
                label: item.label,
                icon: 'fas fa-link',
                active: isMenuLinkActive(item.href)
            }))) : ''}
                ${(user && user.is_primary_admin === true && adminPortalPath) ? buildAdminMenu(adminMenuItems) : ''}
            `;
        }

        // Attach event listeners
        const closeBtn = document.getElementById('account-side-menu-close');
        const overlay = document.getElementById('account-side-menu-overlay');
        const drawer = document.getElementById('account-side-menu');
        const toggle = document.getElementById('account-side-menu-toggle');

        const closeDrawer = () => {
            if (drawer) drawer.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('account-drawer-open');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
        if (overlay) overlay.addEventListener('click', closeDrawer);

        if (toggle) {
            toggle.addEventListener('click', () => {
                if (!this.isAccountDrawerMobile()) {
                    document.body.classList.toggle('sidebar-collapsed');
                    try {
                        localStorage.setItem('sidebar-collapsed', document.body.classList.contains('sidebar-collapsed') ? 'true' : 'false');
                    } catch (e) {}
                    return;
                }
                const isOpen = drawer.classList.contains('active');
                this.setAccountDrawerState(!isOpen);
            });
        }

        // Admin menu toggle
        const adminToggle = document.getElementById('account-admin-menu-toggle');
        const adminPanel = document.getElementById('account-admin-menu-panel');
        if (adminToggle && adminPanel) {
            adminToggle.addEventListener('click', () => {
                const expanded = adminToggle.getAttribute('aria-expanded') === 'true';
                adminToggle.setAttribute('aria-expanded', !expanded);
                adminPanel.classList.toggle('active');
            });
        }

        // Bind logout button
        const logoutBtn = document.getElementById('account-side-menu-logout');
        if (logoutBtn) {
            if (!user) {
                logoutBtn.style.display = 'none';
            } else {
                logoutBtn.addEventListener('click', () => {
                    if (window.appInstance && typeof window.appInstance.logout === 'function') {
                        window.appInstance.logout();
                    }
                });
            }
        }

        // Bind data-link elements inside side menu
        const sideMenuEl = document.getElementById('account-side-menu');
        if (sideMenuEl) {
            sideMenuEl.querySelectorAll('a[data-link]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    closeDrawer();
                    const path = link.getAttribute('href');
                    if (window.router && typeof window.router.navigate === 'function') {
                        window.router.navigate(path);
                    }
                });
            });
        }
    }

    removeExistingAccountSideMenuElements() {
        const existingOverlay = document.getElementById('account-side-menu-overlay');
        const existingDrawer = document.getElementById('account-side-menu');

        if (existingOverlay) existingOverlay.remove();
        if (existingDrawer) existingDrawer.remove();
    }

    moveAccountSideMenuToBody(slot) {
        if (!slot) return;

        const overlay = slot.querySelector('#account-side-menu-overlay');
        const drawer = slot.querySelector('#account-side-menu');

        if (overlay) {
            document.body.appendChild(overlay);
        }

        if (drawer) {
            document.body.appendChild(drawer);
        }
    }

    getFallbackAccountSideMenuTemplate() {
        return `
            <button
                id="account-side-menu-toggle"
                class="side-menu-toggle"
                type="button"
                aria-expanded="false"
                aria-controls="account-side-menu"
            >
                <i class="fas fa-bars"></i>
                <span>Menu</span>
            </button>
            <div id="account-side-menu-overlay" class="account-side-menu-overlay"></div>
            <aside id="account-side-menu" class="account-side-menu" aria-hidden="true">
                <div class="account-side-menu-head">
                    <div class="account-side-menu-brand">
                        <a href="/" data-link class="account-side-menu-brand-link" aria-label="Sang dev">
                            <i class="fas fa-code"></i>
                            <span>Sang dev</span>
                        </a>
                    </div>
                    <button id="account-side-menu-close" class="account-side-menu-close" type="button" aria-label="Đóng menu">
                        <i class="fas fa-xmark"></i>
                    </button>
                </div>
                <div class="account-side-menu-body">
                    <div id="account-side-menu-sections"></div>
                </div>
                <div class="account-side-menu-footer">
                    <button id="account-side-menu-logout" class="account-side-menu-logout" type="button" data-title="Đăng xuất">
                        <i class="fas fa-right-from-bracket"></i>
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>
        `;
    }


    getSavedAccountDrawerState() {
        if (this.isAccountDrawerMobile()) {
            return false;
        }
        try {
            return localStorage.getItem(this.accountDrawerStorageKey) !== 'closed';
        } catch (error) {
            return true;
        }
    }

    persistAccountDrawerState(isOpen) {
        try {
            localStorage.setItem(this.accountDrawerStorageKey, isOpen ? 'open' : 'closed');
        } catch (error) {
            // ignore storage failures
        }
    }

    getSavedAccountDrawerCategoriesState({ currentPath, currentCategory } = {}) {
        if (currentPath === '/' && currentCategory) {
            return true;
        }

        try {
            return localStorage.getItem(this.accountDrawerCategoriesStorageKey) === 'open';
        } catch (error) {
            return false;
        }
    }

    persistAccountDrawerCategoriesState(isOpen) {
        try {
            localStorage.setItem(this.accountDrawerCategoriesStorageKey, isOpen ? 'open' : 'closed');
        } catch (error) {
            // ignore storage failures
        }
    }

    shouldCollapseAccountDrawerOnNavigate() {
        return this.isAccountDrawerMobile();
    }

    isAccountDrawerMobile() {
        return window.matchMedia('(max-width: 1024px)').matches;
    }

    syncAccountSideMenuLayout() {
        const drawer = document.getElementById('account-side-menu');

        if (!drawer) {
            document.body.classList.remove('has-account-side-menu');
            document.body.classList.remove('account-drawer-open');
            return;
        }

        if (this.isAccountDrawerMobile()) {
            document.body.classList.remove('has-account-side-menu');
            drawer.style.removeProperty('--account-menu-bottom-offset');
            this.setAccountDrawerState(false, { persist: false });
            return;
        }

        this.updateDesktopAccountSideMenuBounds(drawer);
        this.setAccountDrawerState(true, { persist: false });
        
        try {
            if (localStorage.getItem('sidebar-collapsed') === 'true') {
                document.body.classList.add('sidebar-collapsed');
            } else {
                document.body.classList.remove('sidebar-collapsed');
            }
        } catch(e){}
    }

    updateDesktopAccountSideMenuBounds(drawer) {
        const footer = document.getElementById('footer-container');
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        let bottomOffset = 0;

        if (footer && viewportHeight > 0) {
            const footerRect = footer.getBoundingClientRect();
            if (footerRect.top < viewportHeight) {
                bottomOffset = Math.max(0, Math.ceil(viewportHeight - footerRect.top));
            }
        }

        drawer.style.setProperty('--account-menu-bottom-offset', `${bottomOffset}px`);
    }

    setAccountDrawerState(isOpen, { persist = true } = {}) {
        const toggle = document.getElementById('account-side-menu-toggle');
        const drawer = document.getElementById('account-side-menu');
        const overlay = document.getElementById('account-side-menu-overlay');
        const isMobile = this.isAccountDrawerMobile();
        const shouldShowDrawer = !!drawer && (!isMobile || isOpen);

        document.body.classList.toggle('has-account-side-menu', !!drawer && !isMobile);

        if (toggle) {
            toggle.setAttribute('aria-expanded', shouldShowDrawer ? 'true' : 'false');
        }

        if (drawer) {
            drawer.classList.toggle('active', shouldShowDrawer);
            drawer.setAttribute('aria-hidden', shouldShowDrawer ? 'false' : 'true');
        }

        if (overlay) {
            overlay.classList.toggle('active', isMobile && isOpen);
        }

        document.body.classList.toggle('account-drawer-open', isMobile && isOpen);

        if (persist && isMobile) {
            this.persistAccountDrawerState(isOpen);
        }
    }

    setAccountDrawerCategoriesState(isOpen, { persist = true } = {}) {
        const toggle = document.getElementById('account-side-menu-category-toggle');
        const panel = document.getElementById('account-side-menu-category-panel');

        if (toggle) {
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }

        if (panel) {
            panel.classList.toggle('active', isOpen);
        }

        if (persist) {
            this.persistAccountDrawerCategoriesState(isOpen);
        }

        if (isOpen) {
            this.loadAccountMenuCategories();
        }
    }

    async loadAccountMenuCategories() {
        const panel = document.getElementById('account-side-menu-category-panel');
        if (!panel) return;

        if (!this.accountMenuCategories) {
            panel.innerHTML = '<div class="account-side-menu-submenu-loading">Đang tải danh mục...</div>';
            try {
                const response = await api.get('/categories');
                this.accountMenuCategories = Array.isArray(response.data) ? response.data : [];
            } catch (error) {
                panel.innerHTML = '<div class="account-side-menu-submenu-loading">Không tải được danh mục.</div>';
                return;
            }
        }

        const currentPath = window.location.pathname || '/';
        const currentCategory = new URLSearchParams(window.location.search).get('category_id');
        const categories = this.accountMenuCategories || [];

        panel.innerHTML = `
            <a href="/" data-link class="account-side-menu-submenu-link ${currentPath === '/' && !currentCategory ? 'active' : ''}">
                Tất Cả
            </a>
            ${categories.map(category => `
                <a
                    href="/?category_id=${category.id}"
                    data-link
                    class="account-side-menu-submenu-link ${currentPath === '/' && currentCategory === String(category.id) ? 'active' : ''}"
                    data-title="${this.escapeHtml(category.name || 'Danh mục')}"
                >
                    <span>${this.escapeHtml(category.name || 'Danh mục')}</span>
                </a>
            `).join('')}
        `;
    }

    bindAccountSideMenuEvents() {
        const slot = document.getElementById('account-side-menu-slot');
        const toggle = document.getElementById('account-side-menu-toggle');
        const drawer = document.getElementById('account-side-menu');
        const overlay = document.getElementById('account-side-menu-overlay');
        const closeBtn = document.getElementById('account-side-menu-close');
        const logoutBtn = document.getElementById('account-side-menu-logout');
        const adminToggle = document.getElementById('account-admin-menu-toggle');
        const adminPanel = document.getElementById('account-admin-menu-panel');

        if (!slot || !toggle || !drawer || !overlay) return;

        this.syncAccountSideMenuLayout();

        toggle.onclick = () => {
            if (!this.isAccountDrawerMobile()) {
                document.body.classList.toggle('sidebar-collapsed');
                // Optional: save state to localStorage
                try {
                    localStorage.setItem('sidebar-collapsed', document.body.classList.contains('sidebar-collapsed') ? 'true' : 'false');
                } catch (e) {}
                return;
            }
            const isOpen = drawer.classList.contains('active');
            this.setAccountDrawerState(!isOpen);
        };

        overlay.onclick = () => {
            this.closeAccountDrawer();
        };

        if (closeBtn) {
            closeBtn.onclick = () => {
                this.closeAccountDrawer();
            };
        }

        if (logoutBtn) {
            logoutBtn.onclick = () => {
                this.closeAccountDrawer();
                this.logout();
            };
        }

        if (adminToggle && adminPanel) {
            adminToggle.onclick = () => {
                const isOpen = adminToggle.getAttribute('aria-expanded') === 'true';
                adminToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
                adminToggle.classList.toggle('active', !isOpen);
                adminPanel.classList.toggle('active', !isOpen);
            };
        }

        drawer.onclick = (e) => {
            const link = e.target.closest('a[data-link]');
            if (link && drawer.contains(link)) {
                e.preventDefault();
                const path = link.getAttribute('href') || '/';
                if (this.shouldCollapseAccountDrawerOnNavigate()) {
                    this.closeAccountDrawer();
                }
                this.router.navigate(path);
            }
        };
    }

    closeAccountDrawer(options = {}) {
        this.setAccountDrawerState(false, options);
    }

    refreshRouteAwareUi() {
        const path = window.location.pathname;
        const footer = document.getElementById('footer-container');
        if (footer) {
            if (path === '/congdong' || path === '/community') {
                footer.style.display = 'none';
            } else {
                footer.style.display = '';
            }
        }

        const user = Auth.getCurrentUser();
        if (user) {
            this.renderAccountSideMenu(user);
            requestAnimationFrame(() => this.syncAccountSideMenuLayout());
            requestAnimationFrame(() => {
                requestAnimationFrame(() => this.syncAccountSideMenuLayout());
            });
            return;
        }

        this.syncAccountSideMenuLayout();
    }

    initRouter() {
        const routes = [
            { path: '/', page: '/pages/index1.html', script: '/js/pages/home.js' },
            { path: '/feed', page: '/pages/feed.html', script: '/js/pages/feed.js' },
            { path: '/congdong', page: '/pages/congdong.html', script: '/js/pages/congdong.js', auth: true, feature: 'community' },
            { path: '/suasanpham/:id', page: '/pages/suasanpham.html', script: '/js/pages/suasanpham.js', role: ['admin', 'seller'] },
            { path: '/login', page: '/pages/login.html', script: '/js/pages/login.js' },
            { path: '/register', page: '/pages/register.html', script: '/js/pages/register.js' },
            { path: '/register/verify', page: '/pages/register-verify.html', script: '/js/pages/register-verify.js' },
            { path: '/product/:id', page: '/pages/product.html', script: '/js/pages/product.js' },
            { path: '/page2/:slug', page: '/pages/product.html', script: '/js/pages/product.js' },
            { path: '/naptien', page: '/pages/naptien.html', script: '/js/pages/naptien.js', auth: true, feature: 'deposit' },
            { path: '/lichsumua', page: '/pages/lichsumua.html', script: '/js/pages/lichsumua.js', auth: true },
            { path: '/baidang', page: '/pages/baidang.html', script: '/js/pages/baidang.js', auth: true },
            { path: '/hotro', page: '/pages/hotro.html', script: '/js/pages/hotro.js', auth: true },
            { path: '/dangban', page: '/pages/dangban.html', script: '/js/pages/dangban.js', role: ['admin', 'seller'] },
            { path: '/trangcanhan/:id', page: '/pages/trangcanhan.html', script: '/js/pages/trangcanhan.js' },
            { path: '/vongquay', page: '/pages/vongquay.html', script: '/js/pages/vongquay.js', auth: true, feature: 'spin' },
            { path: '/diemdanh', page: '/pages/diemdanh.html', script: '/js/pages/diemdanh.js', auth: true, feature: 'checkin' },
            { path: '/nhiemvu', page: '/pages/nhiemvu.html', script: '/js/pages/nhiemvu.js', auth: true, feature: 'mission' },
            { path: '/ruttien', page: '/pages/ruttien.html', script: '/js/pages/ruttien.js', role: ['admin', 'seller'], feature: 'withdraw' },
            { path: '/seller-dashboard', page: '/pages/seller-dashboard.html', script: '/js/pages/seller-dashboard.js', role: ['admin', 'seller'] },
            { path: '/mxh', page: '/pages/mxh.html', script: '/js/pages/mxh.js', feature: 'mxh' },
            { path: '/mxh/account/:id', page: '/pages/mxh-account.html', script: '/js/pages/mxh-account.js', auth: true, feature: 'mxh' },
            { path: '/banmxh', page: '/pages/banmxh.html', script: '/js/pages/banmxh.js', role: ['admin', 'seller'], feature: 'mxh' },
            { path: '/dichvu-mxh', page: '/pages/dichvu-mxh.html', script: '/js/pages/dichvu-mxh.js', auth: true, feature: 'mxh' },
            { path: '/tempmail', page: '/pages/tempmail.html', script: '/js/pages/tempmail.js' },
            { path: '/cronjobs', page: '/pages/cronjobs.html', script: '/js/pages/cronjobs.js', auth: true },
            { path: '/privacy', page: '/pages/privacy.html' },
            { path: '/terms', page: '/pages/terms.html' }
        ];
        const adminPortalPath = Auth.getAdminPortalPath();
        if (adminPortalPath) {
            routes.push({ path: adminPortalPath, page: '/pages/admin.html', script: '/js/pages/admin.js', role: 'primary_admin' });
        }
        this.router = new Router(routes);
        return this.router;
    }

    async logout() {
        try {
            await api.post('/auth/logout');
            Auth.clearAuth();
            this.currentUser = null;
            this.stopNotificationSync();
            this.updateUserSection();
            void this.bootstrapAnonymousVisitor(true);
            this.router.navigate('/login');
            showToast('Đăng xuất thành công', 'success');
        } catch (error) {
            showToast('Có lỗi khi đăng xuất', 'error');
        }
    }

    bindNotificationEvents() {
        const btn = document.getElementById('notif-btn');
        const menu = document.getElementById('notif-menu');
        if (!btn || !menu) return;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            this.requestBrowserNotificationPermissionFromGesture();
            const isOpen = menu.classList.contains('active');
            document.querySelectorAll('.notif-menu').forEach(m => m.classList.remove('active'));
            if (!isOpen) {
                menu.classList.add('active');
                await api.post('/notifications/read-all');
                this.loadNotifications({ browserNotify: false });
            }
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
    }

    async loadNotifications(options = {}) {
        if (!Auth.isAuthenticated()) return;
        const browserNotify = options.browserNotify !== false;
        const menu = document.getElementById('notif-menu');
        const badge = document.getElementById('notif-badge');
        if (!menu || !badge) return;
        try {
            const response = await api.get('/notifications', { limit: 20 });
            if (!response.success) return;
            const items = response.data || [];
            const unread = response.unread || 0;
            if (unread > 0) {
                badge.style.display = 'inline-flex';
                badge.textContent = unread > 99 ? '99+' : String(unread);
            } else {
                badge.style.display = 'none';
                badge.textContent = '0';
            }

            menu.innerHTML = `
                <div class="notif-header">
                    <span>Thông báo</span>
                </div>
                <div class="notif-body">
                    ${items.length ? items.map(n => `
                        <div class="notif-item ${n.is_read ? '' : 'unread'}">
                            <div class="notif-title">${this.escapeHtml(n.title)}</div>
                            ${n.image_url ? `<img src="${this.escapeHtml(n.image_url)}" class="notif-image" alt="notif">` : ''}
                            ${n.content ? `<div class="notif-content">${this.escapeHtml(n.content)}</div>` : ''}
                            <div class="notif-time">${formatDateShort(n.created_at)}</div>
                        </div>
                    `).join('') : '<div class="notif-empty">Chưa có thông báo.</div>'}
                </div>
            `;

            this.handleIncomingNotifications(items, browserNotify);
            if (browserNotify) {
                this.notifyAllUnreadInMenu(items);
            }
            this.showImportantNoticeIfNeeded(items);
            this.loadAdminSupportBadge();
        } catch (error) {
            // ignore
        }
    }

    startNotificationSync() {
        if (!Auth.isAuthenticated()) return;
        if (this.notificationPollTimer) return;
        this.notificationPollTimer = setInterval(() => {
            if (document.hidden) return;
            this.loadNotifications({ browserNotify: true });
        }, this.notificationPollIntervalMs);
    }

    stopNotificationSync() {
        if (this.notificationPollTimer) {
            clearInterval(this.notificationPollTimer);
            this.notificationPollTimer = null;
        }
        this.resetCommunityBadge();
        this.notificationsHydrated = false;
        this.notificationIdSet = new Set();
        this.activeImportantNoticeId = null;
        this.browserNotifiedIds = new Set();
        const modal = document.getElementById('important-notice-modal');
        if (modal) modal.remove();
    }

    async loadStartupImportantNotice() {
        try {
            const response = await api.get('/notifications/important');
            if (!response.success) return;
            const item = response.data || null;
            if (!item) return;
            this.showImportantNoticeIfNeeded([item]);
        } catch (error) {
            // ignore
        }
    }

    handleIncomingNotifications(items = [], browserNotify = true) {
        const currentIds = new Set(items.map(item => String(item.id)));

        if (!this.notificationsHydrated) {
            this.notificationsHydrated = true;
            this.notificationIdSet = currentIds;
            return;
        }

        const newItems = items.filter(item => !this.notificationIdSet.has(String(item.id)));
        this.notificationIdSet = currentIds;

        if (!browserNotify || !newItems.length) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        newItems.reverse().forEach(item => this.showBrowserNotification(item));
    }

    getBrowserNotifiedStorageKey() {
        const user = Auth.getCurrentUser();
        const userId = user ? user.id : 'guest';
        return `browser_notified_ids_${userId}`;
    }

    loadBrowserNotifiedCache() {
        try {
            const raw = localStorage.getItem(this.getBrowserNotifiedStorageKey());
            const ids = raw ? JSON.parse(raw) : [];
            if (Array.isArray(ids)) {
                this.browserNotifiedIds = new Set(ids.map(id => String(id)));
            } else {
                this.browserNotifiedIds = new Set();
            }
        } catch (error) {
            this.browserNotifiedIds = new Set();
        }
    }

    saveBrowserNotifiedCache() {
        try {
            const data = Array.from(this.browserNotifiedIds).slice(-400);
            localStorage.setItem(this.getBrowserNotifiedStorageKey(), JSON.stringify(data));
        } catch (error) {
            // ignore
        }
    }

    notifyAllUnreadInMenu(items = []) {
        if (!Array.isArray(items) || !items.length) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const unreadItems = items
            .filter(item => Number(item.is_read || 0) === 0)
            .filter(item => !this.browserNotifiedIds.has(String(item.id)));

        if (!unreadItems.length) return;

        unreadItems
            .slice()
            .reverse()
            .forEach(item => {
                this.showBrowserNotification(item);
                this.browserNotifiedIds.add(String(item.id));
            });

        this.saveBrowserNotifiedCache();
    }

    showBrowserNotification(item) {
        try {
            const title = (item.title || 'Thông báo mới').toString();
            const body = (item.content || 'Bạn có thông báo mới').toString();
            const icon = item.image_url || '/img/icon.ico';
            const noti = new Notification(title, {
                body,
                icon,
                tag: `notif-${item.id}`
            });
            noti.onclick = () => {
                window.focus();
                try {
                    if (window.router) window.router.navigate('/feed');
                } catch (error) {
                    // ignore
                }
            };
            this.browserNotifiedIds.add(String(item.id));
            this.saveBrowserNotifiedCache();
        } catch (error) {
            // ignore
        }
    }

    showImportantNoticeIfNeeded(items = []) {
        if (!Array.isArray(items) || !items.length) return;
        const important = items.find(item => Number(item.is_important || 0) === 1);
        if (!important) return;

        const user = Auth.getCurrentUser();
        const userId = user ? user.id : 'guest';
        const noticeId = String(important.id);
        const dismissedKey = `important_notice_dismissed_${userId}_${noticeId}`;
        const snoozeKey = `important_notice_snooze_until_${userId}_${noticeId}`;
        const snoozeUntil = Number.parseInt(localStorage.getItem(snoozeKey) || '0', 10);
        const dismissed = localStorage.getItem(dismissedKey) === '1';

        if (dismissed) return;
        if (Number.isFinite(snoozeUntil) && snoozeUntil > Date.now()) return;

        if (this.activeImportantNoticeId && this.activeImportantNoticeId === noticeId) return;
        this.activeImportantNoticeId = noticeId;

        const oldModal = document.getElementById('important-notice-modal');
        if (oldModal) oldModal.remove();

        const dismissHours = Number.parseInt(important.dismiss_hours || 2, 10);
        const safeHours = Number.isFinite(dismissHours) && dismissHours > 0 ? dismissHours : 2;

        const modal = document.createElement('div');
        modal.id = 'important-notice-modal';
        modal.className = 'important-notice-modal';
        modal.innerHTML = `
                <div class="important-notice-backdrop"></div>
                    <div class="important-notice-card">
                        <button type="button" id="important-x-btn" class="important-notice-x" aria-label="Dong">×</button>
                        <div class="important-notice-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <h3>${this.escapeHtml(important.title || 'Thông báo')}</h3>
                        ${important.image_url ? `<img src="${this.escapeHtml(important.image_url)}" alt="important notice" class="important-notice-image">` : ''}
                        <div class="important-notice-content">${this.escapeHtml(important.content || '').replace(/\n/g, '<br>')}</div>
                        <p class="important-notice-perm"></p>
                        <div class="important-notice-actions">
                            <button type="button" id="important-snooze-btn" class="btn-outline">Dong trong ${safeHours} gio</button>
                            <button type="button" id="important-close-btn" class="btn-primary">Dong</button>
                        </div>
                    </div>
            `;
        document.body.appendChild(modal);

        const closeModal = () => {
            modal.remove();
            this.activeImportantNoticeId = null;
        };

        const snoozeBtn = document.getElementById('important-snooze-btn');
        const closeBtn = document.getElementById('important-close-btn');
        const xBtn = document.getElementById('important-x-btn');
        const backdrop = modal.querySelector('.important-notice-backdrop');

        if (snoozeBtn) {
            snoozeBtn.addEventListener('click', () => {
                const until = Date.now() + safeHours * 60 * 60 * 1000;
                localStorage.setItem(snoozeKey, String(until));
                this.requestBrowserNotificationPermissionFromGesture();
                closeModal();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                localStorage.setItem(dismissedKey, '1');
                this.requestBrowserNotificationPermissionFromGesture();
                closeModal();
            });
        }
        if (backdrop) {
            backdrop.addEventListener('click', closeModal);
        }
        if (xBtn) {
            xBtn.addEventListener('click', () => {
                localStorage.setItem(dismissedKey, '1');
                this.requestBrowserNotificationPermissionFromGesture();
                closeModal();
            });
        }
    }

    requestBrowserNotificationPermissionFromGesture() {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return;
        Notification.requestPermission().catch(() => {});
    }

    initAiWidget() {
        if (document.getElementById('ai-chat-bubble')) return;

        const widget = document.createElement('div');
        widget.className = 'ai-chat-widget';
        widget.innerHTML = `
            <button id="ai-chat-bubble" class="ai-chat-bubble" type="button" aria-label="Mở trợ lý AI">
                <i class="fas fa-comment-dots"></i>
            </button>
                <div id="ai-chat-window" class="ai-chat-window" aria-hidden="true">
                    <div class="ai-chat-header">
                        <div>
                            <strong>Trợ lý AI</strong>
                            <p>TRỢ LÝ SANGDEV</p>
                        </div>
                        <button id="ai-chat-close" class="ai-chat-close" type="button" aria-label="Đóng">×</button>
                    </div>
                    <div id="ai-chat-messages" class="ai-chat-messages">
                        <div class="ai-msg ai-msg-bot">Xin chào, bạn cần mình hỗ trợ gì?</div>
                    </div>
                    <div class="ai-chat-suggest">
                        <button class="ai-chip" type="button" data-question="Hướng dẫn mua sản phẩm">Mua sản phẩm</button>
                        <button class="ai-chip" type="button" data-question="Làm sao nạp tiền vào tài khoản">Nạp tiền</button>
                        <button class="ai-chip" type="button" data-question="Tôi cần liên hệ hỗ trợ">Liên hệ hỗ trợ</button>
                    </div>
                    <form id="ai-chat-form" class="ai-chat-form">
                        <input id="ai-chat-input" type="text" maxlength="500" placeholder="Nhập câu hỏi..." />
                        <button id="ai-chat-send" type="submit">Gửi</button>
                    </form>
                </div>
            `;

        document.body.appendChild(widget);

        const bubble = document.getElementById('ai-chat-bubble');
        const win = document.getElementById('ai-chat-window');
        const closeBtn = document.getElementById('ai-chat-close');
        const form = document.getElementById('ai-chat-form');
        const input = document.getElementById('ai-chat-input');
        const messages = document.getElementById('ai-chat-messages');

        if (!bubble || !win || !closeBtn || !form || !input || !messages) return;

        bubble.addEventListener('click', () => {
            this.aiChatOpen = !this.aiChatOpen;
            win.classList.toggle('active', this.aiChatOpen);
            win.setAttribute('aria-hidden', this.aiChatOpen ? 'false' : 'true');
            bubble.setAttribute('aria-expanded', this.aiChatOpen ? 'true' : 'false');
            if (this.aiChatOpen) {
                input.focus();
            }
        });

        closeBtn.addEventListener('click', () => {
            this.aiChatOpen = false;
            win.classList.remove('active');
            win.setAttribute('aria-hidden', 'true');
            bubble.setAttribute('aria-expanded', 'false');
        });

        widget.querySelectorAll('.ai-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                input.value = chip.dataset.question || '';
                input.focus();
            });
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (this.aiChatBusy) return;

            const question = input.value.trim();
            if (!question) return;

            this.appendAiMessage('user', question);
            input.value = '';

            this.aiChatBusy = true;
            const sendBtn = document.getElementById('ai-chat-send');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = '...';
            }

            try {
                const response = await api.post('/ai/quick-chat', { question });
                const answer = response?.data?.answer || 'Xin loi, toi chua tra loi duoc cau hoi nay.';
                this.appendAiMessage('bot', answer);
            } catch (error) {
                this.appendAiMessage('bot', error.message || 'Không thể kết nối AI lúc này.');
            } finally {
                this.aiChatBusy = false;
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Gửi';
                }
            }
        });
    }

    appendAiMessage(role, text) {
        const messages = document.getElementById('ai-chat-messages');
        if (!messages) return;
        const cls = role === 'user' ? 'ai-msg-user' : 'ai-msg-bot';
        const item = document.createElement('div');
        item.className = `ai - msg ${ cls } `;
        item.innerHTML = this.formatAiText(text || '');
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
    }

    formatAiText(input) {
        const text = (input || '').toString().replace(/\r\n/g, '\n');
        const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
        let html = '';
        let lastIndex = 0;
        let match;

        while ((match = urlRegex.exec(text)) !== null) {
            const [rawUrl] = match;
            const index = match.index;
            html += this.escapeHtml(text.slice(lastIndex, index)).replace(/\n/g, '<br>');
            const prevChar = text[index - 1] || '';
            const nextChar = text[index + rawUrl.length] || '';
            if (prevChar && !/\s|[\(\[\{>"']/u.test(prevChar)) html += ' ';
            html += this.buildAiLinkHtml(rawUrl);
            if (nextChar && !/\s|[)\]\}.,!?;:'"]/u.test(nextChar)) html += ' ';
            lastIndex = index + rawUrl.length;
        }

        html += this.escapeHtml(text.slice(lastIndex)).replace(/\n/g, '<br>');
        return html;
    }

    buildAiLinkHtml(rawUrl) {
        const normalizedUrl = this.sanitizeHttpUrl(rawUrl, { allowRelative: false });
        const label = this.escapeHtml(this.formatLinkLabel(rawUrl));
        if (!normalizedUrl) {
            return `<span class="ai-rich-link ai-rich-link-disabled"><i class="fas fa-link"></i><span>${label}</span></span>`;
        }
        const safeUrl = this.escapeHtml(normalizedUrl);
        return `<a class="ai-rich-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeUrl}"><i class="fas fa-link"></i><span>${label}</span></a>`;
    }

    formatLinkLabel(rawUrl) {
        try {
            const url = new URL(rawUrl);
            const host = (url.hostname || '').replace(/^www\./i, '');
            const path = (url.pathname && url.pathname !== '/') ? url.pathname : '';
            if (!path) return host || rawUrl;
            const shortPath = path.length > 22 ? `${ path.slice(0, 22) }...` : path;
            return `${host}${shortPath}`;
        } catch (error) {
            return rawUrl;
        }
    }

    escapeHtml(input) {
        return (input || '')
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    sanitizeHttpUrl(input, { allowRelative = true, allowBlob = false } = {}) {
        const raw = String(input || '').trim();
        if (!raw) return '';

        if (allowBlob && raw.startsWith('blob:')) {
            return raw;
        }

        if (!allowRelative && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
            return '';
        }

        try {
            const url = new URL(raw, window.location.origin);
            const protocol = String(url.protocol || '').toLowerCase();
            if (protocol === 'http:' || protocol === 'https:') {
                return url.href;
            }
            if (allowBlob && protocol === 'blob:') {
                return raw;
            }
            return '';
        } catch (error) {
            return '';
        }
    }

    resetCommunityBadge() {
        const badge = document.getElementById('community-nav-badge');
        if (!badge) return;
        badge.style.display = 'none';
        badge.textContent = '0';
    }

    async loadAdminSupportBadge() {
        const badge = document.getElementById('community-nav-badge');
        if (!badge) return;

        if (!Auth.isAuthenticated() || !Auth.hasRole('admin')) {
            this.resetCommunityBadge();
            return;
        }

        try {
            const response = await api.get('/admin/support/unread-summary');
            const unread = Number(response?.data?.total_unread || 0);
            if (unread > 0) {
                badge.style.display = 'inline-flex';
                badge.textContent = unread > 99 ? '99+' : String(unread);
                return;
            }
        } catch (error) {
            // ignore
        }

        this.resetCommunityBadge();
    }
}

// Global router instance
let router;

// Khởi động app
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.appInstance = app;
    app.init();
});
