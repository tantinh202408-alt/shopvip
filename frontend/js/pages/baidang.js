// ============================================
// BAI DANG PAGE
// File: frontend/js/pages/baidang.js
// ============================================

window.pageInit = async function() {
    const form = document.getElementById('post-form');
    const list = document.getElementById('post-list');
    const mediaInput = document.getElementById('post-media');
    const previewContainer = document.getElementById('post-upload-previews');
    const mediaLabel = document.getElementById('post-media-label');
    const recaptchaContainer = document.getElementById('post-create-recaptcha');
    const recaptchaStatus = document.getElementById('post-create-recaptcha-status');
    const recaptchaRetryBtn = document.getElementById('post-create-recaptcha-retry');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const currentUser = Auth.getCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    let files = [];
    let pastedUploads = [];
    let nextPastedUploadId = 0;
    let isSubmitting = false;
    let createPostHumanCheck = {
        enabled: false,
        widgetId: null,
        status: 'idle',
        renderError: ''
    };

    await loadPosts();
    initFilePickers();
    await initCreatePostHumanCheck();
    syncMediaLabel();

    bindClipboardImagePaste(form, handleClipboardImages, {
        isEnabled: () => !isSubmitting,
        onError: (error) => {
            showToast(error?.message || 'Không thể upload ảnh từ clipboard', 'error');
        }
    });

    if (recaptchaRetryBtn) {
        recaptchaRetryBtn.addEventListener('click', () => {
            void initCreatePostHumanCheck(true);
        });
    }

    mediaInput.addEventListener('change', () => {
        files = Array.from(mediaInput.files || []);
        syncMediaLabel();
        renderPreviews();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) {
            return;
        }

        const content = form.content.value.trim();
        const mediaUrl = form.media_url ? form.media_url.value.trim() : '';
        const uploadedMedia = pastedUploads.filter(item => item.status === 'uploaded' && item.url);
        if (!content) {
            showToast('Vui lòng nhập nội dung', 'error');
            return;
        }

        if (hasPendingClipboardUploads()) {
            showToast('Ảnh từ clipboard đang upload, vui lòng đợi', 'warning');
            return;
        }

        if (!files.length && !uploadedMedia.length && !mediaUrl) {
            showToast('Vui lòng upload hoặc nhập link ảnh/video', 'error');
            return;
        }

        const recaptchaToken = getCreatePostHumanCheckToken();
        if (recaptchaToken === null) {
            return;
        }

        isSubmitting = true;
        syncCreatePostHumanCheckUi();

        try {
            const media = uploadedMedia.map(item => ({
                media_type: 'image',
                media_url: item.url
            }));

            if (files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (!file.type.startsWith('image/')) {
                        showToast('Chỉ hỗ trợ upload ảnh', 'error');
                        return;
                    }

                    const card = previewContainer.querySelector(`[data-index="${i}"]`);
                    const bar = card ? card.querySelector('.upload-progress-bar') : null;
                    const text = card ? card.querySelector('.upload-progress-text') : null;

                    const fd = new FormData();
                    fd.append('file', file);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        media.push({
                            media_type: 'image',
                            media_url: upload.data.url
                        });
                    }
                }
            }

            if (mediaUrl) {
                if (!/^https?:\/\//i.test(mediaUrl)) {
                    showToast('Link media phải bắt đầu bằng http hoặc https', 'error');
                    return;
                }
                media.push({
                    media_type: guessMediaType(mediaUrl),
                    media_url: mediaUrl
                });
            }

            const response = await api.post('/posts', { content, media, recaptcha_token: recaptchaToken });
            if (response.success) {
                showToast('Đăng bài thành công', 'success');
                form.reset();
                files = [];
                clearPastedUploads();
                syncMediaLabel();
                renderPreviews();
                await loadPosts();
                if (createPostHumanCheck.enabled) {
                    window.RecaptchaManager.reset(createPostHumanCheck.widgetId);
                }
            }
        } catch (error) {
            if (createPostHumanCheck.enabled) {
                window.RecaptchaManager.reset(createPostHumanCheck.widgetId);
            }
            showToast(error.message || 'Không thể đăng bài', 'error');
        } finally {
            isSubmitting = false;
            syncCreatePostHumanCheckUi();
        }
    });

    function guessMediaType(url) {
        const lower = url.toLowerCase();
        if (lower.match(/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/)) return 'video';
        return 'image';
    }

    async function loadPosts() {
        try {
            const response = await api.get('/posts');
            if (response.success) {
                renderPosts(response.data.posts || []);
            }
        } catch (error) {
            list.innerHTML = '<p>Không thể tải bài đăng.</p>';
        }
    }

    function renderPosts(items) {
        if (!items.length) {
            list.innerHTML = '<p>Chưa có bài đăng nào.</p>';
            return;
        }

        list.innerHTML = items.map(post => `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <a href="${getProfileHref(post.user_id)}" class="post-user post-author-link" data-profile-link="${post.user_id}">
                        ${renderAvatarWithFrame({ avatar: post.avatar, gender: post.gender, frame_url: post.frame_url }, 'md', post.full_name)}
                        <div>
                            <strong>${renderDisplayName(post, post.full_name)}</strong>
                            <div class="post-meta">${formatDate(post.created_at)}</div>
                        </div>
                    </a>
                </div>
                <div class="post-content">${formatPlainTextHtml(post.content || '')}</div>
                ${renderMedia(post.media || [])}
                ${post.is_archived ? '<div class="badge badge-info">Bài viết đã lưu trữ</div>' : ''}
                <div class="post-actions">
                    <button class="btn-ghost btn-like ${post.is_liked ? 'active' : ''}" data-like="${post.id}" ${post.is_archived ? 'disabled' : ''}>
                        <i class="fas fa-thumbs-up"></i> Thích (${post.like_count || 0})
                    </button>
                    <button class="btn-ghost" data-toggle-comments="${post.id}" ${post.is_archived ? 'disabled' : ''}>
                        <i class="fas fa-comment"></i> Bình luận (${post.comment_count || 0})
                    </button>
                </div>
                <div class="post-comments" id="comments-${post.id}" style="display:none;">
                    <div class="comment-list"></div>
                    <form class="comment-form" data-comment-form="${post.id}">
                        <input type="text" name="content" placeholder="Viết bình luận..." required ${post.is_archived ? 'disabled' : ''}>
                        <button type="submit" class="btn-primary" ${post.is_archived ? 'disabled' : ''}>Gửi</button>
                    </form>
                </div>
            </div>
        `).join('');

        bindPostActions();
        bindProfileLinks(list);
    }

    function getProfileHref(userId) {
        return userId ? `/trangcanhan/${userId}` : '#';
    }

    function bindProfileLinks(root = document) {
        root.querySelectorAll('a[data-profile-link]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (!href || href === '#') return;
                if (window.router) {
                    window.router.navigate(href);
                    return;
                }
                window.location.href = href;
            });
        });
    }

    function renderMedia(media) {
        if (!media.length) return '';
        return `
            <div class="media-grid">
                ${media.map(m => `
                    <div class="media-item">
                        ${m.media_type === 'video' ? `
                            <video controls src="${m.media_url}"></video>
                        ` : `
                            <img src="${m.media_url}" alt="media">
                        `}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function bindPostActions() {
        list.querySelectorAll('button[data-like]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) {
                    showToast('Bài viết đã lưu trữ, không thể tương tác', 'warning');
                    return;
                }
                const postId = btn.dataset.like;
                try {
                    const res = await api.post(`/posts/${postId}/like`);
                    if (res.success) {
                        await loadPosts();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể like', 'error');
                }
            });
        });

        list.querySelectorAll('button[data-toggle-comments]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) {
                    showToast('Bài viết đã lưu trữ, không thể bình luận', 'warning');
                    return;
                }
                const postId = btn.dataset.toggleComments;
                const box = document.getElementById(`comments-${postId}`);
                if (!box) return;
                if (box.style.display === 'none') {
                    box.style.display = 'block';
                    await loadComments(postId);
                } else {
                    box.style.display = 'none';
                }
            });
        });

        list.querySelectorAll('form[data-comment-form]').forEach(formEl => {
            formEl.addEventListener('submit', async (e) => {
                e.preventDefault();
                const postId = formEl.dataset.commentForm;
                const content = formEl.content.value.trim();
                if (formEl.querySelector('[disabled]')) {
                    showToast('Bài viết đã lưu trữ, không thể bình luận', 'warning');
                    return;
                }
                if (!content) return;
                try {
                    const res = await api.post(`/posts/${postId}/comments`, { content });
                    if (res.success) {
                        formEl.content.value = '';
                        await loadComments(postId);
                        await loadPosts();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể bình luận', 'error');
                }
            });
        });
    }

    async function loadComments(postId) {
        try {
            const res = await api.get(`/posts/${postId}/comments`);
            if (res.success) {
                const box = document.querySelector(`#comments-${postId} .comment-list`);
                if (!box) return;
                const items = res.data || [];
                if (!items.length) {
                    box.innerHTML = '<p>Chưa có bình luận.</p>';
                    return;
                }
                box.innerHTML = items.map(c => `
                    <div class="comment-item">
                        <a href="${getProfileHref(c.user_id)}" class="comment-author-link" data-profile-link="${c.user_id}">
                            ${renderAvatarWithFrame({ avatar: c.avatar, gender: c.gender, frame_url: c.frame_url }, 'sm', c.full_name)}
                        </a>
                        <div class="comment-body">
                            <div class="comment-head">
                                <a href="${getProfileHref(c.user_id)}" class="comment-author-link" data-profile-link="${c.user_id}">
                                    <strong>${renderDisplayName(c, `User #${c.user_id}`)}</strong>
                                </a>
                                ${(isAdmin || Number(currentUser?.id) === Number(c.user_id)) ? `
                                    <button type="button" class="btn-ghost btn-danger comment-delete-btn" data-comment-delete="${c.id}" data-post-id="${postId}">Xóa</button>
                                ` : ''}
                            </div>
                            <div class="comment-text">${escapeHtml(c.content || '')}</div>
                            <div class="comment-meta">${formatDateShort(c.created_at)}</div>
                        </div>
                    </div>
                `).join('');
                bindProfileLinks(box);
                box.querySelectorAll('button[data-comment-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Xóa bình luận này?')) return;
                        try {
                            const targetPostId = btn.dataset.postId;
                            const commentId = btn.dataset.commentDelete;
                            const resp = await api.delete(`/posts/${targetPostId}/comments/${commentId}`);
                            if (resp.success) {
                                showToast('Đã xóa bình luận', 'success');
                                await loadComments(targetPostId);
                                await loadPosts();
                            }
                        } catch (deleteError) {
                            showToast(deleteError.message || 'Không thể xóa bình luận', 'error');
                        }
                    });
                });
            }
        } catch (error) {
            // ignore
        }
    }

    async function handleClipboardImages(images) {
        const uploadItems = images.map(file => ({
            id: `clipboard-${Date.now()}-${++nextPastedUploadId}`,
            file,
            previewUrl: URL.createObjectURL(file),
            url: '',
            progress: 0,
            status: 'uploading'
        }));

        pastedUploads = [...pastedUploads, ...uploadItems];
        syncMediaLabel();
        renderPreviews();

        let successCount = 0;
        let firstErrorMessage = '';

        for (const item of uploadItems) {
            try {
                const didUpload = await uploadClipboardImage(item);
                if (didUpload) {
                    successCount += 1;
                }
            } catch (error) {
                if (!pastedUploads.some(candidate => candidate.id === item.id)) {
                    continue;
                }
                firstErrorMessage = firstErrorMessage || error.message || 'Không thể upload ảnh từ clipboard';
                removePastedUpload(item.id);
            }
        }

        if (successCount > 0) {
            showToast(
                successCount > 1 ? `Đã thêm ${successCount} ảnh từ clipboard` : 'Đã thêm ảnh từ clipboard',
                'success'
            );
        }

        if (firstErrorMessage) {
            throw new Error(firstErrorMessage);
        }
    }

    async function uploadClipboardImage(item) {
        const fd = new FormData();
        fd.append('file', item.file);

        const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
            if (!pastedUploads.some(candidate => candidate.id === item.id)) {
                return;
            }

            item.progress = percent;
            renderPreviews();
        });

        if (!upload.success) {
            throw new Error('Không thể upload ảnh từ clipboard');
        }

        if (!pastedUploads.some(candidate => candidate.id === item.id)) {
            return false;
        }

        item.status = 'uploaded';
        item.progress = 100;
        item.url = upload.data.url;
        renderPreviews();
        return true;
    }

    function renderPreviews() {
        if (!previewContainer) return;
        const localCards = files.map((file, idx) => {
            const url = URL.createObjectURL(file);
            return `
                <div class="upload-preview-item" data-source="local" data-index="${idx}">
                    <img src="${url}" class="upload-preview-img" alt="preview">
                    <button type="button" class="upload-remove" data-source="local" data-index="${idx}" aria-label="Xóa">×</button>
                    <div class="upload-progress">
                        <div class="upload-progress-bar"></div>
                    </div>
                    <div class="upload-progress-text">0%</div>
                </div>
            `;
        });

        const clipboardCards = pastedUploads.map((item) => `
            <div class="upload-preview-item" data-source="clipboard" data-id="${item.id}">
                <img src="${item.url || item.previewUrl}" class="upload-preview-img" alt="clipboard preview">
                <button type="button" class="upload-remove" data-source="clipboard" data-id="${item.id}" aria-label="Xóa">×</button>
                <div class="upload-progress">
                    <div class="upload-progress-bar" style="width:${item.status === 'uploaded' ? 100 : item.progress}%"></div>
                </div>
                <div class="upload-progress-text">${item.status === 'uploading' ? `${item.progress}%` : 'Đã upload'}</div>
            </div>
        `);

        const cards = [...clipboardCards, ...localCards];
        if (!cards.length) {
            previewContainer.innerHTML = '';
            return;
        }

        previewContainer.innerHTML = cards.join('');

        previewContainer.querySelectorAll('.upload-remove[data-source="local"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index, 10);
                files.splice(index, 1);
                mediaInput.value = '';
                syncMediaLabel();
                renderPreviews();
            });
        });

        previewContainer.querySelectorAll('.upload-remove[data-source="clipboard"]').forEach(btn => {
            btn.addEventListener('click', () => {
                removePastedUpload(btn.dataset.id);
                syncMediaLabel();
                renderPreviews();
            });
        });
    }

    function hasPendingClipboardUploads() {
        return pastedUploads.some(item => item.status === 'uploading');
    }

    function syncMediaLabel() {
        if (!mediaLabel) return;

        const clipboardCount = pastedUploads.length;
        const total = files.length + clipboardCount;

        if (!total) {
            mediaLabel.textContent = 'Chưa chọn file';
            return;
        }

        if (files.length && clipboardCount) {
            mediaLabel.textContent = `${total} ảnh (${files.length} chọn, ${clipboardCount} dán)`;
            return;
        }

        if (clipboardCount) {
            mediaLabel.textContent = clipboardCount === 1 ? '1 ảnh từ clipboard' : `${clipboardCount} ảnh từ clipboard`;
            return;
        }

        if (files.length > 1) {
            mediaLabel.textContent = `Đã chọn ${files.length} file`;
            return;
        }

        mediaLabel.textContent = files[0]?.name || 'Chưa chọn file';
    }

    function removePastedUpload(id) {
        const target = pastedUploads.find(item => item.id === id);
        if (target) {
            releasePreviewUrl(target.previewUrl);
        }
        pastedUploads = pastedUploads.filter(item => item.id !== id);
    }

    function clearPastedUploads() {
        pastedUploads.forEach(item => {
            releasePreviewUrl(item.previewUrl);
        });
        pastedUploads = [];
    }

    function releasePreviewUrl(url) {
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }

    function syncCreatePostHumanCheckUi() {
        if (recaptchaContainer) {
            if (createPostHumanCheck.enabled) {
                recaptchaContainer.classList.remove('is-hidden');
            } else {
                recaptchaContainer.classList.add('is-hidden');
                recaptchaContainer.innerHTML = '';
            }
        }

        if (recaptchaStatus) {
            recaptchaStatus.classList.toggle('is-error', createPostHumanCheck.status === 'error');
            if (!createPostHumanCheck.enabled) {
                recaptchaStatus.textContent = '';
            } else if (createPostHumanCheck.status === 'loading') {
                recaptchaStatus.textContent = 'Đang tải xác thực người dùng...';
            } else if (createPostHumanCheck.status === 'ready') {
                recaptchaStatus.textContent = 'Xác nhận "Tôi không phải robot" trước khi đăng bài.';
            } else if (createPostHumanCheck.status === 'error') {
                recaptchaStatus.textContent = createPostHumanCheck.renderError || 'Không thể tải Turnstile. Vui lòng thử lại.';
            } else {
                recaptchaStatus.textContent = '';
            }
        }

        if (recaptchaRetryBtn) {
            recaptchaRetryBtn.hidden = createPostHumanCheck.status !== 'error';
            recaptchaRetryBtn.disabled = createPostHumanCheck.status === 'loading';
        }

        if (submitBtn) {
            submitBtn.disabled = isSubmitting || createPostHumanCheck.status === 'loading' || createPostHumanCheck.status === 'error';
            submitBtn.textContent = isSubmitting ? 'Đang đăng bài...' : 'Đăng bài';
        }
    }

    async function initCreatePostHumanCheck(forceReload = false) {
        if (!recaptchaContainer) {
            return;
        }

        createPostHumanCheck = {
            enabled: true,
            widgetId: null,
            status: 'loading',
            renderError: ''
        };
        syncCreatePostHumanCheckUi();

        try {
            const nextState = await window.RecaptchaManager.render(recaptchaContainer, { forceReload });
            if (!nextState.enabled) {
                createPostHumanCheck = {
                    enabled: true,
                    widgetId: null,
                    status: 'error',
                    renderError: 'Turnstile chưa được cấu hình trên máy chủ.'
                };
            } else {
                createPostHumanCheck = {
                    ...nextState,
                    status: 'ready',
                    renderError: ''
                };
            }
        } catch (error) {
            createPostHumanCheck = {
                enabled: true,
                widgetId: null,
                status: 'error',
                renderError: error.message || 'Không thể tải Turnstile'
            };
            showToast(createPostHumanCheck.renderError, 'error');
        }

        syncCreatePostHumanCheckUi();
    }

    function getCreatePostHumanCheckToken() {
        if (!createPostHumanCheck.enabled) {
            return '';
        }

        if (createPostHumanCheck.status === 'loading') {
            showToast('Turnstile đang tải, vui lòng đợi một chút', 'warning');
            return null;
        }

        if (createPostHumanCheck.status === 'error') {
            showToast(createPostHumanCheck.renderError || 'Không thể tải Turnstile', 'error');
            return null;
        }

        const token = window.RecaptchaManager.getResponse(createPostHumanCheck.widgetId);
        if (!token) {
            showToast('Vui lòng xác nhận "Tôi không phải robot"', 'warning');
            return null;
        }

        return token;
    }
};
