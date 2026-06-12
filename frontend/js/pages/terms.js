// ============================================
// TERMS PAGE CONTROLLER
// File: frontend/js/pages/terms.js
// ============================================

window.pageInit = async function() {
    try {
        const res = await api.get('/settings', { keys: 'tos_title,tos_content' });
        if (res.success && res.data.tos_content) {
            const titleEl = document.getElementById('legal-title-text');
            const bodyEl = document.getElementById('legal-content-body');
            
            if (titleEl && res.data.tos_title) {
                titleEl.textContent = res.data.tos_title;
            }
            if (bodyEl) {
                const lines = res.data.tos_content.split('\n');
                let htmlContent = '';
                
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    
                    // If the line is short and starts with a section marker, make it a heading
                    if (trimmed.length < 80 && /^\d+\./.test(trimmed)) {
                        let iconClass = 'fa-info-circle';
                        if (trimmed.toLowerCase().includes('chấp thuận')) iconClass = 'fa-handshake';
                        else if (trimmed.toLowerCase().includes('tài khoản')) iconClass = 'fa-user-check';
                        else if (trimmed.toLowerCase().includes('người bán') || trimmed.toLowerCase().includes('seller')) iconClass = 'fa-store';
                        else if (trimmed.toLowerCase().includes('người mua') || trimmed.toLowerCase().includes('buyer')) iconClass = 'fa-shopping-cart';
                        else if (trimmed.toLowerCase().includes('nạp') || trimmed.toLowerCase().includes('rút')) iconClass = 'fa-credit-card';
                        else if (trimmed.toLowerCase().includes('vi phạm') || trimmed.toLowerCase().includes('khóa')) iconClass = 'fa-ban';
                        
                        htmlContent += `
                            <div class="legal-section" style="margin-top: 25px;">
                                <h2 style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas ${iconClass}" style="color: #0ea5e9; font-size: 16px;"></i>
                                    ${trimmed}
                                </h2>
                            </div>
                        `;
                    } else {
                        // Regular paragraph
                        htmlContent += `
                            <p style="color: var(--text-secondary); line-height: 1.7; margin-bottom: 14px; text-align: justify;">
                                ${trimmed}
                            </p>
                        `;
                    }
                });
                
                if (htmlContent) {
                    bodyEl.innerHTML = htmlContent;
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load dynamic terms of service:', error);
    }
};
