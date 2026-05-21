// ============================================
// LICH SU MUA PAGE
// File: frontend/js/pages/lichsumua.js
// ============================================

window.pageInit = async function() {
    const list = document.getElementById('purchase-list');

    try {
        const response = await api.get('/wallet/purchases');
        if (response.success) {
            renderPurchases(response.data.purchases || []);
        } else {
            list.innerHTML = '<p>Không thể tải lịch sử mua hàng.</p>';
        }
    } catch (error) {
        list.innerHTML = '<p>Không thể tải lịch sử mua hàng.</p>';
    }

    function renderActionButton(item) {
        const label = item.action_label || (item.purchase_type === 'mxh_account' ? 'Xem tài khoản' : 'Tải về');
        const url = item.action_url || item.download_url || '';

        if (!url) {
            return '<span>-</span>';
        }

        if (item.purchase_type !== 'mxh_account' && item.download_url) {
            return `<a class="btn btn-primary" href="${escapeHtml(item.download_url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
        }

        if (item.purchase_type === 'mxh_account' && item.action_url) {
            return `<a class="btn btn-primary" href="${escapeHtml(item.action_url)}" data-link>${escapeHtml(label)}</a>`;
        }

        if (/^https?:\/\//i.test(url) || url.startsWith('/uploads/')) {
            return `<a class="btn btn-primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
        }

        return `<a class="btn btn-primary" href="${escapeHtml(url)}" data-link>${escapeHtml(label)}</a>`;
    }

    function renderTitle(item) {
        const href = item.purchase_type === 'mxh_account'
            ? (item.action_url || `/mxh/account/${item.account_id || item.record_id || ''}`)
            : `/page2/${item.slug || item.product_id}`;
        const fallbackTitle = item.purchase_type === 'mxh_account'
            ? 'Tài khoản MXH đã mua'
            : 'Sản phẩm đã lưu trữ';

        return `
            <a href="${escapeHtml(href)}" data-link>
                ${escapeHtml(item.title || fallbackTitle)}
            </a>
            ${item.is_archived ? '<span class="badge badge-info" style="margin-left:6px;">Lưu trữ</span>' : ''}
            ${item.purchase_type_label ? `<span class="badge badge-secondary" style="margin-left:6px;">${escapeHtml(item.purchase_type_label)}</span>` : ''}
            ${item.category_name ? `<div class="text-muted" style="margin-top:4px;font-size:12px;">${escapeHtml(item.category_name)}</div>` : ''}
            ${item.hint ? `<div class="text-muted" style="margin-top:4px;font-size:12px;">${escapeHtml(item.hint)}</div>` : ''}
        `;
    }

    function renderPurchases(items) {
        if (!items.length) {
            list.innerHTML = '<p>Chưa có giao dịch mua nào.</p>';
            return;
        }

        list.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Loại</th>
                        <th>Nội dung</th>
                        <th>Giá</th>
                        <th>Ngày mua</th>
                        <th>Hành động</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>
                                <span class="badge ${item.purchase_type === 'mxh_account' ? 'badge-success' : 'badge-primary'}">
                                    ${escapeHtml(item.purchase_type_label || (item.purchase_type === 'mxh_account' ? 'Tài khoản MXH' : 'Mã nguồn'))}
                                </span>
                            </td>
                            <td>${renderTitle(item)}</td>
                            <td>${formatMoney(item.price_paid)}</td>
                            <td>${formatDateShort(item.created_at)}</td>
                            <td>${renderActionButton(item)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        list.querySelectorAll('a[data-link]').forEach(a => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href') || '';
                if (!href) return;
                e.preventDefault();
                window.router?.navigate(href);
            });
        });
    }
};
