window.pageInit = async function() {
    const summaryEl = document.getElementById('seller-dashboard-summary');
    const productsEl = document.getElementById('seller-dashboard-products');
    const withdrawsEl = document.getElementById('seller-dashboard-withdraws');
    const txEl = document.getElementById('seller-dashboard-transactions');
    let myChart = null;

    // Dynamic Chart.js Loader
    if (typeof Chart === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.head.appendChild(script);
        });
    }

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
                <div class="income-stat-icon-wrapper">
                    <i class="fa-solid fa-wallet"></i>
                </div>
                <div class="income-stat-info">
                    <span class="income-stat-label">Số dư hiện tại</span>
                    <strong>${formatMoney(data.balance || 0)}</strong>
                </div>
            </div>
            <div class="income-stat-card">
                <div class="income-stat-icon-wrapper text-emerald">
                    <i class="fa-solid fa-shop"></i>
                </div>
                <div class="income-stat-info">
                    <span class="income-stat-label">Doanh thu bán hàng</span>
                    <strong>${formatMoney(summary.sales_income || 0)}</strong>
                </div>
            </div>
            <div class="income-stat-card">
                <div class="income-stat-icon-wrapper text-blue">
                    <i class="fa-solid fa-list-check"></i>
                </div>
                <div class="income-stat-info">
                    <span class="income-stat-label">Tiền nhiệm vụ</span>
                    <strong>${formatMoney(summary.mission_income || 0)}</strong>
                </div>
            </div>
            <div class="income-stat-card">
                <div class="income-stat-icon-wrapper text-orange">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                <div class="income-stat-info">
                    <span class="income-stat-label">Đang chờ rút</span>
                    <strong>${formatMoney(summary.withdrawn_pending || 0)}</strong>
                </div>
            </div>
            <div class="income-stat-card">
                <div class="income-stat-icon-wrapper text-indigo">
                    <i class="fa-solid fa-circle-down"></i>
                </div>
                <div class="income-stat-info">
                    <span class="income-stat-label">Tổng tiền vào</span>
                    <strong>${formatMoney(summary.total_in || 0)}</strong>
                </div>
            </div>
            <div class="income-stat-card mission-card ${mission.completed ? 'is-completed' : 'is-incomplete'}">
                <div class="income-stat-icon-wrapper ${mission.completed ? 'text-success' : 'text-warning'}">
                    <i class="fa-solid ${mission.completed ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
                </div>
                <div class="income-stat-info">
                    <span class="income-stat-label">Nhiệm vụ hôm nay</span>
                    <strong>${mission.completed ? 'Đã hoàn thành' : 'Chưa hoàn thành'}</strong>
                    ${mission.usedAt ? `<small class="mission-time"><i class="fa-regular fa-clock"></i> ${formatDateShort(mission.usedAt)}</small>` : ''}
                </div>
            </div>
        `;

        renderProducts(products);
        renderWithdraws(withdraws);
        renderTransactions(txs);
        initDashboardChart(products, txs);
    } catch (error) {
        console.error('Dashboard loading failed:', error);
        summaryEl.innerHTML = `<div class="income-empty-state"><i class="fa-solid fa-triangle-exclamation empty-icon"></i> Không thể tải dashboard thu nhập. Lỗi: ${escapeHtml(error.message || 'Không rõ nguyên nhân')}</div>`;
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
            productsEl.innerHTML = '<div class="income-empty-state"><i class="fa-solid fa-box-open empty-icon"></i> Bạn chưa có sản phẩm nào.</div>';
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
        const status = String(product.status || 'draft').toLowerCase();
        let statusText = 'Bản nháp';
        let statusClass = 'is-draft';
        if (status === 'active' || status === 'approved') {
            statusText = 'Hoạt động';
            statusClass = 'is-active';
        } else if (status === 'pending') {
            statusText = 'Chờ duyệt';
            statusClass = 'is-pending';
        } else if (status === 'rejected') {
            statusText = 'Từ chối';
            statusClass = 'is-rejected';
        }

        return `
            <article class="income-product-card">
                <div class="income-product-card-head">
                    <div class="income-product-card-title-box">
                        <strong class="income-product-title">${escapeHtml(product.title || '')}</strong>
                        <span class="income-product-subtitle"><i class="fa-solid fa-link"></i> ${escapeHtml(product.slug || `ID ${product.id}`)}</span>
                    </div>
                    <span class="income-status-chip ${statusClass}">${statusText}</span>
                </div>
                <div class="income-product-metrics">
                    <div class="metric-box">
                        <span class="metric-label"><i class="fa-solid fa-cart-shopping"></i> Lượt mua</span>
                        <strong class="metric-val">${Number(product.paid_sales || product.purchase_count || 0)}</strong>
                    </div>
                    <div class="metric-box">
                        <span class="metric-label"><i class="fa-solid fa-eye"></i> Lượt xem</span>
                        <strong class="metric-val">${Number(product.view_count || 0)}</strong>
                    </div>
                    <div class="metric-box highlighted">
                        <span class="metric-label"><i class="fa-solid fa-wallet"></i> Doanh thu</span>
                        <strong class="metric-val">${formatMoney(product.income || 0)}</strong>
                    </div>
                </div>
                <div class="income-product-actions">
                    <button class="btn-outline" data-edit="${product.id}">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa
                    </button>
                    <button class="btn-danger" data-delete="${product.id}">
                        <i class="fa-solid fa-trash-can"></i> Xóa
                    </button>
                </div>
            </article>
        `;
    }

    function renderWithdraws(rows) {
        withdrawsEl.innerHTML = rows.length ? `
            <div class="income-withdraw-list">
                ${rows.map((row) => {
                    const rawStatus = String(row.status || '').toLowerCase();
                    let statusClass = 'is-pending';
                    let statusIcon = '<i class="fa-solid fa-hourglass-half"></i>';
                    if (rawStatus === 'approved') {
                        statusClass = 'is-approved';
                        statusIcon = '<i class="fa-solid fa-circle-check"></i>';
                    } else if (rawStatus === 'rejected') {
                        statusClass = 'is-rejected';
                        statusIcon = '<i class="fa-solid fa-circle-xmark"></i>';
                    }
                    
                    return `
                        <div class="income-withdraw-card">
                            <div class="income-withdraw-top">
                                <div class="income-withdraw-amount-wrapper">
                                    <span class="income-withdraw-amount-label">Thực nhận</span>
                                    <strong class="income-withdraw-amount">${formatMoney(row.net_amount || 0)}</strong>
                                </div>
                                <span class="income-status-chip ${statusClass}">${statusIcon} ${renderWithdrawStatus(row.status)}</span>
                            </div>
                            <div class="income-withdraw-grid">
                                <div class="income-withdraw-grid-item">
                                    <span class="grid-label">Yêu cầu</span>
                                    <strong class="grid-val">${formatMoney(row.amount || 0)}</strong>
                                </div>
                                <div class="income-withdraw-grid-item">
                                    <span class="grid-label">Phí rút</span>
                                    <strong class="grid-val">${formatMoney(row.fee || 0)}</strong>
                                </div>
                                <div class="income-withdraw-grid-item span-2">
                                    <span class="grid-label">Thời gian dự kiến</span>
                                    <strong class="grid-val date-val"><i class="fa-regular fa-clock"></i> ${row.expected_at ? formatDateShort(row.expected_at) : 'Đang chờ xử lý'}</strong>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '<div class="income-empty-state"><i class="fa-solid fa-wallet empty-icon"></i> Chưa có lệnh rút nào.</div>';
    }

    function renderTransactions(rows) {
        txEl.innerHTML = rows.length ? `
            <ul class="inspect-timeline income-timeline">
                ${rows.map((tx) => {
                    const isNegative = Number(tx.amount || 0) < 0;
                    const dotClass = isNegative ? 'is-negative' : 'is-positive';
                    const iconHtml = isNegative 
                        ? '<i class="fa-solid fa-arrow-down-long text-danger"></i>' 
                        : '<i class="fa-solid fa-arrow-up-long text-success"></i>';
                    
                    return `
                        <li class="timeline-item">
                            <div class="inspect-timeline-icon-box ${dotClass}">
                                ${iconHtml}
                            </div>
                            <div class="inspect-timeline-body">
                                <div class="inspect-timeline-top">
                                    <span class="inspect-activity-type ${isNegative ? 'text-danger' : 'text-success'}">${escapeHtml(tx.type || '')}</span>
                                    <span class="inspect-activity-time"><i class="fa-regular fa-clock"></i> ${formatDateShort(tx.created_at)}</span>
                                </div>
                                <div class="inspect-activity-text">${escapeHtml(tx.description || '')}</div>
                                <div class="inspect-amount ${isNegative ? 'minus' : 'plus'}">
                                    ${isNegative ? '' : '+'}${formatMoney(tx.amount || 0)}
                                </div>
                            </div>
                        </li>
                    `;
                }).join('')}
            </ul>
        ` : '<div class="income-empty-state"><i class="fa-solid fa-receipt empty-icon"></i> Chưa có dòng tiền gần đây.</div>';
    }

    function renderWithdrawStatus(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'approved') return 'Đã duyệt';
        if (value === 'rejected') return 'Từ chối';
        return 'Đang xử lý';
    }

    /* --- CHART GENERATION FUNCTIONS --- */
    function initDashboardChart(products, txs) {
        const ctx = document.getElementById('seller-dashboard-chart');
        if (!ctx || typeof Chart === 'undefined') return;

        const tabProductsBtn = document.getElementById('chart-tab-products');
        const tabCashflowBtn = document.getElementById('chart-tab-cashflow');

        if (tabProductsBtn && tabCashflowBtn) {
            // Remove previous event listeners
            const newTabProductsBtn = tabProductsBtn.cloneNode(true);
            const newTabCashflowBtn = tabCashflowBtn.cloneNode(true);
            tabProductsBtn.parentNode.replaceChild(newTabProductsBtn, tabProductsBtn);
            tabCashflowBtn.parentNode.replaceChild(newTabCashflowBtn, tabCashflowBtn);

            newTabProductsBtn.addEventListener('click', () => {
                newTabProductsBtn.classList.add('active');
                newTabCashflowBtn.classList.remove('active');
                renderProductsChart(products);
            });

            newTabCashflowBtn.addEventListener('click', () => {
                newTabCashflowBtn.classList.add('active');
                newTabProductsBtn.classList.remove('active');
                renderCashflowChart(txs);
            });
        }

        renderProductsChart(products);

        // Re-render chart dynamically when dark/light mode theme is toggled
        const themeObserver = new MutationObserver(() => {
            const activeTab = document.querySelector('.btn-chart-tab.active');
            if (activeTab && activeTab.id === 'chart-tab-cashflow') {
                renderCashflowChart(txs);
            } else {
                renderProductsChart(products);
            }
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        // Clean up observer when navigating away from the page
        const cleanupObserver = new MutationObserver((mutations, obs) => {
            const pageEl = document.querySelector('.seller-dashboard-page');
            if (!pageEl) {
                themeObserver.disconnect();
                obs.disconnect();
            }
        });
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            cleanupObserver.observe(mainContent, { childList: true, subtree: true });
        }
    }

    function renderProductsChart(products) {
        const ctx = document.getElementById('seller-dashboard-chart');
        if (!ctx) return;

        if (myChart) {
            myChart.destroy();
        }

        const sortedProducts = [...products]
            .sort((a, b) => Number(b.income || 0) - Number(a.income || 0))
            .slice(0, 7);

        const labels = sortedProducts.map(p => p.title.length > 18 ? p.title.substring(0, 18) + '...' : p.title);
        const dataValues = sortedProducts.map(p => Number(p.income || 0));

        const isDark = document.documentElement.dataset.theme === 'dark';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)';

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['Chưa có sản phẩm'],
                datasets: [{
                    label: 'Doanh thu (đ)',
                    data: dataValues.length ? dataValues : [0],
                    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.65)' : 'rgba(99, 102, 241, 0.8)',
                    borderColor: 'rgba(99, 102, 241, 1)',
                    borderWidth: 1,
                    borderRadius: 8,
                    barPercentage: 0.55
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Doanh thu: ' + formatMoney(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11
                            },
                            callback: function(value) {
                                if (value >= 1000000) return (value / 1000000) + 'M';
                                if (value >= 1000) return (value / 1000) + 'k';
                                return value;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderCashflowChart(txs) {
        const ctx = document.getElementById('seller-dashboard-chart');
        if (!ctx) return;

        if (myChart) {
            myChart.destroy();
        }

        const sortedTxs = [...txs]
            .reverse()
            .slice(-10);

        const labels = sortedTxs.map(t => formatDateShort(t.created_at));
        const dataValues = sortedTxs.map(t => Number(t.amount || 0));

        const isDark = document.documentElement.dataset.theme === 'dark';
        const textColor = isDark ? '#cbd5e1' : '#475569';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)';

        myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Chưa có giao dịch'],
                datasets: [{
                    label: 'Biến động tiền (đ)',
                    data: dataValues.length ? dataValues : [0],
                    borderColor: 'rgba(20, 184, 166, 1)',
                    backgroundColor: isDark ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.06)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointBackgroundColor: 'rgba(20, 184, 166, 1)',
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return (context.raw >= 0 ? '+' : '') + formatMoney(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: "'Plus Jakarta Sans', sans-serif",
                                size: 11
                            },
                            callback: function(value) {
                                if (Math.abs(value) >= 1000000) return (value / 1000000) + 'M';
                                if (Math.abs(value) >= 1000) return (value / 1000) + 'k';
                                return value;
                            }
                        }
                    }
                }
            }
        });
    }
};
