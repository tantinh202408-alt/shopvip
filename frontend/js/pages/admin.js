// ============================================
// ADMIN PAGE
// File: frontend/js/pages/admin.js
// ============================================

window.pageInit = async function(params, query = {}) {
    let logInterval = null;

    bindTabs(query.tab || 'dashboard');
    await loadDashboard();
    await loadUsers();
    await loadDeposits();
    await loadWithdrawals();
    await loadProducts();
    await loadCategories();
    await loadPosts();
    await loadMessages();
    await loadSupport();
    await loadNotifications();
    await loadInspect();
    await loadSecurity();
    await loadStorage();
    await loadLogs();
    await loadMxhCategories();
    initShareDataModal();
    await loadSettings();

    window.pageCleanup = () => {
        if (logInterval) clearInterval(logInterval);
    };

    function bindTabs(initialTab = 'dashboard') {
        const availableTabs = new Set([
            'dashboard',
            'users',
            'deposits',
            'withdrawals',
            'products',
            'categories',
            'posts',
            'messages',
            'support',
            'notifications',
            'inspect',
            'security',
            'logs',
            'storage',
            'mxh_categories',
            'settings'
        ]);

        const normalizeTab = (tab) => availableTabs.has(tab) ? tab : 'dashboard';

        const syncTabUrl = (tab) => {
            const nextUrl = `/admin?tab=${encodeURIComponent(tab)}`;
            window.history.replaceState({}, '', nextUrl);
            window.appInstance?.refreshRouteAwareUi?.();
        };

        const showTab = (tab, { syncUrl = true } = {}) => {
            const nextTab = normalizeTab(tab);

            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.getElementById(`tab-${nextTab}`);
            if (pane) pane.classList.add('active');

            if (syncUrl) {
                syncTabUrl(nextTab);
            }
        };

        const normalizedInitialTab = normalizeTab(initialTab);
        showTab(normalizedInitialTab, { syncUrl: normalizedInitialTab !== initialTab });
    }

    async function loadDashboard() {
        const container = document.getElementById('tab-dashboard');
        try {
            const response = await api.get('/admin/dashboard');
            if (response.success) {
                const d = response.data;
                const dailySeries = Array.isArray(d.dailyRevenue) ? d.dailyRevenue : [];
                const monthlySeries = Array.isArray(d.monthlyRevenue) ? d.monthlyRevenue : [];
                const dailyTotal = dailySeries.reduce((sum, item) => sum + (item.value || 0), 0);
                const monthlyTotal = monthlySeries.reduce((sum, item) => sum + (item.value || 0), 0);
                const system = d.systemStats || {};
                const mem = system.memory || {};
                const cpu = system.cpu || {};
                const load = system.load || {};
                const reqStats = d.requestStats || {};
                const load1m = Number(load['1m'] ?? (Array.isArray(load) ? load[0] : 0)) || 0;
                const load5m = Number(load['5m'] ?? (Array.isArray(load) ? load[1] : 0)) || 0;
                const load15m = Number(load['15m'] ?? (Array.isArray(load) ? load[2] : 0)) || 0;
                const reqTotal = reqStats.total ?? reqStats.buffered ?? 0;
                const reqLast1h = reqStats.last1h ?? 0;
                const reqLast5m = reqStats.last5m ?? 0;
                const cpuLoadPercent = Math.max(0, Math.min(100, Math.round((load1m / Math.max(cpu.cores || 1, 1)) * 100)));
                const reqLoadPercent = reqLast1h > 0 ? Math.max(0, Math.min(100, Math.round((reqLast5m / Math.max(reqLast1h, 1)) * 100))) : 0;

                container.innerHTML = `
                    <div class="stat-grid admin-stat-grid">
                        <div class="stat-card stat-card--revenue">
                            <div class="stat-card-icon"><i class="fas fa-coins"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Doanh thu (tổng)</div>
                                <div class="stat-card-value">${formatMoney(d.totalRevenue)}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--revenue30">
                            <div class="stat-card-icon"><i class="fas fa-calendar-days"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Doanh thu 30 ngày</div>
                                <div class="stat-card-value">${formatMoney(dailyTotal)}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--revenue12">
                            <div class="stat-card-icon"><i class="fas fa-chart-line"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Doanh thu 12 tháng</div>
                                <div class="stat-card-value">${formatMoney(monthlyTotal)}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--users">
                            <div class="stat-card-icon"><i class="fas fa-users"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Tổng người dùng</div>
                                <div class="stat-card-value">${d.totalUsers}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--active">
                            <div class="stat-card-icon"><i class="fas fa-user-check"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">User hoạt động</div>
                                <div class="stat-card-value">${d.activeUsers}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--products">
                            <div class="stat-card-icon"><i class="fas fa-box-open"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Sản phẩm</div>
                                <div class="stat-card-value">${d.totalProducts}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--storage">
                            <div class="stat-card-icon"><i class="fas fa-database"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Dung lượng dữ liệu</div>
                                <div class="stat-card-value">${formatBytes(d.dbSizeBytes || 0)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="section-card section-spaced">
                        <div class="section-header">
                            <div>
                                <h3 class="section-title"><i class="fas fa-server" style="margin-right:8px;color:var(--primary)"></i>Trạng thái hệ thống</h3>
                                <p class="section-subtitle">RAM, CPU và lưu lượng request gần đây.</p>
                            </div>
                        </div>
                        <div class="donut-grid">
                            <div class="donut-card">
                                <div id="donut-ram" class="donut-shell"></div>
                                <div class="donut-meta">
                                    <div class="donut-title"><i class="fas fa-memory" style="margin-right:6px;color:#22c55e"></i>RAM</div>
                                    <div class="donut-text">${formatBytes(mem.usedBytes || 0)} / ${formatBytes(mem.totalBytes || 0)}</div>
                                    <div class="donut-sub">Còn trống: ${formatBytes(mem.freeBytes || Math.max((mem.totalBytes || 0) - (mem.usedBytes || 0), 0))}</div>
                                </div>
                            </div>
                            <div class="donut-card">
                                <div id="donut-cpu" class="donut-shell"></div>
                                <div class="donut-meta">
                                    <div class="donut-title"><i class="fas fa-microchip" style="margin-right:6px;color:#6366f1"></i>CPU</div>
                                    <div class="donut-text">${cpu.model || 'Không rõ'}</div>
                                    <div class="donut-sub">${cpu.cores || 0} cores · Load 1m: ${load1m.toFixed(2)}</div>
                                </div>
                            </div>
                            <div class="donut-card">
                                <div id="donut-req" class="donut-shell"></div>
                                <div class="donut-meta">
                                    <div class="donut-title"><i class="fas fa-bolt" style="margin-right:6px;color:#f97316"></i>Requests</div>
                                    <div class="donut-text">5p: ${reqLast5m} · 1h: ${reqLast1h}</div>
                                    <div class="donut-sub">Tổng uptime: ${reqTotal} · Buffer: ${reqStats.buffered ?? 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="chart-grid">
                        <div class="chart-card">
                            <div class="chart-header">
                                <div>
                                    <div class="chart-title"><i class="fas fa-chart-bar" style="margin-right:6px"></i>Doanh thu 30 ngày</div>
                                    <div class="chart-subtitle">Giao dịch purchase theo ngày</div>
                                </div>
                                <div class="chart-total">${formatMoney(dailyTotal)}</div>
                            </div>
                            <div id="chart-daily" class="line-chart"></div>
                        </div>
                        <div class="chart-card">
                            <div class="chart-header">
                                <div>
                                    <div class="chart-title"><i class="fas fa-chart-area" style="margin-right:6px"></i>Doanh thu 12 tháng</div>
                                    <div class="chart-subtitle">Giao dịch purchase theo tháng</div>
                                </div>
                                <div class="chart-total">${formatMoney(monthlyTotal)}</div>
                            </div>
                            <div id="chart-monthly" class="line-chart"></div>
                        </div>
                    </div>
                    <div class="section-spaced">
                        <button id="reset-revenue" class="btn-primary"><i class="fas fa-rotate-left" style="margin-right:6px"></i>Reset doanh thu</button>
                    </div>
                    <div id="dashboard-security-shortcut"></div>
                `;
                document.getElementById('reset-revenue').addEventListener('click', async () => {
                    if (confirm('Reset doanh thu về 0?')) {
                        await api.post('/admin/revenue/reset');
                        await loadDashboard();
                    }
                });

                renderDonutChart(document.getElementById('donut-ram'), Math.max(0, Math.min(100, Math.round(mem.usedPercent || 0))), { from: '#22c55e', to: '#16a34a' });
                renderDonutChart(document.getElementById('donut-cpu'), cpuLoadPercent, { from: '#6366f1', to: '#7c3aed' });
                renderDonutChart(document.getElementById('donut-req'), reqLoadPercent, { from: '#f97316', to: '#fb923c' });

                renderComboChart(document.getElementById('chart-daily'), dailySeries, { maxPoints: 30, labelFormat: 'day' });
                renderComboChart(document.getElementById('chart-monthly'), monthlySeries, { maxPoints: 12, labelFormat: 'month' });
                await loadDashboardSecurityShortcut();
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải dashboard.</p>';
        }
    }

    async function loadDashboardSecurityShortcut() {
        const slot = document.getElementById('dashboard-security-shortcut');
        if (!slot) return;

        try {
            const response = await api.get('/admin/security-overview');
            if (!response.success) {
                throw new Error('Khong the tai thong tin bao mat');
            }

            const summary = response.data?.summary || {};
            slot.innerHTML = `
                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title"><i class="fas fa-shield-halved" style="margin-right:8px;color:#ef4444"></i>Bảo mật</h3>
                            <p class="section-subtitle">Xem nhanh API bị chặn và tài khoản đang khóa.</p>
                        </div>
                        <button id="dashboard-open-security" class="btn-outline"><i class="fas fa-arrow-right" style="margin-right:6px"></i>Mở trung tâm bảo mật</button>
                    </div>
                    <div class="stat-grid admin-stat-grid">
                        <div class="stat-card stat-card--danger">
                            <div class="stat-card-icon"><i class="fas fa-ban"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">API bị chặn</div>
                                <div class="stat-card-value">${Number(summary.blockedApiEndpointCount || 0)}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--warning">
                            <div class="stat-card-icon"><i class="fas fa-globe"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">IP đang block</div>
                                <div class="stat-card-value">${Number(summary.blockedIpCount || 0)}</div>
                            </div>
                        </div>
                        <div class="stat-card stat-card--danger">
                            <div class="stat-card-icon"><i class="fas fa-lock"></i></div>
                            <div class="stat-card-body">
                                <div class="stat-card-label">Tài khoản đang khóa</div>
                                <div class="stat-card-value">${Number(summary.lockedAccountCount || 0)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const openBtn = document.getElementById('dashboard-open-security');
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    window.router?.navigate('/admin?tab=security');
                });
            }
        } catch (error) {
            slot.innerHTML = '';
        }
    }

    async function loadUsers() {
        const container = document.getElementById('tab-users');
        try {
            const response = await api.get('/admin/users');
            if (response.success) {
                const userMap = new Map((response.data || []).map(user => [String(user.id), user]));
                container.innerHTML = `
                    <div class="section-card section-spaced">
                        <h3 class="section-title">Cộng/trừ tiền thủ công</h3>
                        <form id="adjust-form">
                            <input type="number" name="user_id" placeholder="User ID" required>
                            <input type="number" name="amount" placeholder="Amount (có thể âm)" required>
                            <input type="text" name="description" placeholder="Lý do">
                            <button type="submit" class="btn-primary">Cập nhật</button>
                        </form>
                    </div>
                    <table class="table"> 
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Email</th>
                                <th>Vai trò</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(user => `
                                <tr>
                                    <td>${user.id}</td>
                                    <td>${renderDisplayName(user, '-')}</td>
                                    <td>${user.email}</td>
                                    <td>
                                        <select data-role="${user.id}">
                                            ${['user','seller','admin'].map(r => `<option value="${r}" ${r===user.role?'selected':''}>${r}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <select data-status="${user.id}">
                                            ${['active','banned'].map(s => `<option value="${s}" ${s===user.status?'selected':''}>${s}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-ghost btn-danger" data-delete="${user.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div id="inactive-users" class="section-card section-spaced"></div>
                `;

                const adjustForm = document.getElementById('adjust-form');
                adjustForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await api.post('/admin/balance/adjust', {
                        user_id: parseInt(adjustForm.user_id.value),
                        amount: parseFloat(adjustForm.amount.value),
                        description: adjustForm.description.value
                    });
                    showToast('Đã cập nhật số dư', 'success');
                    adjustForm.reset();
                });

                container.querySelectorAll('select[data-role]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        await api.put(`/admin/users/${sel.dataset.role}/role`, { role: sel.value });
                        showToast('Đã cập nhật vai trò', 'success');
                    });
                });
                container.querySelectorAll('select[data-status]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        try {
                            await api.put(`/admin/users/${sel.dataset.status}/status`, { status: sel.value });
                            showToast('Đã cập nhật trạng thái', 'success');
                        } catch (error) {
                            showToast(error.message || 'Không thể cập nhật trạng thái', 'error');
                            await loadUsers();
                        }
                    });
                });
                container.querySelectorAll('button[data-delete]').forEach(btn => {
                    const user = userMap.get(String(btn.dataset.delete));
                    if (user && btn.parentElement) {
                        const verifyBtn = document.createElement('button');
                        verifyBtn.type = 'button';
                        verifyBtn.className = 'btn-outline';
                        verifyBtn.textContent = user.is_verified ? 'Bo tich xanh' : 'Cap tich xanh';
                        verifyBtn.style.marginRight = '8px';
                        verifyBtn.addEventListener('click', async () => {
                            try {
                                await api.put(`/admin/users/${user.id}/verified`, {
                                    is_verified: !user.is_verified
                                });
                                showToast('Da cap nhat tich xanh', 'success');
                                await loadUsers();
                            } catch (error) {
                                showToast(error.message || 'Khong the cap nhat tich xanh', 'error');
                            }
                        });
                        btn.parentElement.insertBefore(verifyBtn, btn);
                    }
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa user?')) {
                            await api.delete(`/admin/users/${btn.dataset.delete}`);
                            await loadUsers();
                        }
                    });
                });

                await loadInactiveUsers();
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải user.</p>';
        }
    }

    async function loadInactiveUsers() {
        const container = document.getElementById('inactive-users');
        if (!container) return;
        try {
            const response = await api.get('/admin/users/inactive', { days: 30, limit: 100 });
            if (!response.success) {
                container.innerHTML = '<p>Không thể tải danh sách user không hoạt động.</p>';
                return;
            }
            const items = response.data || [];
            container.innerHTML = `
                <div class="section-header">
                    <div>
                        <h3 class="section-title">User off hơn 30 ngày</h3>
                        <p class="section-subtitle">Có thể xóa nếu không hoạt động trong 1 tháng.</p>
                    </div>
                    <button id="delete-inactive" class="btn-danger">Xóa tất cả</button>
                </div>
                ${items.length ? `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Email</th>
                                <th>Họ tên</th>
                                <th>Last login</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(u => `
                                <tr>
                                    <td>${u.id}</td>
                                    <td>${u.email}</td>
                                    <td>${u.full_name || '-'}</td>
                                    <td>${u.last_login ? formatDateShort(u.last_login) : 'Chưa đăng nhập'}</td>
                                    <td>
                                        <button class="btn-ghost btn-danger" data-inactive-delete="${u.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>Không có user off quá 30 ngày.</p>'}
            `;

            const deleteAllBtn = document.getElementById('delete-inactive');
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', async () => {
                    if (!confirm('Xóa tất cả user off hơn 30 ngày?')) return;
                    await api.delete('/admin/users/inactive?days=30');
                    await loadUsers();
                });
            }

            container.querySelectorAll('button[data-inactive-delete]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Xóa user này?')) return;
                    await api.delete(`/admin/users/${btn.dataset.inactiveDelete}`);
                    await loadUsers();
                });
            });
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh sách user không hoạt động.</p>';
        }
    }

    async function loadDeposits() {
        const container = document.getElementById('tab-deposits');
        try {
            const response = await api.get('/admin/deposit-requests');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Số tiền</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(r => `
                                <tr>
                                    <td>${r.id}</td>
                                    <td>${r.email}</td>
                                    <td>${formatMoney(r.amount)}</td>
                                    <td>${r.status}</td>
                                    <td>
                                        ${r.status === 'pending' ? `
                                            <button class="btn-primary" data-approve="${r.id}">Duyệt</button>
                                            <button class="btn-outline" data-reject="${r.id}">Từ chối</button>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                container.querySelectorAll('button[data-approve]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await api.put(`/admin/deposit-requests/${btn.dataset.approve}/approve`, { approve: true });
                        await loadDeposits();
                    });
                });
                container.querySelectorAll('button[data-reject]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await api.put(`/admin/deposit-requests/${btn.dataset.reject}/approve`, { approve: false });
                        await loadDeposits();
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải yêu cầu nạp.</p>';
        }
    }

    async function loadWithdrawals() {
        const container = document.getElementById('tab-withdrawals');
        if (!container) return;
        try {
            const response = await api.get('/withdraw/admin/requests', {}, { forceRefresh: true });
            const rows = response.success ? (response.data || []) : [];
            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Yeu cau rut tien</h3>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>User</th>
                                    <th>So tien</th>
                                    <th>Phi</th>
                                    <th>Thuc nhan</th>
                                    <th>Trang thai</th>
                                    <th>Du kien</th>
                                    <th>Hanh dong</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map(r => `
                                    <tr>
                                        <td>${r.id}</td>
                                        <td>${escapeHtml(r.email || r.full_name || '')}</td>
                                        <td>${formatMoney(r.amount || 0)}</td>
                                        <td>${formatMoney(r.fee || 0)}</td>
                                        <td>${formatMoney(r.net_amount || 0)}</td>
                                        <td>${escapeHtml(r.status || '')}</td>
                                        <td>${r.expected_at ? formatDateShort(r.expected_at) : '5-7 ngay'}</td>
                                        <td>
                                            ${r.status === 'pending' ? `
                                                <button class="btn-primary" data-withdraw-approve="${r.id}">Duyet</button>
                                                <button class="btn-outline" data-withdraw-reject="${r.id}">Tu choi</button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            container.querySelectorAll('[data-withdraw-approve]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const adminNote = prompt('Ghi chu admin (co the bo trong):', '') || '';
                    await api.post(`/withdraw/admin/approve/${btn.dataset.withdrawApprove}`, { adminNote });
                    await loadWithdrawals();
                });
            });
            container.querySelectorAll('[data-withdraw-reject]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const adminNote = prompt('Ly do tu choi:', '') || '';
                    await api.post(`/withdraw/admin/reject/${btn.dataset.withdrawReject}`, { adminNote });
                    await loadWithdrawals();
                });
            });
        } catch (error) {
            container.innerHTML = '<p>Khong the tai yeu cau rut tien.</p>';
        }
    }

    async function loadProducts() {
        const container = document.getElementById('tab-products');
        try {
            const response = await api.get('/admin/products');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Seller</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(p => `
                                <tr>
                                    <td>${p.id}</td>
                                    <td>${escapeHtml(p.title)}</td>
                                    <td>${escapeHtml(p.seller_name)}</td>
                                    <td>
                                        <select data-product-status="${p.id}">
                                            ${['active','inactive','banned'].map(s => `<option value="${s}" ${s===p.status?'selected':''}>${s}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-outline" data-product-edit="${p.id}">Sửa</button>
                                        <button class="btn-ghost btn-danger" data-product-delete="${p.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('select[data-product-status]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        await api.put(`/admin/products/${sel.dataset.productStatus}/status`, { status: sel.value });
                        showToast('Đã cập nhật', 'success');
                    });
                });
                container.querySelectorAll('button[data-product-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa sản phẩm?')) {
                            await api.delete(`/admin/products/${btn.dataset.productDelete}`);
                            await loadProducts();
                        }
                    });
                });
                container.querySelectorAll('button[data-product-edit]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        router.navigate(`/suasanpham/${btn.dataset.productEdit}`);
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải sản phẩm.</p>';
        }
    }

    async function loadCategories() {
        const container = document.getElementById('tab-categories');
        try {
            const response = await api.get('/admin/categories');
            if (response.success) {
                const categories = response.data || [];
                container.innerHTML = `
                    <div class="section-card section-spaced">
                        <h3 class="section-title">Thêm danh mục</h3>
                        <form id="category-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên</label>
                                <input type="text" name="name" required>
                            </div>
                            <div class="form-group">
                                <label>Slug (tùy chọn)</label>
                                <input type="text" name="slug" placeholder="tu-dong-neu-bo-trong">
                            </div>
                            <div class="form-group">
                                <label>Icon (link ảnh hoặc FontAwesome)</label>
                                <input type="text" name="icon" placeholder="https://... hoặc fa-layer-group">
                            </div>
                            <div class="form-group">
                                <label>Thứ tự hiển thị</label>
                                <input type="number" name="display_order" value="0">
                            </div>
                            <div class="form-group full">
                                <label>Hoạt động</label>
                                <select name="is_active">
                                    <option value="1">Bật</option>
                                    <option value="0">Tắt</option>
                                </select>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Thêm danh mục</button>
                            </div>
                        </form>
                    </div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Slug</th>
                                <th>Icon</th>
                                <th>Thứ tự</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categories.map(cat => `
                                <tr>
                                    <td>${cat.id}</td>
                                    <td><input type="text" value="${escapeHtml(cat.name)}" data-cat-name="${cat.id}"></td>
                                    <td><input type="text" value="${escapeHtml(cat.slug)}" data-cat-slug="${cat.id}"></td>
                                    <td><input type="text" value="${escapeHtml(cat.icon || '')}" data-cat-icon="${cat.id}"></td>
                                    <td><input type="number" value="${cat.display_order || 0}" data-cat-order="${cat.id}"></td>
                                    <td>
                                        <select data-cat-active="${cat.id}">
                                            <option value="1" ${cat.is_active ? 'selected' : ''}>Bật</option>
                                            <option value="0" ${!cat.is_active ? 'selected' : ''}>Tắt</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-outline" data-cat-save="${cat.id}">LÆ°u</button>
                                        <button class="btn-ghost btn-danger" data-cat-delete="${cat.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                const form = document.getElementById('category-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        name: form.name.value.trim(),
                        slug: form.slug.value.trim(),
                        icon: form.icon.value.trim(),
                        display_order: parseInt(form.display_order.value || '0', 10),
                        is_active: form.is_active.value === '1'
                    };
                    await api.post('/admin/categories', payload);
                    showToast('Đã thêm danh mục', 'success');
                    await loadCategories();
                });

                container.querySelectorAll('button[data-cat-save]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.catSave;
                        const payload = {
                            name: container.querySelector(`[data-cat-name="${id}"]`).value.trim(),
                            slug: container.querySelector(`[data-cat-slug="${id}"]`).value.trim(),
                            icon: container.querySelector(`[data-cat-icon="${id}"]`).value.trim(),
                            display_order: parseInt(container.querySelector(`[data-cat-order="${id}"]`).value || '0', 10),
                            is_active: container.querySelector(`[data-cat-active="${id}"]`).value === '1'
                        };
                        await api.put(`/admin/categories/${id}`, payload);
                        showToast('Đã cập nhật danh mục', 'success');
                    });
                });

                container.querySelectorAll('button[data-cat-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Xóa danh mục?')) return;
                        await api.delete(`/admin/categories/${btn.dataset.catDelete}`);
                        await loadCategories();
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh mục.</p>';
        }
    }

    async function loadPosts() {
        const container = document.getElementById('tab-posts');
        try {
            const response = await api.get('/admin/posts');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Nội dung</th>
                                <th>Ngày</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(p => `
                                <tr>
                                    <td>${p.id}</td>
                                    <td>${p.full_name}</td>
                                    <td>${escapeHtml(p.content).substring(0, 50)}...</td>
                                    <td>${formatDateShort(p.created_at)}</td>
                                    <td><button class="btn-ghost btn-danger" data-post-delete="${p.id}">Xóa</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('button[data-post-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa bài đăng?')) {
                            await api.delete(`/admin/posts/${btn.dataset.postDelete}`);
                            await loadPosts();
                        }
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải bài đăng.</p>';
        }
    }

    async function loadMessages() {
        const container = document.getElementById('tab-messages');
        try {
            const response = await api.get('/admin/messages');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Sender</th>
                                <th>Receiver</th>
                                <th>Action</th>
                                <th>Loại</th>
                                <th>Nội dung</th>
                                <th>Ngày</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(m => `
                                <tr>
                                    <td>${m.id}</td>
                                    <td>${escapeHtml(m.sender_name || `User #${m.sender_id}`)}</td>
                                    <td>${escapeHtml(m.receiver_name || `User #${m.receiver_id}`)}</td>
                                    <td><button type="button" class="btn-ghost btn-danger" data-admin-message-delete="${m.id}">Xoa</button></td>
                                    <td>${escapeHtml(m.message_type || 'text')}</td>
                                    <td class="admin-message-content">${renderMessageBodyHtml(m)}</td>
                                    <td>${formatDateShort(m.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('button[data-admin-message-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Xoa tin nhan nay?')) return;
                        try {
                            const resp = await api.delete(`/admin/messages/${btn.dataset.adminMessageDelete}`);
                            if (resp.success) {
                                showToast('Da xoa tin nhan', 'success');
                                await loadMessages();
                            }
                        } catch (deleteError) {
                            showToast(deleteError.message || 'Khong the xoa tin nhan', 'error');
                        }
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        }
    }

    async function loadSupport() {
        const container = document.getElementById('tab-support');
        try {
            const response = await api.get('/admin/support/threads');
            if (response.success) {
                container.innerHTML = `
                    <div class="admin-chat">
                        <div class="admin-chat-list">
                            ${response.data.map(item => `
                                <button class="admin-chat-item" data-user="${item.user_id}">
                                    <div class="admin-chat-name">${escapeHtml(item.full_name || item.email || `User #${item.user_id}`)}</div>
                                    <div class="admin-chat-preview">${escapeHtml(getMessagePreview(item, 90))}</div>
                                </button>
                            `).join('')}
                        </div>
                        <div class="admin-chat-thread">
                            <div id="admin-chat-messages" class="chat-messages"></div>
                            <form id="admin-chat-form" class="chat-input">
                                <input type="text" name="content" placeholder="Nhập phản hồi..." required>
                                <button type="submit" class="btn-primary">Gửi</button>
                            </form>
                        </div>
                    </div>
                `;

                const messageBox = document.getElementById('admin-chat-messages');
                const form = document.getElementById('admin-chat-form');
                let activeUserId = null;

                async function loadThread(userId) {
                    activeUserId = userId;
                    const res = await api.get(`/admin/support/thread/${userId}`);
                    if (res.success) {
                        const adminId = res.admin_id;
                        messageBox.innerHTML = (res.data || []).map(m => `
                            <div class="chat-bubble ${m.sender_id === adminId ? 'me' : 'admin'}">
                                <div class="chat-meta">${formatDateShort(m.created_at)}</div>
                                <div class="chat-text">${renderMessageBodyHtml(m)}</div>
                            </div>
                        `).join('');
                        messageBox.scrollTop = messageBox.scrollHeight;
                    }
                }

                container.querySelectorAll('.admin-chat-item').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        container.querySelectorAll('.admin-chat-item').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        await loadThread(btn.dataset.user);
                    });
                });

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!activeUserId) return;
                    const content = form.content.value.trim();
                    if (!content) return;
                    await api.post(`/admin/support/thread/${activeUserId}`, { content });
                    form.content.value = '';
                    await loadThread(activeUserId);
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải hỗ trợ/tố cáo.</p>';
        }
    }

    async function loadNotifications() {
        const container = document.getElementById('tab-notifications');
        if (!container) return;
        try {
            const [usersRes, noticesRes] = await Promise.all([
                api.get('/admin/users', { limit: 200 }),
                api.get('/admin/notifications', { limit: 100 })
            ]);

            const users = usersRes.success ? usersRes.data : [];
            const notices = noticesRes.success ? noticesRes.data : [];

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Tạo thông báo</h3>
                    <form id="notification-form" class="form-grid form-grid-2">
                        <div class="form-group">
                            <label>Tiêu đề</label>
                            <input type="text" name="title" required>
                        </div>
                        <div class="form-group full">
                            <label>Chọn người nhận</label>
                            <input type="text" id="notif-search" placeholder="Tìm kiếm theo email hoặc tên...">
                            <div id="notif-user-list" class="notif-user-list"></div>
                            <div class="notif-select-meta">
                                <small>Chọn nhiều tài khoản (không chọn sẽ gửi cho tất cả).</small>
                                <span id="notif-selected-count" class="badge badge-info">0 đã chọn</span>
                            </div>
                        </div>
                        <div class="form-group full">
                            <label>Ảnh thông báo (tùy chọn)</label>
                            <div class="file-picker">
                                <input type="file" id="notif-image" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="notif-image" data-file-label="notif-image-label">Chọn ảnh</button>
                                <span id="notif-image-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <div id="notif-preview" class="upload-preview"></div>
                        </div>
                        <div class="form-group full">
                            <label>Nội dung</label>
                            <textarea name="content" rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="tos-checkbox">
                                <input type="checkbox" name="is_important">
                                <span>Thong bao quan trong (hien popup khi vao web)</span>
                            </label>
                        </div>
                        <div class="form-group">
                            <label>Dong tam (gio)</label>
                            <input type="number" name="dismiss_hours" min="1" max="168" value="2">
                        </div>
                        <div class="form-group full">
                            <button type="submit" class="btn-primary">Dang thong bao</button>
                        </div>
                    </form>
                </div>
                <div class="section-card">
                    <h3 class="section-title">Thông báo gần đây</h3>
                    ${notices.length ? `
                        <div class="notif-cards">
                            ${notices.map(n => `
                                <div class="notif-card">
                                    <div class="notif-card-header">
                                        <div>
                                            <div class="notif-card-title">${n.title}</div>
                                            <div class="notif-card-meta">${n.target_email || 'Tất cả'} • ${formatDateShort(n.created_at)}</div>
                                        </div>
                                        <div class="badge-row">
                                            ${Number(n.is_important || 0) === 1 ? '<div class="badge badge-warning">Quan trong</div>' : ''}
                                            <div class="badge badge-info">#${n.id}</div>
                                        </div>
                                    </div>
                                    ${n.image_url ? `<img src="${n.image_url}" class="notif-card-image" alt="notif">` : ''}
                                    ${n.content ? `<div class="notif-card-content">${n.content}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>Chưa có thông báo.</p>'}
                </div>
            `;

            const form = document.getElementById('notification-form');
            const searchInput = document.getElementById('notif-search');
            const userList = document.getElementById('notif-user-list');
            const imageInput = document.getElementById('notif-image');
            const imageLabel = document.getElementById('notif-image-label');
            const imagePreview = document.getElementById('notif-preview');
            let imageFile = null;
            const selectedUserIds = new Set();
            const selectedCount = document.getElementById('notif-selected-count');

            const renderUserList = (filterText = '') => {
                const keyword = filterText.trim().toLowerCase();
                const filtered = users.filter(u => {
                    const email = (u.email || '').toLowerCase();
                    const name = (u.full_name || '').toLowerCase();
                    return !keyword || email.includes(keyword) || name.includes(keyword);
                });

                userList.innerHTML = filtered.length ? filtered.map(u => `
                    <label class="notif-user-item">
                        <input type="checkbox" name="notif_target" value="${u.id}" ${selectedUserIds.has(String(u.id)) ? 'checked' : ''}>
                        <div class="notif-user-info">
                            <div class="notif-user-email">${u.email}</div>
                            ${u.full_name ? `<div class="notif-user-name">${u.full_name}</div>` : ''}
                        </div>
                    </label>
                `).join('') : '<p>Không tìm thấy user.</p>';

                userList.querySelectorAll('input[name="notif_target"]').forEach(input => {
                    input.addEventListener('change', () => {
                        if (input.checked) {
                            selectedUserIds.add(input.value);
                        } else {
                            selectedUserIds.delete(input.value);
                        }
                        updateSelectedCount();
                    });
                });
            };

            renderUserList();
            searchInput.addEventListener('input', (e) => {
                renderUserList(e.target.value);
            });

            initFilePickers(container);
            if (imageInput) {
                imageInput.addEventListener('change', () => {
                    imageFile = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
                    renderImagePreview();
                });
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    title: form.title.value.trim(),
                    content: form.content.value.trim(),
                    is_important: !!form.is_important.checked,
                    dismiss_hours: parseInt(form.dismiss_hours.value || '2', 10)
                };
                if (!payload.title) return;
                if (!Number.isFinite(payload.dismiss_hours) || payload.dismiss_hours < 1) {
                    payload.dismiss_hours = 2;
                }
                if (payload.dismiss_hours > 168) payload.dismiss_hours = 168;
                if (selectedUserIds.size > 0) {
                    payload.target_user_ids = Array.from(selectedUserIds);
                }
                if (imageFile) {
                    if (!imageFile.type.startsWith('image/')) {
                        showToast('Ảnh thông báo phải là file ảnh', 'error');
                        return;
                    }
                    const bar = imagePreview ? imagePreview.querySelector('.upload-progress-bar') : null;
                    const text = imagePreview ? imagePreview.querySelector('.upload-progress-text') : null;
                    const fd = new FormData();
                    fd.append('file', imageFile);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        payload.image_url = upload.data.url;
                    }
                }
                await api.post('/admin/notifications', payload);
                showToast('Đã đăng thông báo', 'success');
                await loadNotifications();
            });

            function renderImagePreview() {
                if (!imagePreview) return;
                if (!imageFile) {
                    imagePreview.innerHTML = '';
                    return;
                }
                const url = URL.createObjectURL(imageFile);
                imagePreview.innerHTML = `
                    <div class="upload-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;
                const btn = imagePreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        imageFile = null;
                        if (imageInput) imageInput.value = '';
                        setFileLabel(imageInput, imageLabel);
                        renderImagePreview();
                    });
                }
            }

            function updateSelectedCount() {
                if (!selectedCount) return;
                selectedCount.textContent = `${selectedUserIds.size} đã chọn`;
            }

            updateSelectedCount();
        } catch (error) {
            container.innerHTML = '<p>Không thể tải thông báo.</p>';
        }
    }

    async function loadInspect() {
        const container = document.getElementById('tab-inspect');
        if (!container) return;
        try {
            const res = await api.get('/admin/users', { limit: 300 });
            const users = res.success ? res.data : [];

            container.innerHTML = `
                <div class="section-card inspect-layout">
                    <div class="inspect-list">
                        <div class="section-header inspect-header">
                            <div>
                                <h3 class="section-title">Danh sách tài khoản</h3>
                                <p class="section-subtitle">Chọn để xem hoạt động chi tiết.</p>
                            </div>
                            <input type="text" id="inspect-search" class="input inspect-search" placeholder="Tìm theo email hoặc tên">
                        </div>
                        <div id="inspect-user-list" class="inspect-user-list"></div>
                    </div>
                    <div class="inspect-detail" id="inspect-detail">
                        <p>Chọn một tài khoản để xem chi tiết.</p>
                    </div>
                </div>
            `;

            const listEl = document.getElementById('inspect-user-list');
            const searchEl = document.getElementById('inspect-search');
            const detailEl = document.getElementById('inspect-detail');
            const safeText = (value) => escapeHtml(String(value ?? ''));
            const formatInspectIpSource = (source = '') => {
                switch (String(source || '').toLowerCase()) {
                    case 'register_ip':
                        return 'register';
                    case 'last_login_ip':
                        return 'last login';
                    case 'login':
                        return 'login';
                    case 'request':
                        return 'request';
                    case 'security':
                        return 'security';
                    case 'failed_login':
                        return 'failed login';
                    default:
                        return source || 'ip';
                }
            };

            const renderList = (keyword = '') => {
                const kw = keyword.trim().toLowerCase();
                const filtered = users.filter(u => {
                    const email = (u.email || '').toLowerCase();
                    const name = (u.full_name || '').toLowerCase();
                    return !kw || email.includes(kw) || name.includes(kw);
                });

                listEl.innerHTML = filtered.length ? filtered.map(u => `
                    <button class="inspect-user" data-id="${u.id}">
                        <div class="inspect-user-head">
                            <div class="inspect-user-email">${u.email}</div>
                            <span class="inspect-chip ${u.status === 'banned' ? 'chip-error' : 'chip-success'}">${u.status}</span>
                        </div>
                        <div class="inspect-user-meta">${u.full_name || '-'} â€¢ ${u.role}</div>
                        <div class="inspect-user-balance">${formatMoney(u.balance || 0)}</div>
                    </button>
                `).join('') : '<p>Không có tài khoản.</p>';

                listEl.querySelectorAll('.inspect-user').forEach(btn => {
                    btn.addEventListener('click', () => {
                        listEl.querySelectorAll('.inspect-user').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        loadDetail(btn.dataset.id);
                    });
                });
            };

            const renderDetail = (payload) => {
                if (!detailEl) return;
                if (!payload) {
                    detailEl.innerHTML = '<p>Không lấy được thông tin.</p>';
                    return;
                }
                const { user, activities = [] } = payload;
                const lastActive = user.last_login ? formatDateShort(user.last_login) : 'Chưa đăng nhập';
                const created = user.created_at ? formatDateShort(user.created_at) : '';
                const statusLabel = user.status === 'banned' ? 'Đã khóa' : 'Hoạt động';
                const lockAction = user.status === 'banned' ? 'Mở khóa' : 'Khóa nick';

                detailEl.innerHTML = `
                    <div class="inspect-head">
                        <div>
                            <h3 class="section-title">${user.full_name || 'Không tên'}</h3>
                            <p class="section-subtitle">${user.email}</p>
                        </div>
                        <div class="inspect-actions">
                            <span class="chip ${user.status === 'banned' ? 'chip-error' : 'chip-success'}">${statusLabel}</span>
                            <span class="chip chip-ghost">${user.role}</span>
                            <button id="inspect-lock-btn" class="btn-ghost">${lockAction}</button>
                        </div>
                    </div>
                    <div class="inspect-grid">
                        <div class="inspect-stat"><label>Số tiền</label><strong>${formatMoney(user.balance || 0)}</strong></div>
                        <div class="inspect-stat"><label>Giới tính</label><strong>${user.gender || '-'}</strong></div>
                        <div class="inspect-stat"><label>Hoạt động gần nhất</label><strong>${lastActive}</strong></div>
                        <div class="inspect-stat"><label>Ngày tạo</label><strong>${created}</strong></div>
                    </div>
                    <div class="inspect-timeline-wrap">
                        <div class="inspect-timeline-head">
                            <h4 class="section-title">Hoạt động gần đây</h4>
                            <span class="section-subtitle">Tối đa 15 sự kiện mới nhất</span>
                        </div>
                        ${activities.length ? `
                            <ul class="inspect-timeline">
                                ${activities.map(a => `
                                    <li>
                                        <div class="inspect-dot"></div>
                                        <div class="inspect-timeline-body">
                                            <div class="inspect-timeline-top">
                                                <span class="inspect-activity-type">${a.type}</span>
                                                <span class="inspect-activity-time">${formatDateShort(a.at)}</span>
                                            </div>
                                            <div class="inspect-activity-text">${a.text || ''}</div>
                                            ${a.amount !== undefined ? `<div class="inspect-amount ${a.amount < 0 ? 'minus' : 'plus'}">${formatMoney(a.amount)}</div>` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : '<p>Chưa ghi nhận hoạt động.</p>'}
                    </div>
                `;

                const lockBtn = document.getElementById('inspect-lock-btn');
                if (lockBtn) {
                    lockBtn.addEventListener('click', async () => {
                        const targetStatus = user.status === 'banned' ? 'active' : 'banned';
                        const pwd = prompt('Nhập mật khẩu admin để xác nhận:');
                        if (!pwd) return;
                        const resp = await api.post(`/admin/users/${user.id}/status`, {
                            status: targetStatus,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Cập nhật trạng thái thành công', 'success');
                            await loadInspect();
                        } else {
                            showToast(resp.message || 'Không thể cập nhật trạng thái', 'error');
                        }
                    });
                }
            };

            const renderInspectDetailWithIps = (payload) => {
                if (!detailEl) return;
                if (!payload) {
                    detailEl.innerHTML = '<p>Khong lay duoc thong tin.</p>';
                    return;
                }

                const { user, activities = [], recentIps = [] } = payload;
                const lastActive = user.last_login ? formatDateShort(user.last_login) : 'Chua dang nhap';
                const created = user.created_at ? formatDateShort(user.created_at) : '';
                const statusLabel = user.status === 'banned' ? 'Da khoa' : 'Hoat dong';
                const lockAction = user.status === 'banned' ? 'Mo khoa' : 'Khoa nick';
                const registerIp = user.register_ip || '-';
                const lastLoginIp = user.last_login_ip || '-';
                const failedLoginIp = user.last_failed_login_ip || '-';
                const loginLockUntil = user.login_locked_until ? formatDateShort(user.login_locked_until) : 'Khong';
                const securityLockReason = user.security_lock_reason === 'shared_ip_terms_lock'
                    ? 'Khoa chung theo IP'
                    : (user.security_lock_reason ? String(user.security_lock_reason) : 'Khong');

                detailEl.innerHTML = `
                    <div class="inspect-head">
                        <div>
                            <h3 class="section-title">${safeText(user.full_name || 'Khong ten')}</h3>
                            <p class="section-subtitle">${safeText(user.email || '')}</p>
                        </div>
                        <div class="inspect-actions">
                            <span class="chip ${user.status === 'banned' ? 'chip-error' : 'chip-success'}">${statusLabel}</span>
                            <span class="chip chip-ghost">${safeText(user.role || '-')}</span>
                            <button id="inspect-lock-btn" class="btn-ghost">${lockAction}</button>
                        </div>
                    </div>
                    <div class="inspect-grid">
                        <div class="inspect-stat"><label>So tien</label><strong>${formatMoney(user.balance || 0)}</strong></div>
                        <div class="inspect-stat"><label>Gioi tinh</label><strong>${safeText(user.gender || '-')}</strong></div>
                        <div class="inspect-stat"><label>Hoat dong gan nhat</label><strong>${safeText(lastActive)}</strong></div>
                        <div class="inspect-stat"><label>Ngay tao</label><strong>${safeText(created)}</strong></div>
                        <div class="inspect-stat"><label>IP dang ky</label><strong>${safeText(registerIp)}</strong></div>
                        <div class="inspect-stat"><label>IP login cuoi</label><strong>${safeText(lastLoginIp)}</strong></div>
                        <div class="inspect-stat"><label>IP sai mat khau gan nhat</label><strong>${safeText(failedLoginIp)}</strong></div>
                        <div class="inspect-stat"><label>Khoa login den</label><strong>${safeText(loginLockUntil)}</strong></div>
                        <div class="inspect-stat"><label>Khoa bao mat</label><strong>${safeText(securityLockReason)}</strong></div>
                    </div>
                    <div class="inspect-ip-wrap">
                        <div class="inspect-timeline-head">
                            <h4 class="section-title">IP gan day</h4>
                            <span class="section-subtitle">Admin co the chan hoac mo chan tung IP</span>
                        </div>
                        ${recentIps.length ? `
                            <div class="inspect-ip-list">
                                ${recentIps.map((entry) => `
                                    <div class="inspect-ip-card">
                                        <div class="inspect-ip-main">
                                            <div class="inspect-ip-value">${safeText(entry.ip)}</div>
                                            <div class="inspect-ip-meta">
                                                <span>${entry.lastSeenAt ? formatDateShort(entry.lastSeenAt) : 'Chua xac dinh'}</span>
                                                <span>â€¢</span>
                                                <span>${entry.sources.map(formatInspectIpSource).map(safeText).join(', ')}</span>
                                            </div>
                                        </div>
                                        <div class="inspect-ip-actions">
                                            ${entry.block ? `
                                                <span class="inspect-chip ${entry.block.isManual ? 'chip-error' : 'chip-ghost'}">
                                                    ${entry.block.isManual ? 'Da chan thu cong' : 'Dang bi chan'}
                                                </span>
                                            ` : '<span class="inspect-chip chip-success">Binh thuong</span>'}
                                            <button
                                                type="button"
                                                class="${entry.block ? 'btn-outline' : 'btn-danger'}"
                                                ${entry.block ? `data-ip-unblock="${safeText(entry.ip)}"` : `data-ip-block="${safeText(entry.ip)}"`}
                                            >
                                                ${entry.block ? 'Mo chan IP' : 'Chan IP'}
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p>Chua ghi nhan IP nao cho tai khoan nay.</p>'}
                    </div>
                    <div class="inspect-timeline-wrap">
                        <div class="inspect-timeline-head">
                            <h4 class="section-title">Hoat dong gan day</h4>
                            <span class="section-subtitle">Toi da 15 su kien moi nhat</span>
                        </div>
                        ${activities.length ? `
                            <ul class="inspect-timeline">
                                ${activities.map(a => `
                                    <li>
                                        <div class="inspect-dot"></div>
                                        <div class="inspect-timeline-body">
                                            <div class="inspect-timeline-top">
                                                <span class="inspect-activity-type">${safeText(a.type || '')}</span>
                                                <span class="inspect-activity-time">${formatDateShort(a.at)}</span>
                                            </div>
                                            <div class="inspect-activity-text">${safeText(a.text || '')}</div>
                                            ${a.amount !== undefined ? `<div class="inspect-amount ${a.amount < 0 ? 'minus' : 'plus'}">${formatMoney(a.amount)}</div>` : ''}
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : '<p>Chua ghi nhan hoat dong.</p>'}
                    </div>
                `;

                const lockBtn = document.getElementById('inspect-lock-btn');
                if (lockBtn) {
                    lockBtn.addEventListener('click', async () => {
                        const targetStatus = user.status === 'banned' ? 'active' : 'banned';
                        const pwd = prompt('Nhap mat khau admin de xac nhan:');
                        if (!pwd) return;
                        const resp = await api.post(`/admin/users/${user.id}/status`, {
                            status: targetStatus,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Cap nhat trang thai thanh cong', 'success');
                            await loadInspect();
                        } else {
                            showToast(resp.message || 'Khong the cap nhat trang thai', 'error');
                        }
                    });
                }

                detailEl.querySelectorAll('button[data-ip-block]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const targetIp = btn.dataset.ipBlock;
                        const pwd = prompt('Nhap mat khau admin de chan IP:');
                        if (!pwd) return;
                        const note = prompt('Ghi chu chan IP (co the bo trong):', user.email || '') || '';
                        const resp = await api.post('/admin/ip-blocks/block', {
                            ip: targetIp,
                            note,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Da chan IP thanh cong', 'success');
                            await loadDetail(user.id);
                        } else {
                            showToast(resp.message || 'Khong the chan IP', 'error');
                        }
                    });
                });

                detailEl.querySelectorAll('button[data-ip-unblock]').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const targetIp = btn.dataset.ipUnblock;
                        const pwd = prompt('Nhap mat khau admin de mo chan IP:');
                        if (!pwd) return;
                        const resp = await api.post('/admin/ip-blocks/unblock', {
                            ip: targetIp,
                            admin_password: pwd
                        });
                        if (resp.success) {
                            showToast('Da mo chan IP', 'success');
                            await loadDetail(user.id);
                        } else {
                            showToast(resp.message || 'Khong the mo chan IP', 'error');
                        }
                    });
                });
            };

            const loadDetail = async (userId) => {
                detailEl.innerHTML = '<p>Đang tải...</p>';
                const res = await api.get(`/admin/users/${userId}/inspect`);
                if (res.success) {
                    renderInspectDetailWithIps(res.data);
                } else {
                    detailEl.innerHTML = '<p>Không thể tải chi tiết.</p>';
                }
            };

            renderList();

            if (searchEl) {
                searchEl.addEventListener('input', (e) => renderList(e.target.value));
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh sách tài khoản.</p>';
        }
    }

    async function loadSecurity() {
        const container = document.getElementById('tab-security');
        if (!container) return;

        const safeText = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const renderSecurity = (payload = {}) => {
            const summary = payload.summary || {};
            const blockedApis = Array.isArray(payload.blockedApis) ? payload.blockedApis : [];
            const blockedIps = Array.isArray(payload.activeIpBlocks) ? payload.activeIpBlocks : [];
            const lockedAccounts = Array.isArray(payload.lockedAccounts) ? payload.lockedAccounts : [];
            const recentBlockedRequests = Array.isArray(payload.recentBlockedRequests) ? payload.recentBlockedRequests : [];

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Trung tâm bảo mật</h3>
                            <p class="section-subtitle">Theo dõi API bị chặn, IP đang bị block và các tài khoản đang bị khóa.</p>
                        </div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button id="security-refresh-btn" class="btn-outline">Tải lại</button>
                            <button id="security-open-logs-btn" class="btn-outline">Mở Logs</button>
                            <button id="security-open-inspect-btn" class="btn-outline">Check tài khoản</button>
                        </div>
                    </div>
                    <div class="stat-grid">
                        <div class="stat-card">API bị chặn: <strong>${Number(summary.blockedApiEndpointCount || 0)}</strong></div>
                        <div class="stat-card">Lượt chặn API: <strong>${Number(summary.blockedApiEventCount || 0)}</strong></div>
                        <div class="stat-card">IP đang block: <strong>${Number(summary.blockedIpCount || 0)}</strong></div>
                        <div class="stat-card">Tài khoản đang khóa: <strong>${Number(summary.lockedAccountCount || 0)}</strong></div>
                    </div>
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">API đã bị chặn</h3>
                            <p class="section-subtitle">Tổng hợp endpoint bị chặn gần đây từ hệ thống bảo mật.</p>
                        </div>
                        <span class="badge badge-danger">${blockedApis.length} endpoint</span>
                    </div>
                    ${blockedApis.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>API</th>
                                    <th>Số lần</th>
                                    <th>IP mẫu</th>
                                    <th>Lần cuối</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${blockedApis.map((item) => `
                                    <tr>
                                        <td><strong>${safeText(item.endpoint || `${item.method || ''} ${item.path || ''}`.trim())}</strong></td>
                                        <td>${Number(item.count || 0)}</td>
                                        <td>${safeText((item.sampleIps || []).join(', ') || '-')}</td>
                                        <td>${item.lastBlockedAt ? formatDateShort(item.lastBlockedAt) : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Chưa có API nào bị chặn trong dữ liệu hiện có.</p>'}
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">IP đang bị chặn</h3>
                            <p class="section-subtitle">Danh sách block còn hiệu lực.</p>
                        </div>
                        <span class="badge badge-warning">${blockedIps.length} IP</span>
                    </div>
                    ${blockedIps.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>IP</th>
                                    <th>Lý do</th>
                                    <th>Chi tiết</th>
                                    <th>Đến</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${blockedIps.map((item) => `
                                    <tr>
                                        <td>${safeText(item.ip || '-')}</td>
                                        <td>${safeText(item.reason || '-')}</td>
                                        <td>${safeText(item.detail || '-')}</td>
                                        <td>${item.blockUntil ? formatDateShort(item.blockUntil) : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có IP nào đang bị chặn.</p>'}
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Tài khoản đang khóa</h3>
                            <p class="section-subtitle">Bao gồm khóa đăng nhập, khóa bảo mật và trạng thái banned.</p>
                        </div>
                        <span class="badge badge-info">${lockedAccounts.length} tài khoản</span>
                    </div>
                    ${lockedAccounts.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Tài khoản</th>
                                    <th>Vai trò</th>
                                    <th>Trạng thái</th>
                                    <th>Lý do khóa</th>
                                    <th>Khóa login đến</th>
                                    <th>IP bảo mật</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lockedAccounts.map((item) => `
                                    <tr>
                                        <td>${Number(item.id || 0)}</td>
                                        <td>
                                            <div><strong>${safeText(item.email || '-')}</strong></div>
                                            <div class="section-subtitle">${safeText(item.full_name || '-')}</div>
                                        </td>
                                        <td>${safeText(item.role || '-')}</td>
                                        <td>${safeText(item.status || '-')}</td>
                                        <td>${safeText((item.lock_reasons || []).join(', ') || '-')}</td>
                                        <td>${item.login_locked_until ? formatDateShort(item.login_locked_until) : '-'}</td>
                                        <td>${safeText(item.security_locked_ip || item.last_login_ip || '-')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có tài khoản nào đang bị khóa.</p>'}
                </div>

                <div class="section-card section-spaced">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Lượt chặn gần đây</h3>
                            <p class="section-subtitle">Các request mới nhất bị hệ thống từ chối.</p>
                        </div>
                        <span class="badge badge-secondary">${recentBlockedRequests.length} dòng</span>
                    </div>
                    ${recentBlockedRequests.length ? `
                        <div class="log-list">
                            ${recentBlockedRequests.map((item) => `
                                <div class="log-item">
                                    <span class="log-time">${item.at ? formatDateShort(item.at) : '-'}</span>
                                    <span class="log-badge badge badge-danger">${safeText(item.reason || 'blocked')}</span>
                                    <span class="log-text">${safeText(item.endpoint || `${item.method || ''} ${item.path || ''}`.trim() || '-')} ${item.ip ? `â€¢ ${safeText(item.ip)}` : ''}${item.detail ? ` â€¢ ${safeText(item.detail)}` : ''}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>Chưa có request bị chặn trong bộ nhớ log hiện tại.</p>'}
                </div>
            `;

            const refreshBtn = document.getElementById('security-refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async () => {
                    await fetchSecurity();
                });
            }

            const openLogsBtn = document.getElementById('security-open-logs-btn');
            if (openLogsBtn) {
                openLogsBtn.addEventListener('click', () => {
                    window.router?.navigate('/admin?tab=logs');
                });
            }

            const openInspectBtn = document.getElementById('security-open-inspect-btn');
            if (openInspectBtn) {
                openInspectBtn.addEventListener('click', () => {
                    window.router?.navigate('/admin?tab=inspect');
                });
            }
        };

        const fetchSecurity = async () => {
            try {
                const res = await api.get('/admin/security-overview');
                if (!res.success) {
                    throw new Error('Khong the tai du lieu bao mat');
                }
                renderSecurity(res.data || {});
            } catch (error) {
                container.innerHTML = '<p>Khong the tai trung tam bao mat.</p>';
            }
        };

        await fetchSecurity();
    }

    // Logs
    async function loadLogs() {
        const container = document.getElementById('tab-logs');
        if (!container) return;
        const fetchLogs = async () => {
            try {
                const res = await api.get('/admin/logs', { limit: 200 });
                if (!res.success) return;
                renderLogs(container, res.data || []);
            } catch (error) {
                container.innerHTML = '<p>Không thể tải log.</p>';
            }
        };
        await fetchLogs();
        logInterval = setInterval(fetchLogs, 4000);
    }

    function renderLogs(container, items) {
        if (!items.length) {
            container.innerHTML = '<p>Chưa có log.</p>';
            return;
        }
        container.innerHTML = `
            <div class="section-header">
                <div>
                    <h3 class="section-title">Logs gần đây</h3>
                    <p class="section-subtitle">Yêu cầu API và sự kiện đăng nhập (tối đa 200 dòng, tự cập nhật 4s).</p>
                </div>
            </div>
            <div class="log-list">${items.map(renderLogItem).join('')}</div>
        `;
    }

    function renderLogItem(log) {
        const time = formatDateShort(log.ts || new Date().toISOString());
        if (log.type === 'login') {
            return `
                <div class="log-item">
                    <span class="log-time">${time}</span>
                    <span class="log-badge badge badge-info">LOGIN</span>
                    <span class="log-text">${log.email || 'unknown'} ${log.success ? 'đăng nhập thành công' : 'đăng nhập thất bại'}${log.userId ? ` (id ${log.userId})` : ''}</span>
                </div>
            `;
        }
        if (log.type === 'security') {
            return `
                <div class="log-item">
                    <span class="log-time">${time}</span>
                    <span class="log-badge badge badge-danger">SECURITY</span>
                    <span class="log-text">${log.action || 'security'}${log.ip ? ` â€¢ ${log.ip}` : ''}${log.reason ? ` â€¢ ${log.reason}` : ''}${log.path ? ` â€¢ ${log.path}` : ''}${log.detail ? ` â€¢ ${log.detail}` : ''}</span>
                </div>
            `;
        }
        return `
            <div class="log-item">
                <span class="log-time">${time}</span>
                <span class="log-badge badge badge-secondary">${log.status || ''}</span>
                <span class="log-text">${log.method || ''} ${log.path || ''} â€¢ ${log.durationMs || 0}ms${log.email ? ` â€¢ ${log.email}` : ''}</span>
            </div>
        `;
    }

    async function loadStorage() {
        const container = document.getElementById('tab-storage');
        if (!container) return;
        try {
            const response = await api.get('/admin/storage-info');
            if (!response.success) {
                container.innerHTML = '<p>Không thể tải thông tin lưu trữ.</p>';
                return;
            }
            const info = response.data || {};
            const counts = info.counts || {};
            const tables = info.tables || [];
            const tableLabels = {
                users: 'Tài khoản',
                products: 'Sản phẩm',
                product_images: 'Ảnh sản phẩm',
                product_categories: 'Danh mục sản phẩm',
                categories: 'Danh mục',
                posts: 'Bài đăng',
                post_media: 'Media bài đăng',
                post_likes: 'Like bài đăng',
                post_comments: 'Bình luận',
                messages: 'Tin nhắn',
                community_messages: 'Cộng đồng',
                notifications: 'Thông báo',
                notification_reads: 'Đã đọc thông báo',
                purchases: 'Đơn mua',
                deposit_requests: 'Yêu cầu nạp',
                transactions: 'Giao dịch',
                system_settings: 'Cấu hình',
                api_keys: 'API Key'
            };

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Tổng quan lưu trữ</h3>
                    <div class="stat-grid">
                        <div class="stat-card">Dung lượng DB: <strong>${formatBytes(info.dbSizeBytes || 0)}</strong></div>
                        <div class="stat-card">Users: <strong>${counts.users || 0}</strong></div>
                        <div class="stat-card">Sản phẩm: <strong>${counts.products || 0}</strong></div>
                        <div class="stat-card">Bài đăng: <strong>${counts.posts || 0}</strong></div>
                        <div class="stat-card">Tin nhắn: <strong>${counts.messages || 0}</strong></div>
                        <div class="stat-card">Cộng đồng: <strong>${counts.community_messages || 0}</strong></div>
                        <div class="stat-card">Thông báo: <strong>${counts.notifications || 0}</strong></div>
                    </div>
                </div>
                <div class="section-card section-spaced">
                    <h3 class="section-title">Chi tiết theo bảng</h3>
                    ${tables.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nội dung</th>
                                    <th>Bảng</th>
                                    <th>Số dòng</th>
                                    <th>Dung lượng</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tables.map(t => `
                                    <tr>
                                        <td>${tableLabels[t.name] || 'Khác'}</td>
                                        <td>${t.name}</td>
                                        <td>${t.rows || 0}</td>
                                        <td>${formatBytes(t.bytes || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có dữ liệu bảng.</p>'}
                </div>
                  <div class="section-card section-spaced">
                      <h3 class="section-title">Sao lưu dữ liệu</h3>
                      <p class="section-subtitle">Xuất toàn bộ dữ liệu thành file JSON hoặc gửi thẳng lên Telegram bot.</p>
                      <div class="badge-row section-spaced">
                          <div class="badge badge-info">data.json</div>
                          <div class="badge badge-success">Telegram backup</div>
                      </div>
                      <div class="hero-actions">
                          <button id="export-data" class="btn-primary">Tải data.json</button>
                          <button id="send-telegram" class="btn-outline">Gửi Telegram</button>
                      </div>
                  </div>
                  <div class="section-card section-spaced">
                      <h3 class="section-title">Chia sẻ dữ liệu</h3>
                      <p class="section-subtitle">Xuất dữ liệu ít sử dụng sang file JSON (chiase.json) để giảm dung lượng DB.</p>
                      <div class="hero-actions">
                          <button id="open-share-data" class="btn-primary">Chia sẻ dữ liệu</button>
                      </div>
                  </div>
                  <div class="section-card">
                      <h3 class="section-title">Chính sách lưu trữ</h3>
                      <div class="stat-grid">
                          <div class="stat-card">Thông báo: <strong>tự xóa sau 12 giờ</strong></div>
                        <div class="stat-card">Tin nhắn cộng đồng: <strong>tự xóa sau 7 ngày</strong></div>
                    </div>
                </div>
            `;

            const exportBtn = document.getElementById('export-data');
            const telegramBtn = document.getElementById('send-telegram');
            const shareBtn = document.getElementById('open-share-data');

            if (exportBtn) {
                exportBtn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`${api.baseURL}/admin/backup/export`, {
                            headers: api.getHeaders()
                        });
                        if (!res.ok) throw new Error('Export failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'data.json';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    } catch (error) {
                        showToast(error.message || 'Không thể xuất dữ liệu', 'error');
                    }
                });
            }

            if (telegramBtn) {
                telegramBtn.addEventListener('click', async () => {
                    try {
                        await api.post('/admin/backup/telegram', {});
                        showToast('Đã gửi backup lên Telegram', 'success');
                    } catch (error) {
                        showToast(error.message || 'Không thể gửi Telegram', 'error');
                    }
                });
            }

            if (shareBtn) {
                shareBtn.addEventListener('click', () => {
                    openShareDataModal();
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải thông tin lưu trữ.</p>';
        }
    }

    async function loadSettings() {
        const container = document.getElementById('tab-settings');
        if (!container) return;
        if (!document.getElementById('feature-locks-styles')) {
            const style = document.createElement('style');
            style.id = 'feature-locks-styles';
            style.textContent = `
                .feature-locks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 20px 0; }
                .feature-lock-card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 15px; transition: all 0.3s ease; }
                .feature-lock-card:hover { background: rgba(30, 41, 59, 0.8); border-color: #6366f1; transform: translateY(-2px); }
                .feature-icon-wrapper { width: 50px; height: 50px; background: rgba(99, 102, 241, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #818cf8; }
                .is-locked .feature-icon-wrapper { background: rgba(244, 63, 94, 0.1); color: #fb7185; }
                .feature-lock-info { flex: 1; }
                .feature-lock-label { font-weight: 700; font-size: 16px; color: #f1f5f9; margin-bottom: 2px; }
                .feature-lock-status { font-size: 12px; font-weight: 600; }
                .status-active { color: #22c55e; }
                .status-locked { color: #f43f5e; }
                .switch-toggle { position: relative; width: 44px; height: 22px; cursor: pointer; }
                .switch-toggle input { opacity: 0; width: 0; height: 0; }
                .switch-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #334155; transition: .4s; border-radius: 34px; }
                .switch-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; transition: .4s; border-radius: 50%; }
                input:checked + .switch-slider { background: #f43f5e; }
                input:checked + .switch-slider:before { transform: translateX(22px); }
            `;
            document.head.appendChild(style);
        }
        container.innerHTML = `
            <div class="settings-accordion">
                <div class="settings-section">
                    <button type="button" class="settings-header">Quản lý tính năng (Khóa/Mở)</button>
                    <div class="settings-body">
                        <p class="section-subtitle">Khi khóa tính năng, người dùng sẽ không thể sử dụng và nhận được thông báo bảo trì từ máy chủ.</p>
                        <div id="feature-locks-list" class="feature-locks-grid">
                            <div class="loading-inline">Đang tải trạng thái...</div>
                        </div>
                    </div>
                </div>
                <div class="settings-section active">
                    <button type="button" class="settings-header">Thông tin chuyển khoản</button>
                    <div class="settings-body">
                        <form id="bank-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên ngân hàng</label>
                                <input type="text" name="bank_name" placeholder="VD: Vietcombank">
                            </div>
                            <div class="form-group">
                                <label>Số tài khoản</label>
                                <input type="text" name="bank_account_number" placeholder="VD: 0123456789">
                            </div>
                            <div class="form-group">
                                <label>Tên tài khoản</label>
                                <input type="text" name="bank_account_name" placeholder="VD: Nguyen Van A">
                            </div>
                            <div class="form-group">
                                <label>Link QR (ảnh)</label>
                                <input type="text" name="bank_qr_url" placeholder="https://...">
                            </div>
                            <div class="form-group full">
                                <label>Nội dung chuyển khoản (tuỳ chọn)</label>
                                <input type="text" name="bank_note" placeholder="VD: NAPTIEN + SĐT">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu thông tin</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nội dung trang chủ</button>
                    <div class="settings-body">
                        <form id="hero-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Phiên bản hiển thị</label>
                                <select name="home_page_version">
                                    <option value="v1">V1 (mặc định)</option>
                                    <option value="v2">V2 (dùng file v2.html)</option>
                                </select>
                                <small id="home-page-version-hint" class="home-version-note">
                                    V1 dùng các ô bên dưới. V2 lấy nội dung trực tiếp từ file <code>frontend/pages/v2.html</code>, muốn sửa V2 thì sửa file này.
                                </small>
                            </div>
                            <div id="hero-v1-fields" class="home-version-v1-fields form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề chính</label>
                                <input type="text" name="hero_title" placeholder="Dịch vụ lập trình Sang dev">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả chính</label>
                                <textarea name="hero_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Nút chính - Text</label>
                                <input type="text" name="hero_btn_primary_text" placeholder="Đăng bán ngay">
                            </div>
                            <div class="form-group">
                                <label>Nút chính - Link</label>
                                <input type="text" name="hero_btn_primary_link" placeholder="/dangban">
                            </div>
                            <div class="form-group">
                                <label>Nút phụ - Text</label>
                                <input type="text" name="hero_btn_secondary_text" placeholder="Nạp tiền">
                            </div>
                            <div class="form-group">
                                <label>Nút phụ - Link</label>
                                <input type="text" name="hero_btn_secondary_link" placeholder="/naptien">
                            </div>
                            <div class="form-group full">
                                <label>Tiêu đề khối bên phải</label>
                                <input type="text" name="hero_card_title" placeholder="Vì sao chọn Sang dev shop?">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả khối bên phải</label>
                                <textarea name="hero_card_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Badge (mỗi dòng 1 badge)</label>
                                <textarea name="hero_badges" rows="3" placeholder="Bảo mật tài khoản&#10;Thanh toán linh hoạt"></textarea>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nội dung</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nhạc mặc định trang cá nhân</button>
                    <div class="settings-body">
                        <form id="music-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Upload nhạc mặc định</label>
                                <div class="file-picker">
                                    <input type="file" id="default-music-file" class="file-input" accept="audio/*,video/mp4">
                                    <button type="button" class="btn-outline file-btn" data-file-target="default-music-file" data-file-label="default-music-label">Chọn file</button>
                                    <span id="default-music-label" class="file-label">Chưa chọn file</span>
                                </div>
                                <small>Tải lên Cloudinary qua endpoint video/upload.</small>
                            </div>
                            <div class="form-group">
                                <label>Link nhạc mặc định</label>
                                <input type="text" name="default_profile_music_url" placeholder="https://...">
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề hiển thị</label>
                                <input type="text" name="default_profile_music_title" placeholder="Nhạc nền trang cá nhân">
                            </div>
                            <div class="form-group">
                                <label>Cloudinary upload preset</label>
                                <input type="text" name="cloudinary_music_preset" placeholder="ml_default">
                            </div>
                            <div class="form-group full">
                                <div id="default-music-preview" class="upload-preview"></div>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nhạc mặc định</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nhạc Banner V2</button>
                    <div class="settings-body">
                        <form id="banner-v2-music-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Danh sách nhạc (mỗi dòng: Tên | Link YouTube hoặc Link file)</label>
                                <textarea name="banner_v2_music_playlist" rows="6" placeholder="Ví dụ:&#10;Thiên Lý Ơi | https://www.youtube.com/watch?v=...&#10;Nhạc Chill | https://example.com/music.mp3"></textarea>
                                <small>Mỗi dòng là một bài hát. Định dạng: <b>Tên bài | Link</b>. Hỗ trợ YouTube và file mp3/mp4.</small>
                            </div>
                            <div class="form-group">
                                <label>Chế độ phát</label>
                                <select name="banner_v2_music_order">
                                    <option value="sequential">Tuần tự</option>
                                    <option value="shuffle">Ngẫu nhiên (Xáo trộn)</option>
                                </select>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu cài đặt Banner V2</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nút liên hệ</button>
                    <div class="settings-body">
                        <form id="frame-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Upload khung avatar</label>
                                <div class="file-picker">
                                    <input type="file" id="admin-frame-file" class="file-input" accept="image/png,image/jpeg,image/gif,image/webp">
                                    <button type="button" class="btn-outline file-btn" data-file-target="admin-frame-file" data-file-label="admin-frame-file-label">Chon file</button>
                                    <span id="admin-frame-file-label" class="file-label">Chua chon file</span>
                                </div>
                                <small>Khung se luu local trong thu muc <code>khungcanhan</code> va hien cho user o trang ca nhan.</small>
                            </div>
                            <div class="form-group full">
                                <div id="admin-frame-preview" class="upload-preview"></div>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Tai khung len</button>
                            </div>
                        </form>
                        <div id="admin-frame-list" class="section-spaced"></div>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Khung avatar mau</button>
                    <div class="settings-body">
                        <form id="contact-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Text nút</label>
                                <input type="text" name="text" placeholder="Ví dụ: Liên hệ Zalo">
                            </div>
                            <div class="form-group">
                                <label>Link nút</label>
                                <input type="text" name="link" placeholder="https://zalo.me/...">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nút</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Footer</button>
                    <div class="settings-body">
                        <form id="footer-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề</label>
                                <input type="text" name="footer_title" placeholder="Sang dev">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả</label>
                                <textarea name="footer_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề liên kết</label>
                                <input type="text" name="footer_links_title" placeholder="Liên kết">
                            </div>
                            <div class="form-group">
                                <label>Liên kết (mỗi dòng: Text | /link)</label>
                                <textarea name="footer_links" rows="3" placeholder="Trang chủ | /\nBài đăng | /baidang"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề liên hệ</label>
                                <input type="text" name="footer_contact_title" placeholder="Liên hệ">
                            </div>
                            <div class="form-group">
                                <label>Email liên hệ</label>
                                <input type="text" name="footer_contact_email" placeholder="Email: ...">
                            </div>
                            <div class="form-group full">
                                <label>Bản quyền</label>
                                <input type="text" name="footer_copyright" placeholder="© 2026 Sang dev. All rights reserved.">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">LÆ°u footer</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Menu tài khoản</button>
                    <div class="settings-body">
                        <form id="account-menu-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Nút cố định</label>
                                <input type="text" value="Trang chủ, Mã nguồn, Quản trị, Đăng xuất" disabled>
                                <small>Các nút này luôn có sẵn trong menu.</small>
                            </div>
                            <div class="form-group full">
                                <label>Nút phụ (mỗi dòng: Tên | /link hoặc https://...)</label>
                                <textarea
                                    name="account_menu_extra_links"
                                    rows="5"
                                    placeholder="Bài đăng | /baidang&#10;Nạp tiền | /naptien&#10;Hỗ trợ | /hotro"
                                ></textarea>
                                <small>Admin có thể sửa, thêm hoặc xóa các nút phụ ở đây.</small>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">LÆ°u menu</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Điều khoản dịch vụ</button>
                    <div class="settings-body">
                        <form id="tos-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề</label>
                                <input type="text" name="tos_title" placeholder="Điều khoản dịch vụ">
                            </div>
                            <div class="form-group full">
                                <label>Nội dung (mỗi dòng là 1 đoạn)</label>
                                <textarea name="tos_content" rows="6" placeholder="Nhập nội dung điều khoản..."></textarea>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu điều khoản</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Cấu hình AI Assistant</button>
                    <div class="settings-body">
                        <form id="ai-config-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên AI</label>
                                <input type="text" name="ai_name" placeholder="VD: Sang AI Assistant" maxlength="120">
                            </div>
                            <div class="form-group">
                                <label>Gemini API Key</label>
                                <input type="password" name="ai_api_key" placeholder="Để trống nếu giữ nguyên key">
                                <small id="ai-api-key-status">Chưa có API key.</small>
                            </div>
                            <div class="form-group full">
                                <label>Tính cách AI</label>
                                <textarea name="ai_personality" rows="3" placeholder="VD: Lịch sự, ngắn gọn, đi thẳng vào vấn đề"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Kiến thức / phạm vi trả lời</label>
                                <textarea name="ai_knowledge" rows="3" placeholder="VD: Mua bán source code, nạp tiền, tải xuống, demo sản phẩm"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Prompt hệ thống bổ sung</label>
                                <textarea name="ai_system_prompt" rows="5" placeholder="Hướng dẫn riêng để AI trả lời theo phong cách bạn muốn"></textarea>
                            </div>
                            <div class="form-group full ai-config-actions">
                                <label class="checkbox-inline">
                                    <input type="checkbox" name="clear_ai_api_key">
                                    Xóa API key đang lưu
                                </label>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu cấu hình AI</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">API Key tích hợp</button>
                    <div class="settings-body">
                        <form id="api-key-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tên key</label>
                                <input type="text" name="name" placeholder="VD: đối tác A" required>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Tạo API key</button>
                            </div>
                        </form>
                        <div id="api-key-result" class="section-card section-spaced" style="display:none;"></div>
                        <div id="api-key-list" class="section-card section-spaced"></div>
                    </div>
                </div>
            </div>
        `;

        initFilePickers(container);
        loadFeatureLocks();

        async function loadFeatureLocks() {
            const list = document.getElementById('feature-locks-list');
            if (!list) return;

            try {
                const res = await api.get('/admin/feature-locks');
                if (!res.success) throw new Error(res.message);

                const getIcon = (key) => {
                    const icons = {
                        deposit: 'fas fa-wallet',
                        withdraw: 'fas fa-money-bill-transfer',
                        spin: 'fas fa-dharmachakra',
                        checkin: 'fas fa-calendar-check',
                        mission: 'fas fa-tasks',
                        community: 'fas fa-users'
                    };
                    return icons[key] || 'fas fa-cog';
                };

                list.style.display = 'grid';
                list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
                list.style.gap = '20px';

                list.innerHTML = res.data.map(f => `
                    <div class="feature-lock-card ${f.isLocked ? 'is-locked' : ''}" style="display:flex; align-items:center; gap:16px; padding:20px; background:rgba(30,41,59,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:16px; transition:0.3s;">
                        <div class="feature-icon-wrapper" style="width:48px; height:48px; background:rgba(99,102,241,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; color:#818cf8;">
                            <i class="${getIcon(f.key)}"></i>
                        </div>
                        <div class="feature-lock-info" style="flex:1;">
                            <div class="feature-lock-label" style="font-weight:700; color:#fff;">${f.label}</div>
                            <div class="feature-lock-status ${f.isLocked ? 'status-locked' : 'status-active'}" style="font-size:12px; font-weight:600;">
                                ${f.isLocked ? 'Đang tạm khóa' : 'Đang hoạt động'}
                            </div>
                        </div>
                        <label class="switch-toggle">
                            <input type="checkbox" data-feature="${f.key}" ${f.isLocked ? 'checked' : ''}>
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                `).join('');

                list.querySelectorAll('input[type="checkbox"]').forEach(input => {
                    input.addEventListener('change', async () => {
                        const feature = input.dataset.feature;
                        const isLocked = input.checked;
                        
                        try {
                            const updateRes = await api.post('/admin/feature-locks', { feature, isLocked });
                            if (updateRes.success) {
                                showToast(`Đã ${isLocked ? 'khóa' : 'mở'} tính năng ${feature}`, 'success');
                                loadFeatureLocks(); // Refresh labels
                            }
                        } catch (err) {
                            input.checked = !isLocked;
                            showToast(err.message || 'Không thể cập nhật', 'error');
                        }
                    });
                });
            } catch (error) {
                list.innerHTML = `<p class="status-locked">Lỗi: ${error.message}</p>`;
            }
        }
        const frameSection = document.getElementById('frame-setting-form')?.closest('.settings-section');
        const contactSection = document.getElementById('contact-setting-form')?.closest('.settings-section');
        const frameHeader = frameSection ? frameSection.querySelector('.settings-header') : null;
        const contactHeader = contactSection ? contactSection.querySelector('.settings-header') : null;
        if (frameHeader) frameHeader.textContent = 'Khung avatar mau';
        if (contactHeader) contactHeader.textContent = 'Nut lien he';

        const contactForm = document.getElementById('contact-setting-form');
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = contactForm.text.value.trim();
                const link = contactForm.link.value.trim();
                await api.put('/admin/settings/contact_button_text', { value: text });
                await api.put('/admin/settings/contact_button_link', { value: link });
                showToast('Đã cập nhật nút liên hệ', 'success');
            });
        }

        const footerForm = document.getElementById('footer-setting-form');
        if (footerForm) {
            const footerKeys = [
                'footer_title',
                'footer_subtitle',
                'footer_links_title',
                'footer_links',
                'footer_contact_title',
                'footer_contact_email',
                'footer_copyright'
            ];

            try {
                const res = await api.get('/settings', { keys: footerKeys.join(',') });
                if (res.success) {
                    footerKeys.forEach(key => {
                        if (footerForm[key]) footerForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            footerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of footerKeys) {
                    const value = footerForm[key] ? footerForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật footer', 'success');
            });
        }

        const accountMenuForm = document.getElementById('account-menu-setting-form');
        if (accountMenuForm) {
            const accountMenuKeys = ['account_menu_extra_links'];

            try {
                const res = await api.get('/settings', { keys: accountMenuKeys.join(',') });
                if (res.success) {
                    accountMenuKeys.forEach(key => {
                        if (accountMenuForm[key]) accountMenuForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            accountMenuForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const value = accountMenuForm.account_menu_extra_links
                    ? accountMenuForm.account_menu_extra_links.value
                    : '';

                await api.put('/admin/settings/account_menu_extra_links', { value });

                if (window.appInstance && typeof window.appInstance.loadAccountMenuConfig === 'function') {
                    await window.appInstance.loadAccountMenuConfig(true);
                    if (typeof window.appInstance.refreshRouteAwareUi === 'function') {
                        window.appInstance.refreshRouteAwareUi();
                    }
                }

                showToast('Đã cập nhật menu tài khoản', 'success');
            });
        }

        const bankForm = document.getElementById('bank-setting-form');
        if (bankForm) {
            bankForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await api.put('/admin/settings/bank_name', { value: bankForm.bank_name.value.trim() });
                await api.put('/admin/settings/bank_account_number', { value: bankForm.bank_account_number.value.trim() });
                await api.put('/admin/settings/bank_account_name', { value: bankForm.bank_account_name.value.trim() });
                await api.put('/admin/settings/bank_qr_url', { value: bankForm.bank_qr_url.value.trim() });
                await api.put('/admin/settings/bank_note', { value: bankForm.bank_note.value.trim() });
                showToast('Đã cập nhật thông tin ngân hàng', 'success');
            });
        }

        const heroForm = document.getElementById('hero-setting-form');
        if (heroForm) {
            const heroKeys = [
                'hero_title',
                'hero_subtitle',
                'hero_btn_primary_text',
                'hero_btn_primary_link',
                'hero_btn_secondary_text',
                'hero_btn_secondary_link',
                'hero_card_title',
                'hero_card_subtitle',
                'hero_badges'
            ];
            const heroVersionKey = 'home_page_version';
            const versionField = heroForm.home_page_version;
            const v1Fields = document.getElementById('hero-v1-fields');
            const versionHint = document.getElementById('home-page-version-hint');
            const versionGroup = versionField ? versionField.closest('.form-group') : null;
            const versionLabel = versionGroup ? versionGroup.querySelector('label') : null;

            if (versionLabel) {
                versionLabel.textContent = 'Phien ban hien thi';
            }

            if (versionField && versionField.options.length >= 2) {
                versionField.options[0].textContent = 'V1 (mac dinh)';
                versionField.options[1].textContent = 'V2 (dung file v2.html)';
            }

            const syncHomeVersionEditorState = () => {
                const isV2 = versionField && versionField.value === 'v2';

                if (v1Fields) {
                    v1Fields.classList.toggle('is-disabled', isV2);
                    v1Fields.querySelectorAll('input, textarea, select').forEach(field => {
                        field.disabled = isV2;
                    });
                }

                if (versionHint) {
                    versionHint.innerHTML = isV2
                        ? 'V2 Đang bat. Noi dung lay truc tiep tu file <code>frontend/pages/v2.html</code>, muon sua V2 thi sua file nay.'
                        : 'V1 dang bat. Cac o ben duoi se ap dung cho giao dien trang chu mac dinh.';
                }
            };

            try {
                const res = await api.get('/settings', { keys: [heroVersionKey, ...heroKeys].join(',') });
                if (res.success) {
                    if (versionField) {
                        versionField.value = res.data[heroVersionKey] === 'v2' ? 'v2' : 'v1';
                    }
                    heroKeys.forEach(key => {
                        if (heroForm[key]) heroForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            syncHomeVersionEditorState();

            if (versionField) {
                versionField.addEventListener('change', syncHomeVersionEditorState);
            }

            heroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const homePageVersion = versionField && versionField.value === 'v2' ? 'v2' : 'v1';
                await api.put(`/admin/settings/${heroVersionKey}`, { value: homePageVersion });
                if (homePageVersion === 'v1') {
                    for (const key of heroKeys) {
                    const value = heroForm[key] ? heroForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                }
                showToast('Đã cập nhật nội dung trang chủ', 'success');
            });
        }

        const musicForm = document.getElementById('music-setting-form');
        if (musicForm) {
            const musicKeys = ['default_profile_music_url', 'default_profile_music_title', 'cloudinary_music_preset'];
            const musicFileInput = document.getElementById('default-music-file');
            const musicFileLabel = document.getElementById('default-music-label');
            const musicPreview = document.getElementById('default-music-preview');
            let musicFile = null;

            try {
                const res = await api.get('/settings', { keys: musicKeys.join(',') });
                if (res.success) {
                    musicKeys.forEach(key => {
                        if (musicForm[key]) musicForm[key].value = res.data[key] || '';
                    });
                    renderDefaultMusicPreview(res.data.default_profile_music_url || '');
                }
            } catch (_) {
                // ignore
            }

            if (musicFileInput) {
                musicFileInput.addEventListener('change', () => {
                    musicFile = musicFileInput.files && musicFileInput.files[0] ? musicFileInput.files[0] : null;
                    setFileLabel(musicFileInput, musicFileLabel);
                    renderDefaultMusicPreview(musicFile);
                });
            }

            musicForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const preset = (musicForm.cloudinary_music_preset.value || 'audio_upload').trim();
                    let url = (musicForm.default_profile_music_url.value || '').trim();
                    const title = (musicForm.default_profile_music_title.value || '').trim();

                    if (musicFile) {
                        if (!isAudioFile(musicFile)) {
                            showToast('File nhạc không hợp lệ', 'error');
                            return;
                        }
                        const bar = musicPreview ? musicPreview.querySelector('.upload-progress-bar') : null;
                        const text = musicPreview ? musicPreview.querySelector('.upload-progress-text') : null;
                        const ring = musicPreview ? musicPreview.querySelector('.upload-ring-inner') : null;
                        const ringWrap = musicPreview ? musicPreview.querySelector('.upload-ring') : null;
                        const updateProgress = (percent) => {
                            if (bar) bar.style.width = `${percent}%`;
                            if (text) text.textContent = `${percent}%`;
                            if (ring) ring.style.setProperty('--progress', percent);
                            if (ring) ring.textContent = `${percent}%`;
                            if (ringWrap) ringWrap.style.display = percent >= 100 ? 'none' : 'flex';
                        };

                        const uploadResult = await uploadToCloudinary(musicFile, {
                            uploadPreset: preset,
                            onProgress: updateProgress
                        });
                        url = uploadResult.url;
                    }

                    await api.put('/admin/settings/default_profile_music_url', { value: url });
                    await api.put('/admin/settings/default_profile_music_title', { value: title });
                    await api.put('/admin/settings/cloudinary_music_preset', { value: preset });

                    showToast('Đã lưu nhạc mặc định', 'success');
                    musicFile = null;
                    if (musicFileInput) musicFileInput.value = '';
                    setFileLabel(musicFileInput, musicFileLabel);
                    renderDefaultMusicPreview(url);
                } catch (error) {
                    showToast(error.message || 'Không thể lưu nhạc mặc định', 'error');
                }
            });

            function renderDefaultMusicPreview(fileOrUrl = '') {
                if (!musicPreview) return;
                let previewUrl = '';
                if (fileOrUrl instanceof File) {
                    previewUrl = URL.createObjectURL(fileOrUrl);
                } else {
                    previewUrl = fileOrUrl;
                }
                if (!previewUrl) {
                    musicPreview.innerHTML = '<p class="upload-empty">Chưa có nhạc mặc định.</p>';
                    return;
                }
                musicPreview.innerHTML = `
                    <div class="upload-preview-item audio-preview">
                        <audio controls src="${previewUrl}" preload="metadata"></audio>
                        <div class="upload-ring" style="${fileOrUrl instanceof File ? '' : 'display:none;'}">
                            <div class="upload-ring-inner" style="--progress:0;">0%</div>
                        </div>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;
            }
        }

        const bannerMusicForm = document.getElementById('banner-v2-music-form');
        if (bannerMusicForm) {
            const bannerKeys = ['banner_v2_music_playlist', 'banner_v2_music_order'];

            try {
                const res = await api.get('/settings', { keys: bannerKeys.join(',') });
                if (res.success) {
                    bannerKeys.forEach(key => {
                        if (bannerMusicForm[key]) bannerMusicForm[key].value = res.data[key] || '';
                    });
                }
            } catch (_) {
                // ignore
            }

            bannerMusicForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const playlist = bannerMusicForm.banner_v2_music_playlist.value.trim();
                    const order = bannerMusicForm.banner_v2_music_order.value;

                    await api.put('/admin/settings/banner_v2_music_playlist', { value: playlist });
                    await api.put('/admin/settings/banner_v2_music_order', { value: order });

                    showToast('Đã lưu cài đặt nhạc Banner V2', 'success');
                } catch (error) {
                    showToast(error.message || 'Không thể lưu cài đặt', 'error');
                }
            });
        }

        const frameForm = document.getElementById('frame-setting-form');
        if (frameForm) {
            const frameFileInput = document.getElementById('admin-frame-file');
            const frameFileLabel = document.getElementById('admin-frame-file-label');
            const framePreview = document.getElementById('admin-frame-preview');
            const frameList = document.getElementById('admin-frame-list');
            let frameFile = null;
            let framePreviewUrl = '';

            const clearFramePreviewUrl = () => {
                if (framePreviewUrl) {
                    URL.revokeObjectURL(framePreviewUrl);
                    framePreviewUrl = '';
                }
            };

            const renderFramePreview = (file = null) => {
                if (!framePreview) return;
                clearFramePreviewUrl();

                if (!(file instanceof File)) {
                    framePreview.innerHTML = '<p class="upload-empty">Chua chon khung avatar.</p>';
                    return;
                }

                framePreviewUrl = URL.createObjectURL(file);
                framePreview.innerHTML = `
                    <div class="upload-preview-item admin-frame-upload-preview">
                        <img src="${framePreviewUrl}" class="upload-preview-img" alt="frame preview">
                    </div>
                `;
            };

            const loadAdminFrames = async () => {
                if (!frameList) return;
                try {
                    const res = await api.get('/admin/frames');
                    if (!res.success) {
                        frameList.innerHTML = '<p>Khong the tai danh sach khung.</p>';
                        return;
                    }

                    const items = res.data || [];
                    if (!items.length) {
                        frameList.innerHTML = '<p class="upload-empty">Chua co khung mau.</p>';
                        return;
                    }

                    frameList.innerHTML = `
                        <div class="section-header">
                            <h3 class="section-title">Khung hien co</h3>
                        </div>
                        <div class="admin-frame-grid">
                            ${items.map(item => `
                                <div class="admin-frame-card">
                                    <img src="${item.url}" alt="${item.name}" class="admin-frame-card-image">
                                    <div class="admin-frame-meta">${item.name}</div>
                                    <button type="button" class="btn-ghost btn-danger admin-frame-remove" data-frame-delete="${item.name}">Xoa</button>
                                </div>
                            `).join('')}
                        </div>
                    `;

                    frameList.querySelectorAll('button[data-frame-delete]').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            if (!confirm('Xoa khung nay?')) return;
                            try {
                                const result = await api.delete(`/admin/frames/${encodeURIComponent(btn.dataset.frameDelete || '')}`);
                                if (result.success) {
                                    showToast('Da xoa khung avatar', 'success');
                                    await loadAdminFrames();
                                }
                            } catch (error) {
                                showToast(error.message || 'Khong the xoa khung', 'error');
                            }
                        });
                    });
                } catch (error) {
                    frameList.innerHTML = '<p>Khong the tai danh sach khung.</p>';
                }
            };

            if (frameFileInput) {
                frameFileInput.addEventListener('change', () => {
                    frameFile = frameFileInput.files && frameFileInput.files[0] ? frameFileInput.files[0] : null;
                    setFileLabel(frameFileInput, frameFileLabel);
                    renderFramePreview(frameFile);
                });
            }

            frameForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!frameFile) {
                    showToast('Vui long chon khung avatar', 'warning');
                    return;
                }

                try {
                    const fd = new FormData();
                    fd.append('file', frameFile);
                    const result = await api.upload('/admin/frames', fd);
                    if (result.success) {
                        showToast('Da tai khung avatar len', 'success');
                        frameFile = null;
                        if (frameFileInput) frameFileInput.value = '';
                        setFileLabel(frameFileInput, frameFileLabel);
                        renderFramePreview(null);
                        await loadAdminFrames();
                        return;
                    }
                    showToast(result.message || 'Khong the tai khung len', 'error');
                } catch (error) {
                    showToast(error.message || 'Khong the tai khung len', 'error');
                }
            });

            renderFramePreview(null);
            loadAdminFrames();
        }

        const tosForm = document.getElementById('tos-setting-form');
        if (tosForm) {
            const tosKeys = ['tos_title', 'tos_content'];
            try {
                const res = await api.get('/settings', { keys: tosKeys.join(',') });
                if (res.success) {
                    tosKeys.forEach(key => {
                        if (tosForm[key]) tosForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            tosForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of tosKeys) {
                    const value = tosForm[key] ? tosForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật điều khoản', 'success');
            });
        }

        const aiConfigForm = document.getElementById('ai-config-form');
        const aiApiKeyStatus = document.getElementById('ai-api-key-status');
        if (aiConfigForm) {
            try {
                const res = await api.get('/admin/ai-config');
                if (res.success) {
                    const data = res.data || {};
                    aiConfigForm.ai_name.value = data.ai_name || '';
                    aiConfigForm.ai_personality.value = data.ai_personality || '';
                    aiConfigForm.ai_knowledge.value = data.ai_knowledge || '';
                    aiConfigForm.ai_system_prompt.value = data.ai_system_prompt || '';
                    if (aiApiKeyStatus) {
                        aiApiKeyStatus.textContent = data.has_ai_api_key
                            ? `Đã có API key (${data.ai_api_key_masked || 'đã được lưu'})`
                            : 'Chưa có API key.';
                    }
                }
            } catch (error) {
                if (aiApiKeyStatus) aiApiKeyStatus.textContent = 'Không thể tải cấu hình AI.';
            }

            aiConfigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const payload = {
                        ai_name: aiConfigForm.ai_name.value.trim(),
                        ai_personality: aiConfigForm.ai_personality.value.trim(),
                        ai_knowledge: aiConfigForm.ai_knowledge.value.trim(),
                        ai_system_prompt: aiConfigForm.ai_system_prompt.value.trim(),
                        ai_api_key: aiConfigForm.ai_api_key.value.trim(),
                        clear_ai_api_key: !!aiConfigForm.clear_ai_api_key.checked
                    };
                    await api.put('/admin/ai-config', payload);
                    aiConfigForm.ai_api_key.value = '';
                    aiConfigForm.clear_ai_api_key.checked = false;
                    showToast('Đã lưu cấu hình AI', 'success');

                    const refreshed = await api.get('/admin/ai-config');
                    if (refreshed.success && aiApiKeyStatus) {
                        const data = refreshed.data || {};
                        aiApiKeyStatus.textContent = data.has_ai_api_key
                            ? `Đã có API key (${data.ai_api_key_masked || 'đã được lưu'})`
                            : 'Chưa có API key.';
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể lưu cấu hình AI', 'error');
                }
            });
        }

        container.querySelectorAll('.settings-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.settings-section');
                if (!section) return;
                container.querySelectorAll('.settings-section').forEach(s => {
                    if (s !== section) s.classList.remove('active');
                });
                section.classList.toggle('active');
            });
        });

        const apiKeyForm = document.getElementById('api-key-form');
        const apiKeyResult = document.getElementById('api-key-result');
        const apiKeyList = document.getElementById('api-key-list');

        async function loadApiKeys() {
            try {
                const res = await api.get('/admin/api-keys');
                if (!res.success) return;
                const items = res.data || [];
                apiKeyList.innerHTML = items.length ? `
                    <div class="section-header">
                        <h3 class="section-title">Danh sách API key</h3>
                    </div>
                    <div class="notif-cards">
                        ${items.map(k => `
                            <div class="notif-card">
                                <div class="notif-card-header">
                                    <div>
                                        <div class="notif-card-title">${k.name}</div>
                                        <div class="notif-card-meta">Tạo: ${formatDateShort(k.created_at)}</div>
                                    </div>
                                    <div class="badge ${k.revoked_at ? 'badge-danger' : 'badge-success'}">
                                        ${k.revoked_at ? 'Đã thu hồi' : 'Đang hoạt động'}
                                    </div>
                                </div>
                                ${k.revoked_at ? '' : `<button class="btn-danger" data-revoke-key="${k.id}">Thu hồi</button>`}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>Chưa có API key.</p>';

                apiKeyList.querySelectorAll('button[data-revoke-key]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Thu hồi API key này?')) return;
                        await api.delete(`/admin/api-keys/${btn.dataset.revokeKey}`);
                        await loadApiKeys();
                    });
                });
            } catch (error) {
                apiKeyList.innerHTML = '<p>Không thể tải API key.</p>';
            }
        }

        if (apiKeyForm) {
            apiKeyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = apiKeyForm.name.value.trim();
                if (!name) return;
                const res = await api.post('/admin/api-keys', { name });
                if (res.success) {
                    apiKeyResult.style.display = 'block';
                    apiKeyResult.innerHTML = `
                        <div class="section-header">
                            <div>
                                <h3 class="section-title">API key mới</h3>
                                <p class="section-subtitle">Chỉ hiển thị một lần, hãy copy và lưu lại.</p>
                            </div>
                            <button id="copy-api-key" class="btn-outline">Copy</button>
                        </div>
                        <div class="stat-card" style="word-break: break-all;">${res.data.key}</div>
                    `;
                    document.getElementById('copy-api-key').addEventListener('click', () => {
                        copyToClipboard(res.data.key);
                    });
                    apiKeyForm.reset();
                    await loadApiKeys();
                }
            });
        }

        await loadApiKeys();
    }

    function renderDonutChart(container, percent = 0, options = {}) {
        if (!container) return;
        const size = options.size || 120;
        const strokeW = 11;
        const radius = size / 2 - strokeW - 2;
        const circumference = 2 * Math.PI * radius;
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        const progress = (clamped / 100) * circumference;
        const uid = Math.random().toString(36).slice(2, 8);
        const gradId = `dg-${uid}`;
        const glowId = `dglow-${uid}`;
        const color1 = options.from || '#14b8a6';
        const color2 = options.to || '#f97316';

        container.innerHTML = `
            <svg viewBox="0 0 ${size} ${size}" class="donut-svg" style="overflow:visible">
                <defs>
                    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="${color1}" />
                        <stop offset="100%" stop-color="${color2}" />
                    </linearGradient>
                    <filter id="${glowId}" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                <!-- Track -->
                <circle
                    cx="${size/2}" cy="${size/2}" r="${radius}"
                    fill="none"
                    stroke="var(--admin-donut-track, rgba(15,23,42,0.08))"
                    stroke-width="${strokeW}"
                />
                <!-- Glow layer -->
                <circle
                    cx="${size/2}" cy="${size/2}" r="${radius}"
                    fill="none"
                    stroke="url(#${gradId})"
                    stroke-width="${strokeW + 4}"
                    stroke-linecap="round"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${circumference - progress}"
                    transform="rotate(-90 ${size/2} ${size/2})"
                    opacity="0.25"
                    filter="url(#${glowId})"
                />
                <!-- Value arc -->
                <circle
                    class="donut-value donut-value--anim"
                    cx="${size/2}" cy="${size/2}" r="${radius}"
                    fill="none"
                    stroke="url(#${gradId})"
                    stroke-width="${strokeW}"
                    stroke-linecap="round"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${circumference}"
                    transform="rotate(-90 ${size/2} ${size/2})"
                    data-target-offset="${circumference - progress}"
                />
                <!-- Label -->
                <text
                    class="donut-percent"
                    x="50%" y="50%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                >${clamped}%</text>
            </svg>
        `;

        // Animate the arc
        requestAnimationFrame(() => {
            const arc = container.querySelector('.donut-value--anim');
            if (!arc) return;
            const target = parseFloat(arc.dataset.targetOffset);
            arc.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)';
            arc.style.strokeDashoffset = target;
        });
    }

    function renderComboChart(container, series = [], options = {}) {
        if (!container) return;
        if (!series.length) {
            container.innerHTML = `
                <div class="chart-empty-state">
                    <i class="fas fa-chart-line"></i>
                    <p>Chưa có dữ liệu</p>
                </div>`;
            return;
        }

        const maxPoints = options.maxPoints || series.length;
        const data = series.slice(-maxPoints);
        const maxVal = Math.max(...data.map(d => d.value || 0), 1);

        const W = 560;
        const H = 200;
        const PL = 46;  // left padding (for Y labels)
        const PR = 16;
        const PT = 16;
        const PB = 36;  // bottom (for X labels)
        const chartW = W - PL - PR;
        const chartH = H - PT - PB;

        const uid = Math.random().toString(36).slice(2, 8);
        const barGradId = `bg-${uid}`;
        const barGradHoverId = `bgh-${uid}`;
        const lineGradId = `lg-${uid}`;
        const areaGradId = `ag-${uid}`;
        const clipId = `clip-${uid}`;

        const sx = (i) => PL + (i / Math.max(1, data.length - 1)) * chartW;
        const sy = (v) => PT + (1 - (v / maxVal)) * chartH;

        // Catmull-Rom to Bezier
        const catmullRomPath = (pts) => {
            if (pts.length < 2) return '';
            let d = `M ${pts[0].x} ${pts[0].y}`;
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[Math.max(0, i - 1)];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[Math.min(pts.length - 1, i + 2)];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }
            return d;
        };

        const pts = data.map((d, i) => ({ x: sx(i), y: sy(d.value || 0) }));
        const linePath = catmullRomPath(pts);
        const areaPath = linePath +
            ` L ${pts[pts.length - 1].x} ${PT + chartH}` +
            ` L ${pts[0].x} ${PT + chartH} Z`;

        // Y grid lines (4 levels)
        const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = PT + (1 - t) * chartH;
            const val = maxVal * t;
            const label = val >= 1e6 ? `${(val/1e6).toFixed(1)}M`
                : val >= 1e3 ? `${(val/1e3).toFixed(0)}K`
                : Math.round(val).toString();
            return `
                <line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}"
                    stroke="var(--admin-grid-line,rgba(148,163,184,0.12))" stroke-width="1"
                    ${t === 0 ? 'stroke-dasharray="0"' : 'stroke-dasharray="4,4"'} />
                <text x="${PL - 6}" y="${y}" class="chart-y-label" text-anchor="end" dominant-baseline="middle">${label}</text>
            `;
        }).join('');

        // Bars
        const barW = Math.max(6, Math.min(28, chartW / data.length - 8));
        const bars = data.map((d, i) => {
            const x = sx(i) - barW / 2;
            const yTop = sy(d.value || 0);
            const barH = (PT + chartH) - yTop;
            const lbl = options.labelFormat === 'month'
                ? (d.label || '').slice(0, 7)
                : (d.label || '').slice(5);
            return `
                <g class="combo-bar-g" data-val="${formatMoney(d.value || 0)}" data-label="${d.label || ''}">
                    <rect class="combo-bar-bg"
                        x="${x}" y="${PT}" width="${barW}" height="${chartH}"
                        rx="4" fill="transparent" />
                    <rect class="combo-bar"
                        x="${x}" y="${yTop}" width="${barW}" height="${barH}"
                        rx="4" fill="url(#${barGradId})"
                        style="transform-origin:${x + barW/2}px ${PT + chartH}px"
                    >
                        <title>${d.label}: ${formatMoney(d.value || 0)}</title>
                    </rect>
                    <text x="${sx(i)}" y="${PT + chartH + 16}" class="bar-label" text-anchor="middle">${lbl}</text>
                </g>
            `;
        }).join('');

        // Dots
        const dots = pts.map((p, i) => `
            <circle class="combo-dot" cx="${p.x}" cy="${p.y}" r="4">
                <title>${data[i].label}: ${formatMoney(data[i].value || 0)}</title>
            </circle>
        `).join('');

        container.innerHTML = `
            <div class="combo-legend">
                <span class="legend-item legend-bar">Doanh thu</span>
                <span class="legend-item legend-line">Xu hướng</span>
            </div>
            <div class="combo-chart-wrap">
                <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="combo-svg">
                    <defs>
                        <linearGradient id="${barGradId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#f97316" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.7"/>
                        </linearGradient>
                        <linearGradient id="${lineGradId}" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#8b5cf6"/>
                            <stop offset="50%" stop-color="#6366f1"/>
                            <stop offset="100%" stop-color="#3b82f6"/>
                        </linearGradient>
                        <linearGradient id="${areaGradId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.18"/>
                            <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
                        </linearGradient>
                        <clipPath id="${clipId}">
                            <rect x="${PL}" y="${PT}" width="${chartW}" height="${chartH}" />
                        </clipPath>
                    </defs>
                    ${gridLines}
                    <g clip-path="url(#${clipId})">
                        <!-- Area fill -->
                        <path class="combo-area" d="${areaPath}" fill="url(#${areaGradId})" />
                        <!-- Bars -->
                        ${bars}
                        <!-- Trend line -->
                        <path class="combo-line" d="${linePath}" fill="none" stroke="url(#${lineGradId})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                        <!-- Dots -->
                        ${dots}
                    </g>
                </svg>
                <div class="combo-tooltip" style="display:none"></div>
            </div>
        `;

        // Interactive hover tooltip
        const wrap = container.querySelector('.combo-chart-wrap');
        const tooltip = container.querySelector('.combo-tooltip');
        if (wrap && tooltip) {
            container.querySelectorAll('.combo-bar-g').forEach(g => {
                g.addEventListener('mouseenter', (e) => {
                    const rect = g.querySelector('.combo-bar');
                    if (rect) rect.style.filter = 'brightness(1.25) drop-shadow(0 6px 14px rgba(249,115,22,0.45))';
                    tooltip.textContent = `${g.dataset.label}: ${g.dataset.val}`;
                    tooltip.style.display = 'block';
                });
                g.addEventListener('mousemove', (e) => {
                    const wrapRect = wrap.getBoundingClientRect();
                    let tx = e.clientX - wrapRect.left + 12;
                    let ty = e.clientY - wrapRect.top - 36;
                    if (tx + 160 > wrapRect.width) tx = e.clientX - wrapRect.left - 160;
                    tooltip.style.left = `${tx}px`;
                    tooltip.style.top = `${ty}px`;
                });
                g.addEventListener('mouseleave', () => {
                    const rect = g.querySelector('.combo-bar');
                    if (rect) rect.style.filter = '';
                    tooltip.style.display = 'none';
                });
            });
        }
    }

    function formatBytes(bytes) {
        const value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
        const num = value / Math.pow(1024, idx);
        return `${num.toFixed(num >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    function initShareDataModal() {
        const modal = document.getElementById('share-data-modal');
        const closeBtn = document.getElementById('share-data-close');
        const copyBtn = document.getElementById('share-copy-json');
        const output = document.getElementById('share-json-output');

        if (!modal) return;

        const closeModal = () => {
            modal.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });

        if (copyBtn && output) {
            copyBtn.addEventListener('click', () => {
                if (!output.value) return;
                copyToClipboard(output.value);
            });
        }
    }

    async function openShareDataModal() {
        const modal = document.getElementById('share-data-modal');
        const listEl = document.getElementById('share-data-list');
        const output = document.getElementById('share-json-output');

        if (!modal || !listEl) return;
        modal.classList.add('active');
        listEl.innerHTML = '<p>Đang tải danh mục...</p>';
        if (output) output.value = '';

        try {
            const res = await api.get('/admin/share/categories');
            if (!res.success) {
                listEl.innerHTML = '<p>Không thể tải danh mục chia sẻ.</p>';
                return;
            }

            const items = res.data || [];
            if (!items.length) {
                listEl.innerHTML = '<p>Chưa có danh mục để chia sẻ.</p>';
                return;
            }

            listEl.innerHTML = items.map(item => `
                <div class="share-data-item">
                    <div class="section-title">${item.label}</div>
                    <div class="section-subtitle">${item.description || ''}</div>
                    <div class="badge badge-info">Số lượng: ${item.count || 0}</div>
                    <button class="btn-outline" data-share-key="${item.key}">Xem JSON</button>
                </div>
            `).join('');

            listEl.querySelectorAll('[data-share-key]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const key = btn.dataset.shareKey;
                    if (!key) return;
                    btn.disabled = true;
                    btn.textContent = 'Đang tải...';
                    try {
                        const dataRes = await api.get(`/admin/share/data/${key}`);
                        if (dataRes.success && output) {
                            output.value = JSON.stringify(dataRes.data, null, 2);
                            showToast('Đã tải JSON', 'success');
                        } else {
                            showToast('Không thể tải JSON', 'error');
                        }
                    } catch (error) {
                        showToast(error.message || 'Không thể tải JSON', 'error');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Xem JSON';
                    }
                });
            });
        } catch (error) {
            listEl.innerHTML = '<p>Không thể tải danh mục chia sẻ.</p>';
        }
    }
    async function loadMxhCategories() {
        const container = document.getElementById('tab-mxh_categories');
        if (!container) return;

        try {
            const response = await api.get('/mxh/categories');
            if (!response.success) {
                container.innerHTML = `<div class="error-state">Lỗi: ${response.message}</div>`;
                return;
            }

            const categories = Array.isArray(response.data) ? response.data : [];
            
            // Group by platform
            const groups = {};
            const PLATFORMS = ['facebook', 'tiktok', 'instagram', 'youtube', 'twitter', 'zalo', 'telegram', 'other'];
            PLATFORMS.forEach(p => groups[p] = []);
            categories.forEach(cat => {
                const p = cat.platform || 'other';
                if (!groups[p]) groups[p] = [];
                groups[p].push(cat);
            });

            PLATFORMS.forEach((p) => {
                groups[p].sort((a, b) => {
                    const ao = Number(a.display_order || 0);
                    const bo = Number(b.display_order || 0);
                    if (ao !== bo) return ao - bo;
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });
            });

            const PLATFORM_LABELS = {
                'facebook': 'Facebook', 'tiktok': 'TikTok', 'instagram': 'Instagram',
                'youtube': 'YouTube', 'twitter': 'X / Twitter', 'zalo': 'Zalo',
                'telegram': 'Telegram', 'other': 'Khác'
            };

            let tableHtml = '';
            const totalSummary = PLATFORMS.map((pKey) => `${PLATFORM_LABELS[pKey]}: ${groups[pKey].length}`).join(' · ');
            PLATFORMS.forEach(pKey => {
                const cats = groups[pKey];
                const label = PLATFORM_LABELS[pKey];
                
                // Platform Header
                tableHtml += `
                    <tr class="platform-group-row">
                        <td colspan="6">
                            <div class="platform-group-header">
                                <span class="platform-badge" data-platform="${pKey}">${label}</span>
                                <button class="btn btn-sm btn-outline-primary btn-add-sub-cat" data-platform="${pKey}">
                                    <i class="fas fa-plus"></i> Thêm mục con cho ${label}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;

                if (cats.length === 0) {
                    tableHtml += `<tr class="empty-group-row"><td colspan="6" class="text-muted text-center" style="font-size:12px; padding:12px">Chưa có loại tài khoản nào cho ${label}</td></tr>`;
                }

                cats.forEach(cat => {
                    tableHtml += `
                        <tr class="sub-category-row">
                            <td>${cat.id}</td>
                            <td>
                                <div class="sub-cat-cell">
                                    <span class="sub-cat-indent"></span>
                                    <span class="cat-color-pill" style="background:${cat.color || '#6366f1'}"></span>
                                    <strong>${cat.name}</strong>
                                </div>
                            </td>
                            <td><code>${cat.slug}</code></td>
                            <td><i class="${cat.icon || 'fas fa-share-nodes'}" style="color:${cat.color || '#6366f1'}"></i></td>
                            <td>${cat.display_order || 0}</td>
                            <td>
                                <div class="admin-actions">
                                    <button class="btn-icon btn-edit-mxh-cat" data-id="${cat.id}" title="Sửa"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon text-danger btn-delete-mxh-cat" data-id="${cat.id}" title="Xóa"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            });

            container.innerHTML = `
                <div class="section-header">
                    <div>
                        <h2 class="section-title"><i class="fas fa-share-nodes"></i> Quản lý danh mục MXH</h2>
                        <p class="section-subtitle">Cấu trúc theo nền tảng lớn, bên trong là nhiều mục con. ${totalSummary}</p>
                    </div>
                    <button id="btn-add-mxh-cat" class="btn btn-primary"><i class="fas fa-plus"></i> Thêm danh mục</button>
                </div>
                <div class="admin-table-wrapper">
                    <table class="admin-table tree-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên loại (Mục con)</th>
                                <th>Slug</th>
                                <th>Icon</th>
                                <th>Thứ tự</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableHtml}
                        </tbody>
                    </table>
                </div>
            `;

            // Bind events
            container.querySelector('#btn-add-mxh-cat').addEventListener('click', () => showMxhCatModal());
            
            container.querySelectorAll('.btn-add-sub-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    const platform = btn.getAttribute('data-platform');
                    showMxhCatModal(null, platform);
                });
            });

            container.querySelectorAll('.btn-edit-mxh-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const cat = categories.find(c => c.id == id);
                    if (cat) showMxhCatModal(cat);
                });
            });
            
            container.querySelectorAll('.btn-delete-mxh-cat').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
                    const id = btn.getAttribute('data-id');
                    const res = await api.delete(`/mxh/categories/${id}`);
                    if (res.success) {
                        showToast(res.message, 'success');
                        loadMxhCategories();
                    } else {
                        showToast(res.message, 'error');
                    }
                });
            });

        } catch (error) {
            container.innerHTML = `<div class="error-state">Lỗi khi tải danh mục MXH</div>`;
        }
    }

    function showMxhCatModal(cat = null, defaultPlatform = null) {
        const isEdit = !!cat;
        const modalId = 'mxh-cat-modal';
        let modal = document.getElementById(modalId);
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal modal-premium';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px">
                <div class="modal-header">
                    <h3 class="section-title" style="margin:0">${isEdit ? 'Chỉnh sửa danh mục' : (defaultPlatform ? `Thêm loại cho ${defaultPlatform}` : 'Thêm danh mục mới')}</h3>
                    <button class="modal-close" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="mxh-cat-form">
                        <div class="premium-form-grid">
                            <div class="premium-form-group">
                                <label>Tên loại tài khoản (Ví dụ: FB Via Cổ)</label>
                                <input type="text" name="name" class="premium-input" value="${cat?.name || ''}" placeholder="Ví dụ: FB via cổ, TikTok clone, IG via..." required>
                            </div>
                            <div class="premium-form-group">
                                <label>Slug (Mã định danh)</label>
                                <input type="text" name="slug" class="premium-input" value="${cat?.slug || ''}" placeholder="fb-via-co" required>
                            </div>
                            <div class="premium-form-group">
                                <label>Mạng xã hội (Nền tảng)</label>
                                <select name="platform" class="premium-input">
                                    <option value="facebook" ${(cat?.platform || defaultPlatform) === 'facebook' ? 'selected' : ''}>Facebook</option>
                                    <option value="tiktok" ${(cat?.platform || defaultPlatform) === 'tiktok' ? 'selected' : ''}>TikTok</option>
                                    <option value="instagram" ${(cat?.platform || defaultPlatform) === 'instagram' ? 'selected' : ''}>Instagram</option>
                                    <option value="youtube" ${(cat?.platform || defaultPlatform) === 'youtube' ? 'selected' : ''}>YouTube</option>
                                    <option value="twitter" ${(cat?.platform || defaultPlatform) === 'twitter' ? 'selected' : ''}>X / Twitter</option>
                                    <option value="zalo" ${(cat?.platform || defaultPlatform) === 'zalo' ? 'selected' : ''}>Zalo</option>
                                    <option value="telegram" ${(cat?.platform || defaultPlatform) === 'telegram' ? 'selected' : ''}>Telegram</option>
                                    <option value="other" ${(cat?.platform || defaultPlatform) === 'other' ? 'selected' : ''}>Khác</option>
                                </select>
                            </div>
                            <div class="premium-form-group">
                                <label>Icon (FontAwesome)</label>
                                <input type="text" name="icon" class="premium-input" value="${cat?.icon || 'fab fa-facebook'}" placeholder="fab fa-facebook">
                            </div>
                            <div class="premium-form-group">
                                <label>Màu sắc</label>
                                <div style="display:flex; gap:10px">
                                    <input type="color" name="color" class="premium-input" value="${cat?.color || '#6366f1'}" style="padding:4px; height:48px; width:60px; cursor:pointer">
                                    <input type="text" id="color-text" class="premium-input" value="${cat?.color || '#6366f1'}" placeholder="#000000">
                                </div>
                            </div>
                            <div class="premium-form-group">
                                <label>Thứ tự hiển thị</label>
                                <input type="number" name="sort_order" class="premium-input" value="${cat?.display_order || 0}">
                            </div>
                        </div>

                        <div style="margin-top:10px">
                            <label style="font-size:0.8rem; color:#94a3b8; margin-bottom:8px; display:block">Xem trước hiển thị:</label>
                            <div class="cat-preview-card" id="cat-preview">
                                <div class="cat-preview-icon" style="background:${(cat?.color || '#6366f1')}15; color:${cat?.color || '#6366f1'}">
                                    <i class="${cat?.icon || 'fab fa-facebook'}"></i>
                                </div>
                                <div class="cat-preview-info">
                                    <div class="cat-preview-name">${cat?.name || 'Tên danh mục'}</div>
                                    <div class="cat-preview-slug">${cat?.slug || 'slug-danh-muc'}</div>
                                </div>
                            </div>
                        </div>

                        <div class="form-actions" style="margin-top:32px; display:flex; justify-content:flex-end; gap:12px">
                            <button type="button" class="btn btn-outline modal-close" style="border-radius:12px">Hủy bỏ</button>
                            <button type="submit" class="btn btn-primary" style="border-radius:12px; padding:12px 32px">${isEdit ? 'Lưu thay đổi' : 'Tạo danh mục'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        modal.classList.add('active');

        const close = () => modal.classList.remove('active');
        modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', close));

        // Realtime preview
        const form = modal.querySelector('#mxh-cat-form');
        const previewIcon = modal.querySelector('.cat-preview-icon');
        const previewName = modal.querySelector('.cat-preview-name');
        const previewSlug = modal.querySelector('.cat-preview-slug');
        const colorInput = form.querySelector('input[name="color"]');
        const colorText  = form.querySelector('#color-text');
        const iconInput  = form.querySelector('input[name="icon"]');
        const nameInput  = form.querySelector('input[name="name"]');
        const slugInput  = form.querySelector('input[name="slug"]');

        const updatePreview = () => {
            const color = colorInput.value;
            colorText.value = color;
            previewIcon.style.color = color;
            previewIcon.style.background = `${color}15`;
            previewIcon.innerHTML = `<i class="${iconInput.value || 'fas fa-share-nodes'}"></i>`;
            previewName.textContent = nameInput.value || 'Tên danh mục';
            previewSlug.textContent = slugInput.value || 'slug-danh-muc';
        };

        [colorInput, iconInput, nameInput, slugInput].forEach(el => el.addEventListener('input', updatePreview));
        colorText.addEventListener('input', (e) => {
            if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                colorInput.value = e.target.value;
                updatePreview();
            }
        });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                let res;
                if (isEdit) {
                    res = await api.put(`/mxh/categories/${cat.id}`, data);
                } else {
                    res = await api.post('/mxh/categories', data);
                }

                if (res.success) {
                    showToast(res.message, 'success');
                    close();
                    loadMxhCategories();
                } else {
                    showToast(res.message, 'error');
                }
            } catch (err) {
                showToast('Lỗi khi lưu danh mục', 'error');
            }
        });
    }
};




