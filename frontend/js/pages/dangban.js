// ============================================
// DANG BAN PAGE
// File: frontend/js/pages/dangban.js
// ============================================

window.pageInit = async function() {
    const form = document.getElementById('product-form');
    const mainImageInput = document.getElementById('main-image');
    const demoMediaInput = document.getElementById('demo-media');
    const previewContainer = document.getElementById('product-upload-previews');
    const mainLabel = document.getElementById('main-image-label');
    const demoLabel = document.getElementById('demo-media-label');

    let mainImage = null;
    let demoImages = [];
    let nextAttachmentId = 0;

    await loadCategories();
    initFilePickers();
    syncMainLabel();
    syncDemoLabel();

    bindClipboardImagePaste(form, handleClipboardImages, {
        onError: (error) => {
            showToast(error?.message || 'Khong the upload anh tu clipboard', 'error');
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

        const title = form.title.value.trim();
        const price = parseFloat(form.price.value);
        const description = form.description.value.trim();
        const category_ids = Array.from(form.category_ids.selectedOptions).map(opt => parseInt(opt.value, 10));
        const download_url = form.download_url.value.trim();
        const demo_url = form.demo_url.value.trim();
        const video_url_input = form.video_url ? form.video_url.value.trim() : '';

        if (!title || !description || !download_url || !category_ids.length || Number.isNaN(price)) {
            showToast('Vui long dien day du thong tin bat buoc', 'error');
            return;
        }

        if (!mainImage && !demoImages.length) {
            showToast('Vui long them it nhat 1 anh san pham', 'error');
            return;
        }

        if (hasPendingUploads()) {
            showToast('Anh tu clipboard dang upload, vui long doi', 'warning');
            return;
        }

        try {
            const orderedAttachments = [
                ...(mainImage ? [{ attachment: mainImage, kind: 'main' }] : []),
                ...demoImages.map(item => ({ attachment: item, kind: 'demo' }))
            ];
            const uploadedImageUrls = [];

            for (const { attachment, kind } of orderedAttachments) {
                if (attachment.source === 'uploaded' && attachment.url) {
                    uploadedImageUrls.push(attachment.url);
                    continue;
                }

                if (!attachment.file?.type?.startsWith('image/')) {
                    showToast('Tat ca anh san pham phai la file anh', 'error');
                    return;
                }

                const card = previewContainer.querySelector(`[data-kind="${kind}"][data-id="${attachment.id}"]`);
                const bar = card ? card.querySelector('.upload-progress-bar') : null;
                const text = card ? card.querySelector('.upload-progress-text') : null;

                const fd = new FormData();
                fd.append('file', attachment.file);
                const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                    if (bar) bar.style.width = `${percent}%`;
                    if (text) text.textContent = `${percent}%`;
                });

                if (!upload.success || !upload.data?.url) {
                    throw new Error('Khong the upload anh san pham');
                }

                uploadedImageUrls.push(upload.data.url);
            }

            if (!uploadedImageUrls.length) {
                throw new Error('Vui long them it nhat 1 anh san pham');
            }

            const payload = {
                title,
                slug: createSlug(title),
                price,
                category_id: category_ids[0],
                category_ids,
                description,
                main_image: uploadedImageUrls[0],
                video_url: video_url_input || null,
                demo_url: demo_url || null,
                download_url
            };

            if (uploadedImageUrls.length > 1) {
                payload.gallery = uploadedImageUrls.slice(1);
            }

            const response = await api.post('/products', payload);
            if (response.success) {
                showToast('Dang san pham thanh cong', 'success');
                form.reset();
                clearMainImage();
                clearDemoImages();
                syncMainLabel();
                syncDemoLabel();
                renderPreviews();
            }
        } catch (error) {
            showToast(error.message || 'Khong the dang san pham', 'error');
        }
    });

    async function handleClipboardImages(images) {
        if (!images.length) {
            return;
        }

        const uploadQueue = [];
        const originalCount = images.length;
        let assignedMainFromClipboard = false;

        if (!mainImage) {
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
                firstErrorMessage = firstErrorMessage || error.message || 'Khong the upload anh tu clipboard';
                removeAttachment(attachment);
            }
        }

        syncMainLabel();
        syncDemoLabel();
        renderPreviews();

        if (successCount > 0) {
            if (assignedMainFromClipboard && originalCount > 1 && successCount === originalCount) {
                showToast('Anh dau tien se duoc dung lam anh bia, cac anh con lai vao danh sach anh', 'success');
            } else {
                showToast(
                    successCount > 1 ? `Da them ${successCount} anh tu clipboard` : 'Da them anh tu clipboard',
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
            throw new Error('Khong the upload anh tu clipboard');
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
            id: `product-attachment-${Date.now()}-${++nextAttachmentId}`,
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
        const select = document.getElementById('category-select');
        select.innerHTML = (response.data || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    function renderPreviews() {
        if (!previewContainer) return;
        const items = [];

        if (mainImage) {
            items.push(renderPreviewCard(mainImage, 'Anh bia', 'main'));
        }

        demoImages.forEach((attachment, idx) => {
            items.push(renderPreviewCard(attachment, `Anh san pham ${idx + 1}`, 'demo'));
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
            : (attachment.source === 'uploaded' ? 'Da upload' : '0%');

        return `
            <div class="upload-preview-item" data-kind="${kind}" data-id="${attachment.id}">
                <img src="${url}" class="upload-preview-img" alt="${label}">
                <button type="button" class="upload-remove" data-kind="${kind}" data-id="${attachment.id}" aria-label="Xoa">x</button>
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
            mainLabel.textContent = 'Khong bat buoc';
            return;
        }

        if (mainImage.source === 'uploaded') {
            mainLabel.textContent = mainImage.status === 'uploading'
                ? 'Dang upload anh tu clipboard...'
                : 'Anh tu clipboard';
            return;
        }

        mainLabel.textContent = mainImage.file?.name || 'Khong bat buoc';
    }

    function syncDemoLabel() {
        if (!demoLabel) return;

        const total = demoImages.length;
        if (!total) {
            demoLabel.textContent = 'Khong bat buoc';
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
            demoLabel.textContent = `Da chon ${localCount} file`;
            return;
        }

        demoLabel.textContent = demoImages[0]?.file?.name || 'Khong bat buoc';
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
