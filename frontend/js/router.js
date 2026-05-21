// ============================================
// SPA ROUTER
// File: frontend/js/router.js
// ============================================

class Router {
    constructor(routes) {
        this.routes = routes;
        this.currentPage = null;
    }

    parseURL() {
        const url = window.location.pathname;
        const queryString = window.location.search;
        const params = new URLSearchParams(queryString);

        return {
            path: url,
            query: Object.fromEntries(params)
        };
    }

    matchRoute(path) {
        for (const route of this.routes) {
            const pattern = this.pathToRegex(route.path);
            const match = path.match(pattern);

            if (match) {
                const params = this.extractParams(route.path, match);
                return { ...route, params };
            }
        }
        return null;
    }

    pathToRegex(path) {
        return new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$');
    }

    extractParams(pattern, match) {
        const keys = pattern.match(/:\w+/g) || [];
        const params = {};

        keys.forEach((key, index) => {
            params[key.substring(1)] = match[index + 1];
        });

        return params;
    }

    async handleRoute() {
        const { path, query } = this.parseURL();
        const route = this.matchRoute(path);

        if (!route) {
            this.show404();
            return;
        }

        // Check authentication
        if (route.auth && !Auth.isAuthenticated()) {
            const redirectTarget = `${path}${window.location.search || ''}`;
            this.navigate('/login?redirect=' + encodeURIComponent(redirectTarget));
            return;
        }

        // Check role
        if (route.role && !Auth.hasRole(route.role)) {
            if (route.path === '/dangban' && Auth.isAuthenticated()) {
                showToast('Bạn cần nạp ít nhất 20.000đ để được nâng quyền bán hàng.', 'warning');
                this.navigate('/naptien');
                return;
            }
            showToast('Bạn không có quyền truy cập trang này', 'error');
            this.navigate('/');
            return;
        }
        // Check feature lock
        if (route.feature && window.appInstance) {
            // Re-sync feature locks before navigating to ensure real-time status
            if (typeof window.appInstance.syncLockedFeatures === 'function') {
                await window.appInstance.syncLockedFeatures();
            }
            if (window.appInstance.isFeatureLocked(route.feature)) {
                if (typeof api !== 'undefined' && typeof api.showMaintenanceMessage === 'function') {
                    api.showMaintenanceMessage('Tính năng này hiện đang được nâng cấp và sửa chữa. Vui lòng quay lại sau ít phút để tiếp tục sử dụng.');
                }
                const mainContent = document.getElementById('main-content');
                if (mainContent) {
                    mainContent.style.filter = 'blur(12px)';
                    mainContent.style.pointerEvents = 'none';
                    mainContent.style.userSelect = 'none';
                }
                // Dừng việc tải trang để người dùng không xem được nội dung
                return; 
            }
        }
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.style.filter = '';
            mainContent.style.pointerEvents = '';
            mainContent.style.userSelect = '';
        }

        await this.loadPage(route, query);

    }

    async loadPage(route, query) {
        const mainContent = document.getElementById('main-content');

        try {
            if (window.pageCleanup) {
                try {
                    window.pageCleanup();
                } catch (error) {
                    // ignore cleanup errors
                }
                window.pageCleanup = null;
            }
            window.pageInit = null;

            showLoading('main-content');

            const html = window.ProtectedAssets && typeof window.ProtectedAssets.fetchTextAsset === 'function'
                ? await window.ProtectedAssets.fetchTextAsset(route.page)
                : await fetch(route.page).then(r => r.text());
            mainContent.innerHTML = html;

            if (route.script) {
                await this.loadScript(route.script, route.params, query);
            }

            window.scrollTo(0, 0);
            this.currentPage = route;
            if (window.appInstance && typeof window.appInstance.refreshRouteAwareUi === 'function') {
                window.appInstance.refreshRouteAwareUi();
            }

        } catch (error) {
            console.error('Load page error:', error);
            mainContent.innerHTML = '<div class="error">Không thể tải trang</div>';
        }
    }

    async loadScript(scriptPath, params, query) {
        const oldScript = document.querySelector(`script[data-route-script="${scriptPath}"]`);
        if (oldScript) oldScript.remove();

        const shouldUseProtectedScript = scriptPath.startsWith('/js/pages/')
            && window.ProtectedAssets
            && typeof window.ProtectedAssets.fetchTextAsset === 'function';

        if (shouldUseProtectedScript) {
            const scriptText = await window.ProtectedAssets.fetchTextAsset(scriptPath);
            const script = document.createElement('script');
            script.setAttribute('data-route-script', scriptPath);
            script.textContent = `${scriptText}\n//# sourceURL=${scriptPath}`;
            document.body.appendChild(script);
            if (window.pageInit) {
                window.pageInit(params, query);
            }
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
            script.src = isLocalhost ? `${scriptPath}?dev=${Date.now()}` : scriptPath;
            script.setAttribute('data-route-script', scriptPath);
            script.onload = () => {
                if (window.pageInit) {
                    window.pageInit(params, query);
                }
                resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    navigate(path) {
        window.history.pushState({}, '', path);
        this.handleRoute();
    }

    show404() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="error-page">
                <h1>404</h1>
                <p>Trang không tồn tại</p>
                <a href="/" data-link onclick="event.preventDefault(); router.navigate('/')">Về trang chủ</a>
            </div>
        `;
    }
}
