// ============================================
// PRIVACY PAGE CONTROLLER
// File: frontend/js/pages/privacy.js
// ============================================

window.pageInit = async function() {
    try {
        const res = await api.get('/settings', { keys: 'privacy_title,privacy_content' });
        if (res.success && res.data.privacy_content) {
            const titleEl = document.getElementById('legal-title-text');
            const bodyEl = document.getElementById('legal-content-body');
            
            if (titleEl && res.data.privacy_title) {
                titleEl.textContent = res.data.privacy_title;
            }
            if (bodyEl) {
                const lines = res.data.privacy_content.split('\n');
                let htmlContent = '';
                
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    
                    // If the line is short and starts with a section marker, make it a heading
                    if (trimmed.length < 80 && /^\d+\./.test(trimmed)) {
                        let iconClass = 'fa-info-circle';
                        if (trimmed.toLowerCase().includes('thu thập')) iconClass = 'fa-database';
                        else if (trimmed.toLowerCase().includes('sử dụng')) iconClass = 'fa-cog';
                        else if (trimmed.toLowerCase().includes('bảo mật')) iconClass = 'fa-lock';
                        else if (trimmed.toLowerCase().includes('chia sẻ')) iconClass = 'fa-handshake-slash';
                        else if (trimmed.toLowerCase().includes('quyền')) iconClass = 'fa-user-edit';
                        
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
        console.warn('Failed to load dynamic privacy policy:', error);
    }
};
