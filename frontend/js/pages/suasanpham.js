// ============================================
// EDIT PRODUCT PAGE
// File: frontend/js/pages/suasanpham.js
// ============================================

window.pageInit = async function(params) {
    const productId = params.id;
    const form = document.getElementById('edit-product-form');
    const mainImageInput = document.getElementById('edit-main-image');
    const demoMediaInput = document.getElementById('edit-demo-media');
    const previewContainer = document.getElementById('edit-upload-previews');
    const mainLabel = document.getElementById('edit-main-image-label');
    const demoLabel = document.getElementById('edit-demo-media-label');

    let mainImage = null;
    let demoImages = [];
    let hasExistingMainImage = false;
    let nextAttachmentId = 0;

    await loadCategories();
    await loadProduct();
    initFilePickers();
    syncMainLabel();
    syncDemoLabel();

    bindClipboardImagePaste(form, handleClipboardImages, {
        onError: (error) => {
            showToast(error?.message || 'Không thể upload ảnh từ clipboard', 'error');
        }
    });

    mainImageInput.addEventListener('change', () => {
        const nextFile = mainImageInput.files && mainImageInput.files[0] ? mainImageInput.files[0] : null;
        replaceMainImage(nextFile ? createAttachment(nextFile, { source: 'local', status: 'ready' }) : null);
        syncMainLabel();
        renderPreviews();
    });

    demoMediaInput.addEventListener('change', () => {
        replaceLocalDemoImages(Array.from(demoMediaInput.files || []));
        syncDemoLabel();
        renderPreviews();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            title: form.title.value.trim(),
            price: parseFloat(form.price.value),
            description: form.description.value.trim(),
            content: form.content.value.trim(),
            category_id: parseInt(form.category_id.value, 10),
            download_url: form.download_url.value.trim(),
            demo_url: form.demo_url.value.trim() || null,
            video_url: form.video_url.value.trim() || null
        };

        if (!payload.title || Number.isNaN(payload.price)) {
            showToast('Vui lòng nhập đầy đủ thông tin', 'error');
            return;
        }

        if (hasPendingUploads()) {
            showToast('Anh tu clipboard dang upload, vui long doi', 'warning');
            return;
        }

        try {
            if (mainImage) {
                if (mainImage.source === 'uploaded' && mainImage.url) {
                    payload.main_image = mainImage.url;
                } else if (!mainImage.file?.type?.startsWith('image/')) {
                    showToast('Anh dai dien phai la file anh', 'error');
                    return;
                } else {
                    const mainCard = previewContainer.querySelector(`[data-kind="main"][data-id="${mainImage.id}"]`);
                    const mainProgress = mainCard ? mainCard.querySelector('.upload-progress-bar') : null;
                    const mainText = mainCard ? mainCard.querySelector('.upload-progress-text') : null;

                    const fd = new FormData();
                    fd.append('file', mainImage.file);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (mainProgress) mainProgress.style.width = `${percent}%`;
                        if (mainText) mainText.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        payload.main_image = upload.data.url;
                    }
                }
            }

            if (demoImages.length) {
                const gallery = demoImages
                    .filter(item => item.source === 'uploaded' && item.url)
                    .map(item => item.url);

                for (let i = 0; i < demoImages.length; i++) {
                    const item = demoImages[i];
                    if (item.source === 'uploaded') {
                        continue;
                    }

                    if (!item.file?.type?.startsWith('image/')) {
                        showToast('Anh demo phai la file anh', 'error');
                        return;
                    }

                    const card = previewContainer.querySelector(`[data-kind="demo"][data-id="${item.id}"]`);
                    const bar = card ? card.querySelector('.upload-progress-bar') : null;
                    const text = card ? card.querySelector('.upload-progress-text') : null;

                    const fd = new FormData();
                    fd.append('file', item.file);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        gallery.push(upload.data.url);
                    }
                }

                if (gallery.length) {
                    payload.gallery = gallery;
                }
            }

            const res = await api.put(`/products/${productId}`, payload);
            if (res.success) {
                showToast('Đã cập nhật sản phẩm', 'success');
                clearMainImage();
                clearDemoImages();
                syncMainLabel();
                syncDemoLabel();
                renderPreviews();
                router.navigate(`/page2/${res.data.slug || res.data.id}`);
            }
        } catch (error) {
            showToast(error.message || 'Không thể cập nhật sản phẩm', 'error');
        }
    });

    async function handleClipboardImages(images) {
        if (!images.length) {
            return;
        }

        const uploadQueue = [];
        const hadExistingOrSelectedMain = Boolean(mainImage || hasExistingMainImage);
        const originalCount = images.length;
        let assignedMainFromClipboard = false;

        if (!mainImage && !hasExistingMainImage) {
            const mainAttachment = createAttachment(images[0], { source: 'uploaded', status: 'uploading' });
            replaceMainImage(mainAttachment);
            uploadQueue.push(mainAttachment);
            images = images.slice(1);
            assignedMainFromClipboard = true;
        }

        const demoAttachments = images.map(file => createAttachment(file, { source: 'uploaded', status: 'uploading' }));
        if (demoAttachments.length) {
            demoImages = [...demoImages, ...demoAttachments];
            uploadQueue.push(...demoAttachments);
        }

        syncMainLabel();
        syncDemoLabel();
        renderPreviews();

        let successCount = 0;
        let firstErrorMessage = '';

        for (const attachment of uploadQueue) {
            try {
                const didUpload = await uploadClipboardAttachment(attachment);
                if (didUpload) {
                    successCount += 1;
                }
            } catch (error) {
                firstErrorMessage = firstErrorMessage || error.message || 'Không thể upload ảnh từ clipboard';
                removeAttachment(attachment);
            }
        }

        syncMainLabel();
        syncDemoLabel();
        renderPreviews();

        if (successCount > 0) {
            if (assignedMainFromClipboard && originalCount > 1 && successCount === originalCount) {
                showToast('Anh dau tien duoc gan lam anh dai dien, cac anh con lai vao demo', 'success');
            } else if (assignedMainFromClipboard && !hadExistingOrSelectedMain) {
                showToast('Đã thêm ảnh đại diện từ clipboard', 'success');
            } else {
                showToast(
                    successCount > 1 ? `Đã thêm ${successCount} ảnh từ clipboard` : 'Đã thêm ảnh từ clipboard',
                    'success'
                );
            }
        }

        if (firstErrorMessage) {
            throw new Error(firstErrorMessage);
        }
    }

    async function uploadClipboardAttachment(attachment) {
        const fd = new FormData();
        fd.append('file', attachment.file);

        let upload;
        try {
            upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                if (!hasAttachment(attachment)) {
                    return;
                }

                attachment.progress = percent;
                renderPreviews();
            });
        } catch (error) {
            if (!hasAttachment(attachment)) {
                return false;
            }
            throw error;
        }

        if (!upload.success) {
            throw new Error('Không thể upload ảnh từ clipboard');
        }

        if (!hasAttachment(attachment)) {
            return false;
        }

        attachment.progress = 100;
        attachment.status = 'uploaded';
        attachment.url = upload.data.url;
        renderPreviews();
        return true;
    }

    function createAttachment(file, { source = 'local', status = 'ready' } = {}) {
        return {
            id: `edit-product-attachment-${Date.now()}-${++nextAttachmentId}`,
            file,
            previewUrl: URL.createObjectURL(file),
            url: '',
            source,
            status,
            progress: status === 'uploaded' ? 100 : 0
        };
    }

    function replaceMainImage(nextAttachment) {
        if (mainImage && mainImage !== nextAttachment) {
            releaseAttachment(mainImage);
        }
        mainImage = nextAttachment;
    }

    function clearMainImage() {
        replaceMainImage(null);
    }

    function replaceLocalDemoImages(files) {
        const preservedUploads = demoImages.filter(item => item.source === 'uploaded');
        demoImages
            .filter(item => item.source !== 'uploaded')
            .forEach(releaseAttachment);

        demoImages = [
            ...preservedUploads,
            ...files.map(file => createAttachment(file, { source: 'local', status: 'ready' }))
        ];
    }

    function clearDemoImages() {
        demoImages.forEach(releaseAttachment);
        demoImages = [];
    }

    function removeDemoImage(id) {
        const target = demoImages.find(item => item.id === id);
        if (target) {
            releaseAttachment(target);
        }
        demoImages = demoImages.filter(item => item.id !== id);
    }

    function removeAttachment(attachment) {
        if (!attachment) {
            return;
        }

        if (mainImage && mainImage.id === attachment.id) {
            clearMainImage();
            return;
        }

        removeDemoImage(attachment.id);
    }

    function hasAttachment(attachment) {
        if (!attachment) {
            return false;
        }

        return (mainImage && mainImage.id === attachment.id)
            || demoImages.some(item => item.id === attachment.id);
    }

    async function loadCategories() {
        const response = await api.get('/categories');
        const select = document.getElementById('edit-category');
        select.innerHTML = (response.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    async function loadProduct() {
        try {
            const response = await api.get(`/products/${productId}`);
            if (response.success) {
                const p = response.data;
                form.title.value = p.title || '';
                form.price.value = p.price || 0;
                form.description.value = p.description || '';
                form.content.value = p.content || '';
                form.download_url.value = p.download_url || '';
                form.demo_url.value = p.demo_url || '';
                form.video_url.value = p.video_url || '';
                hasExistingMainImage = Boolean((p.main_image || '').trim());
                if (p.category_id) {
                    form.category_id.value = p.category_id;
                }
            }
        } catch (error) {
            showToast('Không thể tải sản phẩm', 'error');
        }
    }

    function renderPreviews() {
        if (!previewContainer) return;
        const items = [];

        if (mainImage) {
            items.push(renderPreviewCard(mainImage, 'Anh dai dien', 'main'));
        }

        demoImages.forEach((attachment, idx) => {
            items.push(renderPreviewCard(attachment, `Anh demo ${idx + 1}`, 'demo'));
        });

        previewContainer.innerHTML = items.join('');

        previewContainer.querySelectorAll('.upload-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const kind = btn.dataset.kind;
                const id = btn.dataset.id;
                if (kind === 'main') {
                    clearMainImage();
                    mainImageInput.value = '';
                    syncMainLabel();
                } else if (kind === 'demo') {
                    removeDemoImage(id);
                    demoMediaInput.value = '';
                    syncDemoLabel();
                }
                renderPreviews();
            });
        });
    }

    function renderPreviewCard(attachment, label, kind) {
        const url = attachment.url || attachment.previewUrl;
        const progress = attachment.status === 'uploading' ? attachment.progress : (attachment.source === 'uploaded' ? 100 : 0);
        const progressText = attachment.status === 'uploading'
            ? `${progress}%`
            : (attachment.source === 'uploaded' ? 'Đã upload' : '0%');

        return `
            <div class="upload-preview-item" data-kind="${kind}" data-id="${attachment.id}">
                <img src="${url}" class="upload-preview-img" alt="${label}">
                <button type="button" class="upload-remove" data-kind="${kind}" data-id="${attachment.id}" aria-label="Xóa">x</button>
                <div class="upload-progress">
                    <div class="upload-progress-bar" style="width:${Math.max(0, Math.min(100, progress))}%"></div>
                </div>
                <div class="upload-progress-text">${progressText}</div>
            </div>
        `;
    }

    function syncMainLabel() {
        if (!mainLabel) return;

        if (!mainImage) {
            mainLabel.textContent = 'Chưa chọn file';
            return;
        }

        if (mainImage.source === 'uploaded') {
            mainLabel.textContent = mainImage.status === 'uploading'
                ? 'Đang upload ảnh từ clipboard...'
                : 'Anh tu clipboard';
            return;
        }

        mainLabel.textContent = mainImage.file?.name || 'Chưa chọn file';
    }

    function syncDemoLabel() {
        if (!demoLabel) return;

        const total = demoImages.length;
        if (!total) {
            demoLabel.textContent = 'Chưa chọn file';
            return;
        }

        const clipboardCount = demoImages.filter(item => item.source === 'uploaded').length;
        const localCount = total - clipboardCount;

        if (localCount && clipboardCount) {
            demoLabel.textContent = `${total} anh (${localCount} chon, ${clipboardCount} dan)`;
            return;
        }

        if (clipboardCount) {
            demoLabel.textContent = clipboardCount === 1 ? '1 anh tu clipboard' : `${clipboardCount} anh tu clipboard`;
            return;
        }

        if (localCount > 1) {
            demoLabel.textContent = `Đã chọn ${localCount} file`;
            return;
        }

        demoLabel.textContent = demoImages[0]?.file?.name || 'Chưa chọn file';
    }

    function hasPendingUploads() {
        return (mainImage && mainImage.status === 'uploading')
            || demoImages.some(item => item.status === 'uploading');
    }

    function releaseAttachment(attachment) {
        if (!attachment?.previewUrl || !attachment.previewUrl.startsWith('blob:')) {
            return;
        }

        URL.revokeObjectURL(attachment.previewUrl);
    }
};
