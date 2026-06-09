window.pageInit = async function(params, query = {}) {
    const platformMeta = {
        facebook: { label: 'Facebook', icon: 'fab fa-facebook', color: '#1877f2' },
        tiktok: { label: 'TikTok', icon: 'fab fa-tiktok', color: '#010101' },
        instagram: { label: 'Instagram', icon: 'fab fa-instagram', color: '#e1306c' }
    };

    let categories = [];
    let services = [];
    let serviceItems = [];
    let selectedPlatform = query.platform || 'facebook';
    let selectedCategoryId = query.category_id || '';
    let selectedPackageId = query.service_id || '';
    let selectedItemId = query.item_id || '';
    let searchTerm = '';
    let selectedPackage = null;
    let selectedService = null;

    function getBaseQuantity(target) {
        if (!target) return 1;
        const name = target.name || '';
        const matches = name.replace(/[,.]/g, '').match(/\d+/g);
        if (matches && matches.length > 0) {
            for (const numStr of matches) {
                const num = parseInt(numStr, 10);
                if (num >= 10) return num;
            }
            const firstNum = parseInt(matches[0], 10);
            if (firstNum > 0) return firstNum;
        }
        const defaultQty = parseInt(target.default_quantity || target.defaultQuantity, 10);
        if (defaultQty > 0) return defaultQty;
        return 1;
    }

    function formatUnitPrice(amount) {
        return amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' đ';
    }

    const summaryEl = document.getElementById('mxh-service-summary');
    const platformTabsEl = document.getElementById('mxh-service-platform-tabs');
    const categoryChipsEl = document.getElementById('mxh-service-category-chips');
    const gridEl = document.getElementById('mxh-service-grid');
    const panelEl = document.getElementById('mxh-service-order-panel');
    const selectedBadgeEl = document.getElementById('mxh-service-selected-badge');
    const ordersEl = document.getElementById('mxh-service-orders');
    const searchEl = document.getElementById('mxh-service-search');

    renderSummary();
    bindSearch();
    await loadAll();

    document.getElementById('mxh-service-refresh-orders')?.addEventListener('click', loadOrders);
    window.pageCleanup = () => {};

    function bindSearch() {
        if (!searchEl) return;
        searchEl.value = searchTerm;
        searchEl.addEventListener('input', () => {
            searchTerm = searchEl.value.trim();
            renderServices();
        });
    }

    function renderSummary() {
        const user = Auth.getCurrentUser?.() || {};
        summaryEl.innerHTML = `
            <div class="stat-grid admin-stat-grid">
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-wallet"></i></div>
                    <div class="stat-card-body">
                        <div class="stat-card-label">Số dư hiện tại</div>
                        <div class="stat-card-value">${formatMoney(user.balance || 0)}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-box"></i></div>
                    <div class="stat-card-body">
                        <div class="stat-card-label">Gói khả dụng</div>
                        <div class="stat-card-value">${services.length}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-icon"><i class="fas fa-bell"></i></div>
                    <div class="stat-card-body">
                        <div class="stat-card-label">Nền tảng</div>
                        <div class="stat-card-value">3</div>
                    </div>
                </div>
            </div>
        `;
    }

    async function loadAll() {
        await Promise.all([loadCategories(), loadServices(), loadItems(), loadOrders()]);
        resolveSelectedTarget();
        renderPlatformTabs();
        renderCategoryChips();
        renderServices();
        renderSelectedServicePanel();
    }

    async function loadCategories() {
        const res = await api.get('/mxh/categories', { kind: 'service' });
        categories = res.success ? (res.data || []) : [];
    }

    async function loadServices() {
        const params = { limit: 100 };
        if (selectedPlatform && selectedPlatform !== 'all') params.platform = selectedPlatform;
        if (selectedCategoryId) params.category_id = selectedCategoryId;
        if (searchTerm) params.search = searchTerm;
        const res = await api.get('/mxh/services', params);
        services = res.success ? (res.data || []) : [];
        selectedPackage = services.find(item => String(item.id) === String(selectedPackageId)) || services[0] || null;
        if (selectedPackage) {
            selectedPackageId = selectedPackage.id;
        }
    }

    async function loadItems() {
        const params = { limit: 200 };
        if (selectedPlatform && selectedPlatform !== 'all') params.platform = selectedPlatform;
        if (selectedCategoryId) params.category_id = selectedCategoryId;
        const res = await api.get('/mxh/service-items', params);
        serviceItems = res.success ? (res.data || []) : [];
    }

    function getPackageItems(packageId) {
        return serviceItems
            .filter(item => String(item.package_id) === String(packageId))
            .sort((a, b) => {
                const ao = Number(a.display_order || 0);
                const bo = Number(b.display_order || 0);
                if (ao !== bo) return ao - bo;
                return Number(a.id || 0) - Number(b.id || 0);
            });
    }

    function resolveSelectedTarget() {
        if (!selectedPackage) {
            selectedService = null;
            selectedItemId = '';
            return;
        }

        const items = getPackageItems(selectedPackage.id);
        const matchedItem = selectedItemId
            ? items.find(item => String(item.id) === String(selectedItemId))
            : null;
        selectedService = matchedItem || items[0] || selectedPackage;
        if (selectedService && String(selectedService.id) !== String(selectedPackage.id)) {
            selectedItemId = selectedService.id;
        } else {
            selectedItemId = '';
        }
    }

    async function loadOrders() {
        if (!ordersEl) return;
        try {
            const res = await api.get('/mxh/service-orders/me', { limit: 30 });
            const orders = res.success ? (res.data || []) : [];
            if (!orders.length) {
                ordersEl.innerHTML = `<div class="chart-empty-state"><i class="fas fa-receipt"></i><p>Chưa có đơn dịch vụ nào</p></div>`;
                return;
            }

            ordersEl.innerHTML = orders.map(order => `
                <div class="mxh-service-order-item">
                    <div class="mxh-service-order-head">
                        <div>
                            <strong>#${order.id} - ${escapeHtml(order.service_item_name || order.service_name || '')}</strong>
                            <div class="section-subtitle">${escapeHtml(order.category_name || '')} · ${escapeHtml(order.platform || '')}</div>
                        </div>
                        <span class="badge ${order.status === 'completed' ? 'badge-success' : order.status === 'cancelled' ? 'badge-danger' : 'badge-info'}">${order.status}</span>
                    </div>
                    <div class="mxh-service-order-meta">
                        <span>Link: <a href="${escapeHtml(order.link || '#')}" target="_blank" rel="noreferrer">mở</a></span>
                        <span>Số lượng: ${order.quantity}</span>
                        <span>Tổng: ${formatMoney(order.total_price)}</span>
                    </div>
                    ${order.admin_note ? `<div class="mxh-service-order-note">Ghi chú admin: ${escapeHtml(order.admin_note)}</div>` : ''}
                    ${order.test_message ? `<div class="mxh-service-order-note">Test: ${escapeHtml(order.test_message)}</div>` : ''}
                </div>
            `).join('');
        } catch (error) {
            ordersEl.innerHTML = `<div class="error-state">Không thể tải lịch sử đơn</div>`;
        }
    }

    function renderPlatformTabs() {
        if (!platformTabsEl) return;
        const tabs = ['all', 'facebook', 'tiktok', 'instagram'];
        platformTabsEl.innerHTML = tabs.map(platform => {
            const meta = platform === 'all'
                ? { label: 'Tất cả', icon: 'fas fa-globe', color: '#6366f1' }
                : platformMeta[platform];
            const count = platform === 'all'
                ? services.length
                : services.filter(item => item.platform === platform).length;
            const active = selectedPlatform === platform;
            return `
                <button class="mxh-service-platform-btn ${active ? 'active' : ''}" data-platform="${platform}" style="--platform-color:${meta.color}">
                    <i class="${meta.icon}"></i>
                    <span>${meta.label}</span>
                    <b>${count}</b>
                </button>
            `;
        }).join('');

        platformTabsEl.querySelectorAll('.mxh-service-platform-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                selectedPlatform = btn.dataset.platform;
                selectedCategoryId = '';
                selectedPackageId = '';
                selectedItemId = '';
                selectedPackage = null;
                selectedService = null;
                await loadServices();
                await loadItems();
                resolveSelectedTarget();
                renderPlatformTabs();
                renderCategoryChips();
                renderServices();
                renderSelectedServicePanel();
            });
        });
    }

    function renderCategoryChips() {
        if (!categoryChipsEl) return;
        const items = selectedPlatform === 'all'
            ? categories
            : categories.filter(cat => cat.platform === selectedPlatform);
        categoryChipsEl.innerHTML = [
            `<button class="mxh-chip ${!selectedCategoryId ? 'active' : ''}" data-cat="">
                <span class="mxh-chip-icon"><i class="fas fa-layer-group"></i></span>
                <span class="mxh-chip-copy"><strong>Tất cả loại</strong></span>
            </button>`,
            ...items.map(cat => `
                <button class="mxh-chip ${String(selectedCategoryId) === String(cat.id) ? 'active' : ''}" data-cat="${cat.id}" style="--chip-color:${cat.color || '#6366f1'}">
                    <span class="mxh-chip-icon"><i class="${cat.icon || 'fas fa-share-nodes'}"></i></span>
                    <span class="mxh-chip-copy"><strong>${escapeHtml(cat.name || '')}</strong></span>
                </button>
            `)
        ].join('');

        categoryChipsEl.querySelectorAll('.mxh-chip').forEach(btn => {
            btn.addEventListener('click', async () => {
                selectedCategoryId = btn.dataset.cat || '';
                selectedPackageId = '';
                selectedItemId = '';
                selectedPackage = null;
                selectedService = null;
                await loadServices();
                await loadItems();
                resolveSelectedTarget();
                renderCategoryChips();
                renderServices();
                renderSelectedServicePanel();
            });
        });
    }

    function renderServices() {
        if (!gridEl) return;
        const items = services.filter(service => {
            if (searchTerm) {
                const hay = `${service.name || ''} ${service.description || ''} ${service.category_name || ''}`.toLowerCase();
                if (!hay.includes(searchTerm.toLowerCase())) return false;
            }
            return true;
        });

        if (!items.length) {
            gridEl.innerHTML = `<div class="chart-empty-state"><i class="fas fa-box-open"></i><p>Không có gói dịch vụ phù hợp</p></div>`;
            return;
        }

        gridEl.innerHTML = items.map(item => {
            const meta = platformMeta[item.platform] || platformMeta.facebook;
            const active = selectedPackage && String(selectedPackage.id) === String(item.id);
            const itemCount = Number(item.item_count || 0);
            return `
                <article class="mxh-service-card ${active ? 'active' : ''}" data-id="${item.id}">
                    <div class="mxh-service-card-head">
                        <span class="mxh-service-platform" style="background:${meta.color}">
                            <i class="${meta.icon}"></i> ${meta.label}
                        </span>
                        <span class="badge badge-info">${escapeHtml(item.category_name || '')}</span>
                    </div>
                    <h3>${escapeHtml(item.name || '')}</h3>
                    <p>${escapeHtml(item.description || '')}</p>
                    <div class="mxh-service-card-meta">
                        <span><i class="fas fa-tag"></i> ${formatMoney(item.price)} / ${getBaseQuantity(item)} ${item.unit_label || 'cái'}</span>
                        <span><i class="fas fa-layer-group"></i> ${itemCount} dịch vụ con</span>
                    </div>
                    <button class="btn-primary mxh-service-card-btn" data-id="${item.id}">Chọn gói</button>
                </article>
            `;
        }).join('');

        gridEl.querySelectorAll('.mxh-service-card, .mxh-service-card-btn').forEach(el => {
            el.addEventListener('click', async (e) => {
                e.preventDefault();
                const id = el.dataset.id;
                selectedPackage = services.find(item => String(item.id) === String(id)) || selectedPackage;
                selectedPackageId = id;
                selectedItemId = '';
                resolveSelectedTarget();
                renderServices();
                renderSelectedServicePanel();

                // Auto-scroll to order panel on mobile/tablet viewports
                if (window.innerWidth <= 768) {
                    const panel = document.querySelector('.mxh-service-panel');
                    if (panel) {
                        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    }

    function renderSelectedServicePanel() {
        if (!panelEl) return;
        if (!selectedPackage || !selectedService) {
            panelEl.innerHTML = `<div class="chart-empty-state"><i class="fas fa-bullhorn"></i><p>Chọn một gói dịch vụ để đặt đơn</p></div>`;
            selectedBadgeEl.textContent = 'Chưa chọn';
            return;
        }

        const activeTarget = selectedService;
        const baseQty = getBaseQuantity(activeTarget);
        const rawPrice = Number(activeTarget.price || 0);
        const unitPrice = rawPrice / baseQty;
        const packageItems = getPackageItems(selectedPackage.id);
        const minQty = Number(activeTarget.quantity_min || 1);
        const maxQty = Number(activeTarget.quantity_max || 1000);
        const defaultQty = Number(activeTarget.default_quantity || minQty);

        selectedBadgeEl.textContent = selectedPackage.name;
        panelEl.innerHTML = `
            <div class="mxh-service-selected">
                <div class="section-title">${escapeHtml(selectedPackage.name || '')}</div>
                <div class="section-subtitle">${escapeHtml(selectedPackage.description || '')}</div>
                ${activeTarget.id !== selectedPackage.id ? `<div class="mxh-service-hint">Đang chọn dịch vụ con: <strong>${escapeHtml(activeTarget.name || '')}</strong></div>` : ''}
                ${packageItems.length ? `
                    <div class="mxh-service-item-tabs">
                        ${packageItems.map(item => `
                            <button type="button" class="mxh-service-item-btn ${String(activeTarget.id) === String(item.id) ? 'active' : ''}" data-item="${item.id}">
                                <span>${escapeHtml(item.name || '')}</span>
                                <b>${formatMoney(item.price)} / ${getBaseQuantity(item)}</b>
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="mxh-service-selected-meta">
                    <span class="badge badge-info">Giá gói: ${formatMoney(rawPrice)} / ${baseQty} ${activeTarget.unit_label || 'cái'}</span>
                    <span class="badge badge-success">SL: ${minQty} - ${maxQty}</span>
                </div>
                <form id="mxh-service-order-form" class="mxh-service-order-form">
                    <div class="form-group">
                        <label>Link cần xử lý</label>
                        <input type="url" name="link" placeholder="${escapeHtml(activeTarget.link_label || 'Link')}" required>
                    </div>
                    <div class="form-group">
                        <label>Số lượng</label>
                        <input type="number" name="quantity" min="${minQty}" max="${maxQty}" value="${defaultQty}" required>
                    </div>
                    <div class="form-group">
                        <label>Ghi chú</label>
                        <textarea name="user_note" rows="3" placeholder="${escapeHtml(activeTarget.note_label || 'Ghi chú') || ''}"></textarea>
                    </div>
                    <div class="mxh-service-total-row">
                        <span>Đơn giá (1 ${activeTarget.unit_label || 'cái'})</span>
                        <strong id="mxh-service-unit-price">${formatUnitPrice(unitPrice)}</strong>
                    </div>
                    <div class="mxh-service-total-row">
                        <span>Tạm tính</span>
                        <strong id="mxh-service-total">${formatMoney(Math.round((defaultQty || 0) * unitPrice))}</strong>
                    </div>
                    <button type="submit" class="btn-primary" id="mxh-service-submit-btn">Gửi yêu cầu</button>
                </form>
                ${activeTarget.form_hint ? `<div class="mxh-service-hint">${escapeHtml(activeTarget.form_hint)}</div>` : ''}
            </div>
        `;

        panelEl.querySelectorAll('.mxh-service-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedItemId = btn.dataset.item;
                resolveSelectedTarget();
                renderSelectedServicePanel();
            });
        });

        const form = document.getElementById('mxh-service-order-form');
        const quantityEl = form.querySelector('input[name="quantity"]');
        const totalEl = document.getElementById('mxh-service-total');

        const updateTotal = () => {
            const qty = Math.max(minQty, Math.min(maxQty, parseInt(quantityEl.value || defaultQty, 10) || defaultQty));
            quantityEl.value = qty;
            totalEl.textContent = formatMoney(Math.round(qty * unitPrice));
        };

        quantityEl.addEventListener('input', updateTotal);
        updateTotal();

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                service_id: selectedPackage.id,
                service_item_id: activeTarget.id !== selectedPackage.id ? activeTarget.id : '',
                link: form.link.value.trim(),
                quantity: parseInt(form.quantity.value, 10),
                user_note: form.user_note.value.trim()
            };

            if (!payload.link) {
                showToast('Vui lòng nhập link', 'error');
                return;
            }

            const submitBtn = document.getElementById('mxh-service-submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>Đang gửi...';

            try {
                const res = await api.post('/mxh/service-orders', payload);
                if (!res.success) {
                    throw new Error(res.message || 'Không thể tạo đơn');
                }

                if (typeof res.data?.newBalance === 'number') {
                    Auth.updateUser({ balance: res.data.newBalance });
                    window.appInstance?.updateUserSection?.();
                    renderSummary();
                }

                showToast(res.message || 'Đã tạo đơn dịch vụ', 'success');
                form.reset();
                quantityEl.value = defaultQty;
                updateTotal();
                await loadOrders();
            } catch (error) {
                showToast(error.message || 'Không thể tạo đơn', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Gửi yêu cầu';
            }
        });
    }
};
