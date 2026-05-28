// ============================================
// BAN MXH PAGE — Đăng bán tài khoản mạng xã hội
// File: frontend/js/pages/banmxh.js
// ============================================

window.pageInit = async function () {
    // ── Platform definitions ──────────────────────────────────────────────
    // ── Platform definitions (Dynamic from categories) ─────────────────────
    const PLATFORM_META = {
        'facebook':  { label: 'Facebook',   icon: 'fab fa-facebook',     color: '#1877f2' },
        'tiktok':    { label: 'TikTok',     icon: 'fab fa-tiktok',       color: '#010101' },
        'instagram': { label: 'Instagram',  icon: 'fab fa-instagram',    color: '#e1306c' },
        'youtube':   { label: 'YouTube',    icon: 'fab fa-youtube',      color: '#ff0000' },
        'twitter':   { label: 'X / Twitter',icon: 'fab fa-x-twitter',    color: '#000000' },
        'zalo':      { label: 'Zalo',       icon: 'fas fa-comment-dots', color: '#0068ff' },
        'telegram':  { label: 'Telegram',   icon: 'fab fa-telegram',     color: '#26a5e4' },
        'other':     { label: 'Khác',       icon: 'fas fa-ellipsis',     color: '#64748b' }
    };
    let dynamicPlatforms = [];
    const DEFAULT_CATEGORIES = [
        { id: 'fb-via-co', name: 'FB Via Cổ', platform: 'facebook', slug: 'fb-via-co', icon: 'fab fa-facebook', color: '#1877f2' },
        { id: 'fb-clone', name: 'FB Clone', platform: 'facebook', slug: 'fb-clone', icon: 'fab fa-facebook', color: '#1877f2' },
        { id: 'fb-checkpoint', name: 'FB Checkpoint', platform: 'facebook', slug: 'fb-checkpoint', icon: 'fab fa-facebook', color: '#1877f2' },
        { id: 'tiktok-clone', name: 'TikTok Clone', platform: 'tiktok', slug: 'tiktok-clone', icon: 'fab fa-tiktok', color: '#010101' },
        { id: 'tiktok-via', name: 'TikTok Via', platform: 'tiktok', slug: 'tiktok-via', icon: 'fab fa-tiktok', color: '#010101' },
        { id: 'tiktok-verify', name: 'TikTok Verify', platform: 'tiktok', slug: 'tiktok-verify', icon: 'fab fa-tiktok', color: '#010101' },
        { id: 'ig-via', name: 'IG Via', platform: 'instagram', slug: 'ig-via', icon: 'fab fa-instagram', color: '#e1306c' },
        { id: 'ig-clone', name: 'IG Clone', platform: 'instagram', slug: 'ig-clone', icon: 'fab fa-instagram', color: '#e1306c' },
        { id: 'ig-checkpoint', name: 'IG Checkpoint', platform: 'instagram', slug: 'ig-checkpoint', icon: 'fab fa-instagram', color: '#e1306c' }
    ];

    // ── State ─────────────────────────────────────────────────────────────
    let currentStep = 1;
    let selectedPlatform = null;
    let allCategories = [];
    let uploadedImages = [];  // { file, previewUrl, url, status, progress }
    let nextImgId = 0;

    // ── Elements ──────────────────────────────────────────────────────────
    const form         = document.getElementById('mxh-form');
    const imageInput   = document.getElementById('mxh-image-input');
    const imgPreviews  = document.getElementById('mxh-image-previews');
    const uploadDrop   = document.getElementById('mxh-upload-drop');
    const togglePwBtn  = document.getElementById('mxh-toggle-pw');
    const pwField      = document.getElementById('mxh-account-password');
    const platformSelect = document.getElementById('mxh-platform-select');

    // ── Init ─────────────────────────────────────────────────────────────
    // renderPlatformGrid will be called after loading categories
    await loadMxhCategories();
    initDragDrop();
    initClipboardPaste();
    bindStepNavigation();
    bindPasswordToggle();

    imageInput.addEventListener('change', () => {
        const files = Array.from(imageInput.files || []);
        files.forEach(f => addImage(f));
        imageInput.value = '';
        renderImagePreviews();
    });

    form.addEventListener('submit', handleSubmit);

    // ── Platform Grid ─────────────────────────────────────────────────────
    function renderPlatformGrid() {
        const grid = document.getElementById('mxh-platform-grid');
        if (!grid) return;
        grid.innerHTML = dynamicPlatforms.map(p => `
            <button type="button"
                class="mxh-platform-card"
                data-platform="${p.id}"
                style="--pcolor:${p.color}"
            >
                <i class="${p.icon}" style="color:${p.color}"></i>
                <span>${p.label}</span>
            </button>
        `).join('');

        grid.querySelectorAll('.mxh-platform-card').forEach(btn => {
            btn.addEventListener('click', () => {
                setSelectedPlatform(btn.dataset.platform, { fromCard: true });
            });
        });
    }

    // ── Categories ────────────────────────────────────────────────────────
    function getFallbackCategories() {
        return DEFAULT_CATEGORIES.map(cat => ({ ...cat }));
    }

    function normalizeCategoryKey(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function mergeCategories(primaryCategories, fallbackCategories) {
        const merged = [];
        const seen = new Set();
        const fallbackBySlug = new Map();
        const fallbackByName = new Map();

        fallbackCategories.forEach(cat => {
            const slugKey = normalizeCategoryKey(cat.slug || cat.id);
            const nameKey = normalizeCategoryKey(cat.name);
            if (slugKey) fallbackBySlug.set(slugKey, cat);
            if (nameKey) fallbackByName.set(nameKey, cat);
        });

        primaryCategories.forEach(cat => {
            const slugKey = normalizeCategoryKey(cat.slug || cat.id);
            const nameKey = normalizeCategoryKey(cat.name);
            const fallback = fallbackBySlug.get(slugKey) || fallbackByName.get(nameKey) || {};
            const item = { ...fallback, ...cat };
            const dedupeKey = slugKey || nameKey;
            if (dedupeKey) seen.add(dedupeKey);
            merged.push(item);
        });

        fallbackCategories.forEach(cat => {
            const slugKey = normalizeCategoryKey(cat.slug || cat.id);
            const nameKey = normalizeCategoryKey(cat.name);
            const dedupeKey = slugKey || nameKey;
            if (dedupeKey && seen.has(dedupeKey)) return;
            merged.push({ ...cat });
        });

        return merged;
    }

    function renderPlatformSelect() {
        if (!platformSelect) return;
        platformSelect.innerHTML = `
            <option value="">-- Chọn nền tảng --</option>
            ${dynamicPlatforms.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`).join('')}
        `;

        if (!selectedPlatform && dynamicPlatforms.length) {
            selectedPlatform = dynamicPlatforms[0].id;
        }
        platformSelect.value = selectedPlatform || '';
    }

    function setSelectedPlatform(platformKey, options = {}) {
        selectedPlatform = platformKey || null;

        if (platformSelect && platformSelect.value !== (selectedPlatform || '')) {
            platformSelect.value = selectedPlatform || '';
        }

        const grid = document.getElementById('mxh-platform-grid');
        if (grid) {
            grid.querySelectorAll('.mxh-platform-card').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.platform === selectedPlatform);
            });
        }

        const infoBox = document.getElementById('selected-platform-info');
        const pMeta = PLATFORM_META[selectedPlatform];
        if (infoBox) {
            if (selectedPlatform) {
                infoBox.style.display = 'flex';
                infoBox.innerHTML = `
                    <div class="selected-p-badge" style="background:${pMeta?.color || '#6366f1'}15; color:${pMeta?.color || '#6366f1'}">
                        <i class="${pMeta?.icon || 'fas fa-share-nodes'}"></i> Đang đăng bán cho: <strong>${pMeta?.label || selectedPlatform}</strong>
                    </div>
                `;
            } else {
                infoBox.style.display = 'none';
                infoBox.innerHTML = '';
            }
        }

        filterMxhCategories(selectedPlatform);

        if (options.fromSelect && grid) {
            const activeCard = grid.querySelector(`.mxh-platform-card[data-platform="${selectedPlatform}"]`);
            activeCard?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }

    function buildDynamicPlatforms(categories) {
        const platformKeys = new Set(DEFAULT_CATEGORIES.map(cat => cat.platform || 'other'));
        categories.forEach(cat => {
            platformKeys.add(cat.platform || 'other');
        });

        return [...platformKeys].map(pKey => ({
            id: pKey,
            label: PLATFORM_META[pKey]?.label || (pKey.charAt(0).toUpperCase() + pKey.slice(1)),
            icon: PLATFORM_META[pKey]?.icon || 'fas fa-share-nodes',
            color: PLATFORM_META[pKey]?.color || '#6366f1'
        }));
    }

    async function loadMxhCategories() {
        try {
            const res = await api.get('/mxh/categories');
            const apiCategories = res.success && Array.isArray(res.data) ? res.data : [];
            allCategories = mergeCategories(apiCategories, getFallbackCategories())
                .filter(cat => ['facebook', 'tiktok', 'instagram'].includes(cat.platform || ''));
            dynamicPlatforms = buildDynamicPlatforms(allCategories);
            renderPlatformGrid();
            renderPlatformSelect();
        } catch (e) {
            allCategories = getFallbackCategories().filter(cat => ['facebook', 'tiktok', 'instagram'].includes(cat.platform || ''));
            dynamicPlatforms = buildDynamicPlatforms(allCategories);
            renderPlatformGrid();
            renderPlatformSelect();
        }
        if (selectedPlatform) {
            setSelectedPlatform(selectedPlatform, { fromLoad: true });
        } else {
            renderMxhCategories([], { locked: true });
        }
    }

    function renderMxhCategories(cats, options = {}) {
        const sel = document.getElementById('mxh-category-select');
        if (!sel) return;
        const locked = Boolean(options.locked || !selectedPlatform);
        sel.disabled = locked;
        sel.innerHTML = `<option value="">${locked ? '-- Chọn nền tảng trước --' : '-- Chọn loại tài khoản --'}</option>` +
            cats.map(c => {
                const value = c.id ?? c.slug;
                return `<option value="${escapeHtml(String(value))}">${escapeHtml(c.name)}</option>`;
            }).join('');

        if (!locked && cats.length === 1) {
            sel.value = String(cats[0].id ?? cats[0].slug ?? '');
        }
    }

    function filterMxhCategories(platform) {
        if (!platform) {
            renderMxhCategories([], { locked: true });
            return;
        }
        const filtered = allCategories.filter(c => (c.platform || 'other') === platform);
        renderMxhCategories(filtered, { locked: false });
    }

    // ── Drag & Drop ───────────────────────────────────────────────────────
    function initDragDrop() {
        if (!uploadDrop) return;
        uploadDrop.addEventListener('dragover', e => {
            e.preventDefault();
            uploadDrop.classList.add('dragover');
        });
        uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('dragover'));
        uploadDrop.addEventListener('drop', e => {
            e.preventDefault();
            uploadDrop.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
            files.forEach(f => addImage(f));
            renderImagePreviews();
        });
    }

    // ── Clipboard Paste ───────────────────────────────────────────────────
    function initClipboardPaste() {
        document.addEventListener('paste', e => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItems = items.filter(i => i.type.startsWith('image/'));
            if (!imageItems.length) return;
            imageItems.forEach(item => {
                const file = item.getAsFile();
                if (file) addImage(file);
            });
            renderImagePreviews();
        });
    }

    function addImage(file) {
        const id = `mxh-img-${Date.now()}-${++nextImgId}`;
        const img = {
            id,
            file,
            previewUrl: URL.createObjectURL(file),
            url: '',
            status: 'uploading',
            progress: 0,
            uploadPromise: null
        };
        uploadedImages.push(img);
        renderImagePreviews();
        img.uploadPromise = uploadImageToServer(img);
    }

    async function uploadImageToServer(img) {
        try {
            const fd = new FormData();
            fd.append('file', img.file);

            const upload = await api.uploadWithProgress('/uploads', fd, pct => {
                img.progress = pct;
                img.status = 'uploading';
                renderImagePreviews();
            });

            if (!upload.success || !upload.data?.url) {
                throw new Error(upload.message || 'Không thể upload ảnh');
            }

            const remoteUrl = upload.data.url;
            if (img.previewUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(img.previewUrl);
            }
            img.previewUrl = remoteUrl;
            img.url = remoteUrl;
            img.status = 'done';
            img.progress = 100;
            renderImagePreviews();
        } catch (error) {
            img.status = 'error';
            img.error = error.message || 'Upload ảnh thất bại';
            renderImagePreviews();
            showToast(img.error, 'error');
        }
    }

    function removeImage(id) {
        const img = uploadedImages.find(i => i.id === id);
        if (img?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(img.previewUrl);
        uploadedImages = uploadedImages.filter(i => i.id !== id);
        renderImagePreviews();
    }

    function renderImagePreviews() {
        if (!imgPreviews) return;
        if (!uploadedImages.length) {
            imgPreviews.innerHTML = '';
            return;
        }
        imgPreviews.innerHTML = uploadedImages.map((img, idx) => `
            <div class="mxh-preview-item" data-id="${img.id}">
                <img src="${img.previewUrl || img.url}" alt="Ảnh ${idx + 1}">
                ${idx === 0 ? '<div class="mxh-preview-badge">Ảnh bìa</div>' : ''}
                ${img.status === 'uploading' ? `
                    <div class="mxh-preview-progress">
                        <div class="mxh-preview-bar" style="width:${img.progress}%"></div>
                    </div>
                ` : ''}
                ${img.status === 'done' && img.url ? `
                    <div class="mxh-preview-link">
                        <i class="fas fa-link"></i>
                        <span>Link ảnh</span>
                    </div>
                ` : ''}
                ${img.status === 'error' ? `
                    <div class="mxh-preview-link is-error">
                        <i class="fas fa-triangle-exclamation"></i>
                        <span>Lỗi upload</span>
                    </div>
                ` : ''}
                <button type="button" class="mxh-preview-remove" data-id="${img.id}" aria-label="Xóa ảnh">
                    <i class="fas fa-xmark"></i>
                </button>
            </div>
        `).join('');

        imgPreviews.querySelectorAll('.mxh-preview-remove').forEach(btn => {
            btn.addEventListener('click', () => removeImage(btn.dataset.id));
        });
    }

    // ── Password Toggle ───────────────────────────────────────────────────
    function bindPasswordToggle() {
        if (!togglePwBtn || !pwField) return;
        togglePwBtn.addEventListener('click', () => {
            const isText = pwField.type === 'text';
            pwField.type = isText ? 'password' : 'text';
            togglePwBtn.querySelector('i').className = isText ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }

    // ── Step Navigation ───────────────────────────────────────────────────
    function bindStepNavigation() {
        document.getElementById('mxh-step1-next')?.addEventListener('click', () => goStep(2));
        document.getElementById('mxh-step2-back')?.addEventListener('click', () => goStep(1));
        document.getElementById('mxh-step2-next')?.addEventListener('click', () => goStep(3));
        document.getElementById('mxh-step3-back')?.addEventListener('click', () => goStep(2));
        platformSelect?.addEventListener('change', () => {
            setSelectedPlatform(platformSelect.value, { fromSelect: true });
        });
    }

    function goStep(step) {
        if (step === 2 && !validateStep1()) return;
        if (step === 3 && !validateStep2()) return;
        if (step === 3) renderReview();

        currentStep = step;

        document.querySelectorAll('.mxh-form-step').forEach((el, i) => {
            el.style.display = i + 1 === step ? '' : 'none';
        });

        document.querySelectorAll('.mxh-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.toggle('active', s === step);
            el.classList.toggle('done', s < step);
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ── Validation ────────────────────────────────────────────────────────
    function validateStep1() {
        const title = document.getElementById('mxh-title')?.value.trim();
        const price = parseFloat(document.getElementById('mxh-price')?.value || '0');
        const catId = document.getElementById('mxh-category-select')?.value;
        const desc  = document.getElementById('mxh-description')?.value.trim();

        if (!selectedPlatform) {
            showToast('Vui lòng chọn nền tảng mạng xã hội', 'error'); return false;
        }
        if (!catId) {
            showToast('Vui lòng chọn loại tài khoản', 'error'); return false;
        }
        if (!title || title.length < 5) {
            showToast('Tiêu đề phải có ít nhất 5 ký tự', 'error'); return false;
        }
        if (isNaN(price) || price < 1000) {
            showToast('Giá bán phải ít nhất 1.000đ', 'error'); return false;
        }
        if (!desc || desc.length < 10) {
            showToast('Mô tả phải có ít nhất 10 ký tự', 'error'); return false;
        }
        if (!uploadedImages.length) {
            showToast('Vui lòng thêm ít nhất 1 ảnh cho tài khoản', 'error'); return false;
        }
        return true;
    }

    function validateStep2() {
        const email = document.getElementById('mxh-account-email')?.value.trim();
        const pw    = document.getElementById('mxh-account-password')?.value;

        if (!email) {
            showToast('Vui lòng nhập email/SĐT tài khoản', 'error'); return false;
        }
        if (!pw || pw.length < 3) {
            showToast('Vui lòng nhập mật khẩu tài khoản', 'error'); return false;
        }
        return true;
    }

    // ── Review ────────────────────────────────────────────────────────────
    function renderReview() {
        const container = document.getElementById('mxh-review-content');
        if (!container) return;

        const platform = dynamicPlatforms.find(p => p.id === selectedPlatform) || {
            ...(PLATFORM_META[selectedPlatform] || {}),
            id: selectedPlatform,
            label: PLATFORM_META[selectedPlatform]?.label || selectedPlatform || '',
            icon: PLATFORM_META[selectedPlatform]?.icon || 'fas fa-share-nodes',
            color: PLATFORM_META[selectedPlatform]?.color || '#6366f1'
        };
        const catSel   = document.getElementById('mxh-category-select');
        const catName  = catSel?.options[catSel.selectedIndex]?.text || '';
        const title    = document.getElementById('mxh-title')?.value.trim();
        const price    = document.getElementById('mxh-price')?.value;
        const desc     = document.getElementById('mxh-description')?.value.trim();
        const email    = document.getElementById('mxh-account-email')?.value.trim();
        const hasCookie = !!(document.getElementById('mxh-cookie')?.value.trim());

        container.innerHTML = `
            <div class="mxh-review-grid">
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Nền tảng</div>
                    <div class="mxh-review-val">
                        <i class="${platform?.icon || 'fas fa-globe'}" style="color:${platform?.color};margin-right:6px"></i>
                        ${escapeHtml(platform?.label || selectedPlatform)}
                    </div>
                </div>
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Loại tài khoản</div>
                    <div class="mxh-review-val">${escapeHtml(catName)}</div>
                </div>
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Giá bán</div>
                    <div class="mxh-review-val mxh-review-price">${formatMoney(parseFloat(price || 0))}</div>
                </div>
                <div class="mxh-review-card full">
                    <div class="mxh-review-label">Tiêu đề</div>
                    <div class="mxh-review-val">${escapeHtml(title)}</div>
                </div>
                <div class="mxh-review-card full">
                    <div class="mxh-review-label">Mô tả</div>
                    <div class="mxh-review-val mxh-review-desc">${escapeHtml(desc)}</div>
                </div>
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Email/SĐT</div>
                    <div class="mxh-review-val">${escapeHtml(email)}</div>
                </div>
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Mật khẩu</div>
                    <div class="mxh-review-val">••••••••</div>
                </div>
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Cookie</div>
                    <div class="mxh-review-val">
                        ${hasCookie
                            ? '<span class="badge badge-success"><i class="fas fa-check" style="margin-right:4px"></i>Có</span>'
                            : '<span class="badge badge-info">Không</span>'}
                    </div>
                </div>
                <div class="mxh-review-card">
                    <div class="mxh-review-label">Số ảnh</div>
                    <div class="mxh-review-val">${uploadedImages.length} ảnh</div>
                </div>
            </div>
            <div class="mxh-review-images">
                ${uploadedImages.slice(0, 5).map((img, i) => `
                    <div class="mxh-review-img-wrap ${i === 0 ? 'is-cover' : ''}">
                        <img src="${img.previewUrl || img.url}" alt="Ảnh ${i + 1}">
                        ${i === 0 ? '<div class="mxh-preview-badge">Ảnh bìa</div>' : ''}
                    </div>
                `).join('')}
                ${uploadedImages.length > 5 ? `<div class="mxh-review-more">+${uploadedImages.length - 5}</div>` : ''}
            </div>
        `;
    }

    // ── Submit ────────────────────────────────────────────────────────────
    async function handleSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('mxh-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Đang xử lý...';
        }

        try {
            // 1. Upload images
            const pendingUploads = uploadedImages
                .map(img => img.uploadPromise)
                .filter(Boolean);
            if (pendingUploads.length) {
                await Promise.all(pendingUploads);
            }

            const imageUrls = [];
            for (const img of uploadedImages) {
                if (img.url) { imageUrls.push(img.url); continue; }
                const fd = new FormData();
                fd.append('file', img.file);

                const item = imgPreviews.querySelector(`[data-id="${img.id}"]`);
                const bar  = item?.querySelector('.mxh-preview-bar');

                const upload = await api.uploadWithProgress('/uploads', fd, pct => {
                    img.progress = pct;
                    if (bar) bar.style.width = `${pct}%`;
                });

                if (!upload.success || !upload.data?.url) throw new Error('Không thể upload ảnh');
                img.url = upload.data.url;
                imageUrls.push(img.url);
            }

            // 2. Build payload
            const payload = {
                platform:          selectedPlatform,
                mxh_category_id:   document.getElementById('mxh-category-select')?.value || '',
                title:             document.getElementById('mxh-title')?.value.trim(),
                price:             parseFloat(document.getElementById('mxh-price')?.value || '0'),
                quantity:          parseInt(document.getElementById('mxh-quantity')?.value || '1', 10) || 1,
                description:       document.getElementById('mxh-description')?.value.trim(),
                account_email:     document.getElementById('mxh-account-email')?.value.trim(),
                account_password:  document.getElementById('mxh-account-password')?.value,
                backup_email:      document.getElementById('mxh-backup-email')?.value.trim() || null,
                backup_email_password: document.getElementById('mxh-backup-email-pw')?.value.trim() || null,
                cookie:            document.getElementById('mxh-cookie')?.value.trim() || null,
                extra_info:        document.getElementById('mxh-extra-info')?.value.trim() || null,
                images:            imageUrls,
                main_image:        imageUrls[0] || null,
            };

            // 3. Submit
            const res = await api.post('/mxh/accounts', payload);
            if (!res.success) throw new Error(res.message || 'Không thể đăng tài khoản');

            showToast('Đăng bán tài khoản thành công! 🎉', 'success');

            // Reset
            form.reset();
            uploadedImages = [];
            selectedPlatform = null;
            renderImagePreviews();
            if (platformSelect) platformSelect.value = '';
            document.querySelectorAll('.mxh-platform-card').forEach(btn => btn.classList.remove('active'));
            const platformInfo = document.getElementById('selected-platform-info');
            if (platformInfo) {
                platformInfo.style.display = 'none';
                platformInfo.innerHTML = '';
            }
            renderMxhCategories([], { locked: true });
            goStep(1);

            setTimeout(() => {
                if (window.router) window.router.navigate('/mxh');
            }, 1500);

        } catch (err) {
            showToast(err.message || 'Có lỗi xảy ra', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:6px"></i>Đăng bán ngay';
            }
        }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    window.pageCleanup = () => {
        uploadedImages.forEach(img => {
            if (img.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(img.previewUrl);
        });
    };
};
