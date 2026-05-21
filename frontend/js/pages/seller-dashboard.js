window.pageInit = async function() {
    const summaryEl = document.getElementById('seller-dashboard-summary');
    const productsEl = document.getElementById('seller-dashboard-products');
    const withdrawsEl = document.getElementById('seller-dashboard-withdraws');
    const txEl = document.getElementById('seller-dashboard-transactions');

    try {
        const res = await api.get('/withdraw/dashboard', {}, { forceRefresh: true });
        if (!res.success) throw new Error(res.message || 'Load failed');

        const data = res.data || {};
        const summary = data.summary || {};
        const mission = data.missionToday || {};
        const products = Array.isArray(data.products) ? data.products : [];
        const withdraws = Array.isArray(data.withdraws) ? data.withdraws : [];
        const txs = Array.isArray(data.recentTransactions) ? data.recentTransactions : [];

        summaryEl.innerHTML = `
            <div class="income-stat-card is-primary">
                <span class="income-stat-label">Số dư hiện tại</span>
                <strong>${formatMoney(data.balance || 0)}</strong>
            </div>
            <div class="income-stat-card">
                <span class="income-stat-label">Doanh thu bán hàng</span>
                <strong>${formatMoney(summary.sales_income || 0)}</strong>
            </div>
            <div class="income-stat-card">
                <span class="income-stat-label">Tiền nhiệm vụ</span>
                <strong>${formatMoney(summary.mission_income || 0)}</strong>
            </div>
            <div class="income-stat-card">
                <span class="income-stat-label">Đang chờ rút</span>
                <strong>${formatMoney(summary.withdrawn_pending || 0)}</strong>
            </div>
            <div class="income-stat-card">
                <span class="income-stat-label">Tổng tiền vào</span>
                <strong>${formatMoney(summary.total_in || 0)}</strong>
            </div>
            <div class="income-stat-card">
                <span class="income-stat-label">Nhiệm vụ hôm nay</span>
                <strong>${mission.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}</strong>
                ${mission.usedAt ? `<small>${formatDateShort(mission.usedAt)}</small>` : ''}
            </div>
        `;

        renderProducts(products);
        renderWithdraws(withdraws);
        renderTransactions(txs);
    } catch (error) {
        summaryEl.innerHTML = '<div class="income-empty-state">Không thể tải dashboard thu nhập.</div>';
        productsEl.innerHTML = '';
        withdrawsEl.innerHTML = '';
        txEl.innerHTML = '';
    }

    function renderProducts(items) {
        const ranked = items
            .map((item) => ({
                ...item,
                score: Number(item.paid_sales || item.purchase_count || 0) * 3 + Number(item.view_count || 0) + Number(item.income || 0) / 100000
            }))
            .sort((a, b) => b.score - a.score);

        const topItems = ranked.slice(0, 5);
        const otherItems = ranked.slice(5);

        if (!topItems.length) {
            productsEl.innerHTML = '<div class="income-empty-state">Bạn chưa có sản phẩm nào.</div>';
            return;
        }

        productsEl.innerHTML = `
            <div class="income-product-list">
                ${topItems.map(renderProductCard).join('')}
            </div>
            ${otherItems.length ? `
                <details class="income-products-more">
                    <summary>Xem thêm ${otherItems.length} sản phẩm</summary>
                    <div class="income-product-list is-collapsed">
                        ${otherItems.map(renderProductCard).join('')}
                    </div>
                </details>
            ` : ''}
        `;

        productsEl.querySelectorAll('[data-edit]').forEach((btn) => {
            btn.addEventListener('click', () => router.navigate(`/suasanpham/${btn.dataset.edit}`));
        });

        productsEl.querySelectorAll('[data-delete]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Xóa sản phẩm này?')) return;
                try {
                    await api.delete(`/products/${btn.dataset.delete}`);
                    showToast('Đã xóa sản phẩm', 'success');
                    window.pageInit();
                } catch (error) {
                    showToast(error.message || 'Không thể xóa sản phẩm', 'error');
                }
            });
        });
    }

    function renderProductCard(product) {
        return `
            <article class="income-product-card">
                <div class="income-product-card-head">
                    <div>
                        <strong>${escapeHtml(product.title || '')}</strong>
                        <span>${escapeHtml(product.slug || `ID ${product.id}`)}</span>
                    </div>
                    <span class="income-status-chip">${escapeHtml(product.status || 'draft')}</span>
                </div>
                <div class="income-product-metrics">
                    <div><span>Lượt mua</span><strong>${Number(product.paid_sales || product.purchase_count || 0)}</strong></div>
                    <div><span>Lượt xem</span><strong>${Number(product.view_count || 0)}</strong></div>
                    <div><span>Doanh thu</span><strong>${formatMoney(product.income || 0)}</strong></div>
                </div>
                <div class="income-product-actions">
                    <button class="btn-outline" data-edit="${product.id}">Sửa</button>
                    <button class="btn-danger" data-delete="${product.id}">Xóa</button>
                </div>
            </article>
        `;
    }

    function renderWithdraws(rows) {
        withdrawsEl.innerHTML = rows.length ? `
            <div class="income-withdraw-list">
                ${rows.map((row) => `
                    <div class="income-withdraw-card">
                        <div class="income-withdraw-top">
                            <strong>${formatMoney(row.net_amount || 0)}</strong>
                            <span class="income-status-chip is-${escapeHtml(String(row.status || '').toLowerCase())}">${renderWithdrawStatus(row.status)}</span>
                        </div>
                        <div class="income-withdraw-meta">Yêu cầu: ${formatMoney(row.amount || 0)}</div>
                        <div class="income-withdraw-meta">Phí: ${formatMoney(row.fee || 0)}</div>
                        <div class="income-withdraw-meta">${row.expected_at ? `Dự kiến: ${formatDateShort(row.expected_at)}` : 'Đang chờ xử lý'}</div>
                    </div>
                `).join('')}
            </div>
        ` : '<div class="income-empty-state">Chưa có lệnh rút nào.</div>';
    }

    function renderTransactions(rows) {
        txEl.innerHTML = rows.length ? `
            <ul class="inspect-timeline">
                ${rows.map((tx) => `
                    <li>
                        <div class="inspect-dot"></div>
                        <div class="inspect-timeline-body">
                            <div class="inspect-timeline-top">
                                <span class="inspect-activity-type">${escapeHtml(tx.type || '')}</span>
                                <span class="inspect-activity-time">${formatDateShort(tx.created_at)}</span>
                            </div>
                            <div class="inspect-activity-text">${escapeHtml(tx.description || '')}</div>
                            <div class="inspect-amount ${Number(tx.amount || 0) < 0 ? 'minus' : 'plus'}">${formatMoney(tx.amount || 0)}</div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        ` : '<div class="income-empty-state">Chưa có dòng tiền gần đây.</div>';
    }

    function renderWithdrawStatus(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'approved') return 'Đã duyệt';
        if (value === 'rejected') return 'Từ chối';
        return 'Đang xử lý';
    }
};
