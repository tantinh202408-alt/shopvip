// ============================================
// COMMUNITY CHAT + SUPPORT HUB
// File: frontend/js/pages/congdong.js
// ============================================

window.pageInit = async function() {
    const communityList = document.getElementById('community-messages');
    const communityForm = document.getElementById('community-form');
    const fileInput = document.getElementById('community-media');
    const preview = document.getElementById('community-preview');
    const fileLabel = document.getElementById('community-media-label');
    const supportList = document.getElementById('support-messages');
    const supportForm = document.getElementById('support-form');
    const panelTitle = document.getElementById('community-panel-title');
    const panelSubtitle = document.getElementById('community-panel-subtitle');
    const panelTriggers = Array.from(document.querySelectorAll('[data-community-panel-trigger]'));
    const panels = Array.from(document.querySelectorAll('[data-community-panel]'));

    if (!communityList || !communityForm || !fileInput || !preview) return;

    const currentUser = Auth.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';
    const query = new URLSearchParams(window.location.search || '');

    let activePanel = query.get('panel') === 'support' || window.location.pathname === '/hotro'
        ? 'support'
        : 'community';
    let selectedAttachment = null;
    let nextAttachmentId = 0;
    let isLoadingMessages = false;
    let hasLoadedMessages = false;
    let isSubmittingCommunity = false;
    let isLoadingSupport = false;
    let hasLoadedSupport = false;
    let isSubmittingSupport = false;

    const communitySubmitBtn = communityForm.querySelector('button[type="submit"]');
    const supportSubmitBtn = supportForm ? supportForm.querySelector('button[type="submit"]') : null;

    const communityCaptcha = createCaptchaController({
        container: document.getElementById('community-message-recaptcha'),
        status: document.getElementById('community-message-recaptcha-status'),
        retryBtn: document.getElementById('community-message-recaptcha-retry'),
        submitBtn: communitySubmitBtn,
        isSubmitting: () => isSubmittingCommunity
    });

    const supportCaptcha = createCaptchaController({
        container: document.getElementById('support-message-recaptcha'),
        status: document.getElementById('support-message-recaptcha-status'),
        retryBtn: document.getElementById('support-message-recaptcha-retry'),
        submitBtn: supportSubmitBtn,
        isSubmitting: () => isSubmittingSupport
    });

    const panelMeta = {
        community: ['Phòng chat chung', 'Nhắn tin nhanh, hỗ trợ ảnh và video link'],
        support: ['Ho tro & to cao', 'Chat rieng voi admin de nhan ho tro hoac gui to cao']
    };

    await loadMessages();
    if (supportList && supportForm && activePanel === 'support') {
        await loadSupportThread();
    }

    const communityRefresh = setInterval(() => void loadMessages(), 5000);
    const supportRefresh = supportList && supportForm
        ? setInterval(() => void loadSupportThread(), 8000)
        : null;

    window.pageCleanup = () => {
        clearInterval(communityRefresh);
        if (supportRefresh) clearInterval(supportRefresh);
        clearSelectedAttachment();
    };

    initFilePickers();
    syncFileLabel();
    syncPanel();

    bindClipboardImagePaste(communityForm, handleClipboardImages, {
        isEnabled: () => !isSubmittingCommunity,
        onError: (error) => showToast(error?.message || 'Không thể upload ảnh từ clipboard', 'error')
    });

    fileInput.addEventListener('change', () => {
        const nextFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        replaceSelectedAttachment(nextFile ? createAttachment(nextFile, 'local', 'ready') : null);
        syncFileLabel();
        renderPreview();
    });

    const communityInput = communityForm.querySelector('textarea[name="content"], input[name="content"]');
    if (communityInput) {
        communityInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                communityForm.requestSubmit();
            }
        });
    }

    panelTriggers.forEach((trigger) => {
        trigger.addEventListener('click', async () => {
            const nextPanel = trigger.dataset.communityPanelTrigger || 'community';
            if (nextPanel === activePanel) return;
            activePanel = nextPanel;
            syncPanel();
            if (activePanel === 'support' && supportList && supportForm && !hasLoadedSupport) {
                await loadSupportThread();
            }
        });
    });

    communityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmittingCommunity) return;

        const rawContent = communityForm.content.value.trim();
        if (!rawContent && !selectedAttachment) {
            showToast('Vui lòng nhập tin nhắn hoặc chọn ảnh', 'error');
            return;
        }

        const urlMatch = rawContent.match(/https?:\/\/\S+/i);
        // Allow image and video URLs - they will be rendered inline

        const recaptchaToken = communityCaptcha.getToken();
        if (recaptchaToken === null) return;

        isSubmittingCommunity = true;
        communityCaptcha.sync();

        try {
            let content = rawContent;
            let mediaType = null;
            let mediaUrl = null;

            if (selectedAttachment?.status === 'uploading') {
                showToast('Anh tu clipboard dang upload, vui long doi', 'warning');
                return;
            }

            if (selectedAttachment) {
                if (selectedAttachment.source === 'uploaded' && selectedAttachment.url) {
                    mediaType = 'image';
                    mediaUrl = selectedAttachment.url;
                    if (urlMatch) content = content.replace(urlMatch[0], '').trim();
                } else if (!selectedAttachment.file?.type?.startsWith('image/')) {
                    showToast('Chi ho tro upload anh', 'error');
                    return;
                } else {
                    const fd = new FormData();
                    fd.append('file', selectedAttachment.file);

                    const ring = preview.querySelector('.upload-ring-inner');
                    const ringWrap = preview.querySelector('.upload-ring');
                    if (ringWrap) ringWrap.style.display = 'flex';

                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (!ring) return;
                        ring.style.setProperty('--progress', percent / 100);
                        ring.textContent = `${percent}%`;
                    });

                    if (upload.success) {
                        mediaType = 'image';
                        mediaUrl = upload.data.url;
                        if (urlMatch) content = content.replace(urlMatch[0], '').trim();
                    }
                }
            } else if (urlMatch) {
                // Determine media type from URL
                if (isVideoUrl(urlMatch[0])) {
                    mediaType = 'video';
                } else if (isImageUrl(urlMatch[0])) {
                    mediaType = 'image';
                } else {
                    // Not a recognized media URL - keep as plain text, don't extract as media
                    mediaType = null;
                    mediaUrl = null;
                }
                if (mediaType) {
                    mediaUrl = urlMatch[0];
                    content = content.replace(urlMatch[0], '').trim();
                }
            }

            if (!content && !mediaUrl) {
                showToast('Vui lòng nhập tin nhắn hoặc chọn ảnh', 'error');
                return;
            }

            const res = await api.post('/community/messages', {
                content,
                message_type: mediaType || 'text',
                media_url: mediaUrl,
                recaptcha_token: recaptchaToken
            });

            if (res.success) {
                communityForm.reset();
                clearSelectedAttachment();
                syncFileLabel();
                renderPreview();
                await loadMessages();
                communityList.scrollTop = communityList.scrollHeight;
                communityCaptcha.reset();
            }
        } catch (error) {
            if (isHumanCheckRequiredError(error)) {
                communityCaptcha.applyRequirement(error);
                return;
            }
            showToast(error.message || 'Không thể gửi tin nhắn', 'error');
        } finally {
            isSubmittingCommunity = false;
            communityCaptcha.sync();
        }
    });

    if (supportForm && supportList) {
        const supportInput = supportForm.querySelector('input[name="content"], textarea[name="content"]');
        if (supportInput) {
            supportInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    supportForm.requestSubmit();
                }
            });
        }

        supportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmittingSupport) return;

            const content = supportForm.content.value.trim();
            if (!content) {
                showToast('Vui lòng nhập nội dung', 'error');
                return;
            }

            const recaptchaToken = supportCaptcha.getToken();
            if (recaptchaToken === null) return;

            isSubmittingSupport = true;
            supportCaptcha.sync();

            try {
                const response = await api.post('/support/thread', {
                    type: supportForm.type.value,
                    content,
                    recaptcha_token: recaptchaToken
                });

                if (response.success) {
                    supportForm.content.value = '';
                    await loadSupportThread();
                    supportList.scrollTop = supportList.scrollHeight;
                    supportCaptcha.reset();
                }
            } catch (error) {
                if (isHumanCheckRequiredError(error)) {
                    supportCaptcha.applyRequirement(error);
                    return;
                }
                showToast(error.message || 'Không thể gửi tin nhắn', 'error');
            } finally {
                isSubmittingSupport = false;
                supportCaptcha.sync();
            }
        });
    }

    async function handleClipboardImages(images) {
        if (!images.length) return;
        if (images.length > 1) showToast('Moi tin nhan chi ho tro 1 anh, se lay anh dau tien', 'warning');

        fileInput.value = '';
        const attachment = createAttachment(images[0], 'uploaded', 'uploading');
        replaceSelectedAttachment(attachment);
        syncFileLabel();
        renderPreview();

        const didUpload = await uploadClipboardAttachment(attachment);
        if (!didUpload) return;

        syncFileLabel();
        renderPreview();
        showToast('Đã thêm ảnh từ clipboard', 'success');
    }

    async function uploadClipboardAttachment(attachment) {
        const fd = new FormData();
        fd.append('file', attachment.file);

        const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
            if (selectedAttachment !== attachment) return;
            attachment.progress = percent;
            renderPreview();
        });

        if (!upload.success || selectedAttachment !== attachment) return false;
        attachment.progress = 100;
        attachment.status = 'uploaded';
        attachment.url = upload.data.url;
        return true;
    }

    function createAttachment(file, source = 'local', status = 'ready') {
        return {
            id: `community-attachment-${Date.now()}-${++nextAttachmentId}`,
            file,
            source,
            status,
            url: '',
            previewUrl: URL.createObjectURL(file),
            progress: status === 'uploaded' ? 100 : 0
        };
    }

    function replaceSelectedAttachment(nextAttachment) {
        if (selectedAttachment && selectedAttachment !== nextAttachment) releasePreviewUrl(selectedAttachment.previewUrl);
        selectedAttachment = nextAttachment;
    }

    function clearSelectedAttachment() {
        replaceSelectedAttachment(null);
    }

    function syncFileLabel() {
        if (!fileLabel) return;
        if (!selectedAttachment) {
            fileLabel.textContent = 'Chưa chọn file';
            return;
        }
        if (selectedAttachment.source === 'uploaded') {
            fileLabel.textContent = selectedAttachment.status === 'uploading'
                ? 'Đang upload ảnh từ clipboard...'
                : 'Anh tu clipboard';
            return;
        }
        fileLabel.textContent = selectedAttachment.file?.name || 'Chưa chọn file';
    }

    function syncPanel() {
        panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.communityPanel === activePanel));
        panelTriggers.forEach((trigger) => {
            const isActive = trigger.dataset.communityPanelTrigger === activePanel;
            trigger.classList.toggle('is-active', isActive);
            trigger.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
        const [title, subtitle] = panelMeta[activePanel] || panelMeta.community;
        if (panelTitle) panelTitle.textContent = title;
        if (panelSubtitle) panelSubtitle.textContent = subtitle;
    }

    async function loadMessages() {
        if (isLoadingMessages) return;
        isLoadingMessages = true;
        try {
            const response = await api.get('/community/messages', { limit: 50 });
            if (response.success) {
                renderMessages(response.data || []);
                hasLoadedMessages = true;
            }
        } catch (error) {
            if (!hasLoadedMessages) communityList.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        } finally {
            isLoadingMessages = false;
        }
    }

    function renderMessages(items) {
        if (!items.length) {
            communityList.innerHTML = '<p>Chưa có tin nhắn.</p>';
            return;
        }

        communityList.innerHTML = items.map((m) => {
            const isMe = currentUser && Number(m.user_id) === Number(currentUser.id);
            const canDelete = isAdmin || isMe;
            return `
                <div class="community-item ${isMe ? 'me' : ''}">
                    ${renderAvatarWithFrame(m, 'sm', m.full_name || m.email || `User #${m.user_id}`)}
                    <div class="community-bubble">
                        <div class="community-meta">
                            <strong>${renderDisplayName(m, m.email || `User #${m.user_id}`)}</strong>
                            <div class="community-meta-side">
                                <span>${formatDateShort(m.created_at)}</span>
                                ${canDelete ? `<button type="button" class="btn-ghost btn-danger community-delete-btn" data-community-delete="${m.id}">Xóa</button>` : ''}
                            </div>
                        </div>
                        ${m.content ? `<div class="community-text">${formatPlainTextHtml(m.content)}</div>` : ''}
                        ${renderMedia(m)}
                    </div>
                </div>
            `;
        }).join('');

        communityList.querySelectorAll('button[data-community-delete]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm('Xóa tin nhắn cộng đồng này?')) return;
                try {
                    const resp = await api.delete(`/community/messages/${btn.dataset.communityDelete}`);
                    if (resp.success) {
                        showToast('Đã xóa tin nhắn', 'success');
                        await loadMessages();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể xóa tin nhắn', 'error');
                }
            });
        });
        
        communityList.scrollTop = communityList.scrollHeight;
    }

    function renderMedia(message) {
        const mediaUrl = sanitizeHttpUrl(message.media_url, { allowRelative: true });
        if (!mediaUrl) return '';
        const safeUrl = escapeHtml(mediaUrl);
        if (message.message_type === 'image') {
            return `<img src="${safeUrl}" class="community-media" alt="media" loading="lazy">`;
        }
        if (message.message_type === 'video') {
            return `<video controls preload="metadata" class="community-media community-video">
                        <source src="${safeUrl}">
                    </video>`;
        }
        return '';
    }

    function renderPreview() {
        if (!selectedAttachment) {
            preview.innerHTML = '';
            return;
        }

        const previewUrl = selectedAttachment.url || selectedAttachment.previewUrl;
        const isUploading = selectedAttachment.status === 'uploading';
        preview.innerHTML = `
            <div class="upload-preview-item">
                <img src="${previewUrl}" class="upload-preview-img" alt="preview">
                <button type="button" class="upload-remove" aria-label="Xóa">x</button>
                <div class="upload-ring" style="${isUploading ? '' : 'display:none;'}">
                    <div class="upload-ring-inner" style="--progress:${selectedAttachment.progress / 100};">${selectedAttachment.progress}%</div>
                </div>
            </div>
        `;

        const btn = preview.querySelector('.upload-remove');
        if (btn) {
            btn.addEventListener('click', () => {
                clearSelectedAttachment();
                fileInput.value = '';
                syncFileLabel();
                renderPreview();
            });
        }
    }

    async function loadSupportThread() {
        if (!supportList || isLoadingSupport) return;
        isLoadingSupport = true;
        try {
            const response = await api.get('/support/thread');
            if (response.success) {
                renderSupportMessages(response.data || []);
                hasLoadedSupport = true;
            }
        } catch (error) {
            if (!hasLoadedSupport) supportList.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        } finally {
            isLoadingSupport = false;
        }
    }

    function renderSupportMessages(items) {
        if (!supportList) return;
        if (!items.length) {
            supportList.innerHTML = '<p>Chưa có tin nhắn nào.</p>';
            return;
        }

        supportList.innerHTML = items.map((m) => {
            const isMe = currentUser && Number(m.sender_id) === Number(currentUser.id);
            return `
                <div class="chat-bubble ${isMe ? 'me' : 'admin'}">
                    <div class="chat-meta">${isMe ? 'Bạn' : 'Admin'} • ${formatDateShort(m.created_at)}</div>
                    <div class="chat-text">${renderMessageBodyHtml(m)}</div>
                </div>
            `;
        }).join('');
        supportList.scrollTop = supportList.scrollHeight;
    }

    function releasePreviewUrl(url) {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    }

    function isVideoUrl(url) {
        return /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(url || '');
    }

    function isImageUrl(url) {
        return /\.(jpe?g|jpg|png|gif|webp|bmp|svg|avif)(\?.*)?$/i.test(url || '');
    }

    function isHumanCheckRequiredError(error) {
        return error?.code === 'MESSAGE_HUMAN_CHECK_REQUIRED' || Boolean(error?.data?.captchaRequired);
    }

    function createCaptchaController({ container, status, retryBtn, submitBtn, isSubmitting }) {
        const baseState = () => ({
            required: false,
            enabled: false,
            widgetId: null,
            status: 'idle',
            message: '',
            renderError: ''
        });

        let state = baseState();

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                state = { ...state, enabled: false, widgetId: null, status: 'pending', renderError: '' };
                sync();
                void init(true);
            });
        }

        function applyRequirement(error) {
            state = {
                required: true,
                enabled: true,
                widgetId: null,
                status: 'pending',
                message: error?.message || 'Bạn đang gửi tin nhắn quá nhanh. Vui lòng xác nhận reCAPTCHA để tiếp tục.',
                renderError: ''
            };
            sync();
            void init();
        }

        function reset() {
            if (container) {
                container.innerHTML = '';
                container.classList.add('is-hidden');
            }
            if (status) {
                status.textContent = '';
                status.classList.remove('is-error');
            }
            if (retryBtn) {
                retryBtn.hidden = true;
                retryBtn.disabled = false;
            }
            state = baseState();
        }

        function sync() {
            if (container) {
                if (state.required) container.classList.remove('is-hidden');
                else {
                    container.classList.add('is-hidden');
                    container.innerHTML = '';
                }
            }

            if (status) {
                status.classList.toggle('is-error', state.status === 'error');
                if (!state.required) status.textContent = '';
                else if (state.status === 'loading') status.textContent = 'Đang tải xác thực người dùng...';
                else if (state.status === 'ready') status.textContent = state.message || 'Đánh dấu "Tôi không phải robot" rồi gửi lại.';
                else if (state.status === 'error') status.textContent = state.renderError || 'Không thể tải reCAPTCHA. Vui lòng thử lại.';
                else status.textContent = state.message || '';
            }

            if (retryBtn) {
                retryBtn.hidden = state.status !== 'error';
                retryBtn.disabled = state.status === 'loading';
            }

            if (submitBtn) {
                submitBtn.disabled = isSubmitting() || state.status === 'loading' || state.status === 'error';
                submitBtn.textContent = isSubmitting() ? 'Đang gửi...' : 'Gửi';
            }
        }

        async function init(forceReload = false) {
            if (!state.required || !container) return;
            state = { ...state, enabled: false, widgetId: null, status: 'loading', renderError: '' };
            sync();

            try {
                const nextState = await window.RecaptchaManager.render(container, { forceReload });
                if (!nextState.enabled) throw new Error('reCAPTCHA hien chua san sang tren may chu.');
                state = { ...state, ...nextState, status: 'ready', renderError: '' };
            } catch (error) {
                state = {
                    ...state,
                    enabled: false,
                    widgetId: null,
                    status: 'error',
                    renderError: error.message || 'Không thể tải reCAPTCHA'
                };
                showToast(state.renderError, 'error');
            }

            sync();
        }

        function getToken() {
            if (!state.required) return '';
            if (state.status === 'loading') {
                showToast('reCAPTCHA dang tai, vui long doi mot chut', 'warning');
                return null;
            }
            if (state.status === 'error') {
                showToast(state.renderError || 'Không thể tải reCAPTCHA', 'error');
                return null;
            }

            const token = state.enabled ? window.RecaptchaManager.getResponse(state.widgetId) : '';
            if (state.enabled && !token) {
                showToast('Vui lòng xác nhận "Tôi không phải robot"', 'warning');
                return null;
            }
            return token;
        }

        return { applyRequirement, reset, sync, getToken };
    }
};
