// ============================================
// AUTHENTICATION HELPER
// File: frontend/js/auth.js
// ============================================

const Auth = {
    // Check if user is logged in
    isAuthenticated() {
        return !!localStorage.getItem('token');
    },

    // Get current user from localStorage
    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },

    // Save auth data
    saveAuth(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },

    // Clear auth data
    clearAuth() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    // Check if user has role
    hasRole(role) {
        const user = this.getCurrentUser();
        if (!user) return false;
        if (Array.isArray(role)) {
            return role.includes(user.role);
        }
        if (role === 'primary_admin') {
            return user.role === 'admin' && user.is_primary_admin === true;
        }
        return user.role === role;
    },

    getAdminPortalPath() {
        const user = this.getCurrentUser();
        if (!user || user.role !== 'admin' || user.is_primary_admin !== true) {
            return '';
        }
        return String(user.admin_portal_path || '').trim();
    },

    isPrimaryAdmin() {
        const user = this.getCurrentUser();
        return !!user && user.role === 'admin' && user.is_primary_admin === true;
    },

    isAdminPortalPath(path = '') {
        const adminPath = this.getAdminPortalPath();
        return !!adminPath && String(path || '').trim() === adminPath;
    },

    // Get user balance
    getBalance() {
        const user = this.getCurrentUser();
        return user ? user.balance : 0;
    },

    // Update user in localStorage
    updateUser(userData) {
        const current = this.getCurrentUser();
        if (current) {
            const updated = { ...current, ...userData };
            localStorage.setItem('user', JSON.stringify(updated));
        }
    }
};
