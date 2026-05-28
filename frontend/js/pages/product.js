// ============================================
// PRODUCT DETAIL PAGE SCRIPT
// File: frontend/js/pages/product.js
// ============================================

window.pageInit = async function(params, query) {
    const productId = params.id || params.slug;
    const currentUser = Auth.getCurrentUser();
    const defaultTitle = document.title;
    const defaultMetaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const defaultOgTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const defaultOgDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const defaultOgImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    const defaultOgUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
    const defaultTwitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
    const defaultTwitterDescription = document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';
    const defaultTwitterImage = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';
    let product = null;
    let reviewsData = {
        reviews: [],
        can_review: false,
        review_reason: null,
        my_review: null,
        avg_rating: 0,
        review_count: 0
    };
    let purchaseRecaptchaState = {
        enabled: false,
        widgetId: null,
        status: 'idle'
    };
    let purchaseGateState = {
        open: false
    };
    let anonymousViewCaptchaState = {
        required: false,
        enabled: false,
        widgetId: null,
        status: 'idle',
        threshold: 10,
        spamThreshold: 10,
        distinctProductCount: 0,
        viewCount: 0,
        reason: '',
        message: '',
        renderError: ''
    };
    window.pageCleanup = () => {
        setMetaTag('title', defaultTitle);
        setMetaTag('description', defaultMetaDescription);
        setMetaTag('og:title', defaultOgTitle);
        setMetaTag('og:description', defaultOgDescription);
        setMetaTag('og:image', defaultOgImage);
        setMetaTag('og:url', defaultOgUrl);
        setMetaTag('twitter:title', defaultTwitterTitle);
        setMetaTag('twitter:description', defaultTwitterDescription);
        setMetaTag('twitter:image', defaultTwitterImage);
    };

    await loadProduct();

    async function loadProduct(options = {}) {
        try {
            showLoading('product-content');

            const headers = {};
            if (options.recaptchaToken) {
                headers['X-Recaptcha-Token'] = options.recaptchaToken;
            }

            const response = await api.request(`/products/${productId}`, {
                method: 'GET',
                headers
            });

            if (response.success) {
                product = response.data;
                updateSeoMeta();
                anonymousViewCaptchaState = {
                    required: false,
                    enabled: false,
                    widgetId: null,
                    status: 'idle',
                    threshold: 10,
                    spamThreshold: 10,
                    distinctProductCount: 0,
                    viewCount: 0,
                    reason: '',
                    message: '',
                    renderError: ''
                };
                await loadReviews();
                renderProduct();
            }

        } catch (error) {
            console.error('Load product error:', error);
            if (error.code === 'ANON_PRODUCT_CAPTCHA_REQUIRED' || error.data?.captchaRequired) {
                anonymousViewCaptchaState = {
                    required: true,
                    enabled: true,
                    widgetId: null,
                    status: 'pending',
                    threshold: Number(error.data?.threshold || 10),
                    spamThreshold: Number(error.data?.spamThreshold || error.data?.threshold || 10),
                    distinctProductCount: Number(error.data?.distinctProductCount || 0),
                    viewCount: Number(error.data?.viewCount || 0),
                    reason: String(error.data?.reason || ''),
                    message: error.message || 'Vui lòng xác nhận reCAPTCHA để tiếp tục xem sản phẩm.',
                    renderError: ''
                };
                renderAnonymousCaptchaGate();
                void initAnonymousViewRecaptcha();
                return;
            }

            if (anonymousViewCaptchaState.required || options.recaptchaToken) {
                anonymousViewCaptchaState = {
                    ...anonymousViewCaptchaState,
                    required: true,
                    enabled: true,
                    widgetId: null,
                    status: 'pending',
                    reason: anonymousViewCaptchaState.reason,
                    message: error.message || anonymousViewCaptchaState.message,
                    renderError: ''
                };
                renderAnonymousCaptchaGate();
                void initAnonymousViewRecaptcha();
                showToast(error.message || 'Không thể xác thực reCAPTCHA', 'error');
                return;
            }

            document.getElementById('product-content').innerHTML = `
                <div class="error-message">
                    <h2>Không tìm thấy sản phẩm</h2>
                    <p>${error.message}</p>
                    <button onclick="router.navigate('/')" class="btn-primary">Về trang chủ</button>
                </div>
            `;
        }
    }

    function renderProduct() {
        const container = document.getElementById('product-content');
        const demoImages = getProductGalleryUrls(product).slice(0, 2);
        purchaseGateState = {
            open: false,
            submitting: false
        };
        purchaseRecaptchaState = {
            enabled: false,
            widgetId: null,
            status: 'idle'
        };

        container.innerHTML = `
            <div class="product-layout">
                <!-- Gallery -->
                <div class="product-gallery">
                    <div class="main-image-container" data-image-frame>
                        <img src="${getProductImageUrl(product)}"
                             onerror="${getProductImageErrorHandler()}"
                             alt="${escapeHtml(product.title)}"
                             class="main-image"
                             id="main-image">
                    </div>
                    <div class="gallery-thumbs" id="gallery-thumbs">
                        <!-- Thumbnails will be inserted here -->
                    </div>
                </div>

                <!-- Info -->
                <div class="product-info-section">
                    <div class="product-header">
                        <h1>${escapeHtml(product.title)}</h1>
                        <div class="product-meta">
                            <span><i class="fas fa-eye"></i> ${product.view_count} lượt xem</span>
                            <span><i class="fas fa-shopping-cart"></i> ${product.purchase_count} lượt mua</span>
                            <span><i class="fas fa-star"></i> ${(Number(product.avg_rating || 0)).toFixed(1)} (${Number(product.review_count || 0)} đánh giá)</span>
                            <span><i class="fas fa-clock"></i> ${formatDateShort(product.created_at)}</span>
                        </div>
                    </div>

                    <div class="product-price-box">
                        ${renderProductDetailPrice(product)}
                        <div class="purchase-section">
                            ${renderPurchaseButtons()}
                        </div>
                    </div>

                    ${renderSellerInfo()}
                </div>
            </div>

            <!-- Tabs -->
            <div class="product-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" data-tab="description">Mô tả</button>
                    <button class="tab-btn" data-tab="video">Video demo</button>
                    <button class="tab-btn" data-tab="reviews">Đánh giá</button>
                </div>
            </div>

            <div class="tab-content">
                <div id="tab-description" class="tab-pane active">
                    <div class="description-content">
                        ${formatPlainTextHtml(product.content || product.description || 'Chưa có mô tả chi tiết')}
                    </div>
                    ${renderAiAssistant()}
                </div>
                <div id="tab-video" class="tab-pane">
                    ${renderVideo()}
                </div>
                <div id="tab-reviews" class="tab-pane">
                    ${renderReviews()}
                </div>
            </div>

            ${renderDemoGallery(demoImages)}
        `;

        bindEvents();
        bindPurchaseGateEvents();
        loadGallery();
        loadDemoGallery(demoImages);
    }

    function renderAnonymousCaptchaGate() {
        const container = document.getElementById('product-content');
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="error-message">
                <h2>Xac thuc truoc khi xem tiep</h2>
                <p>${escapeHtml(anonymousViewCaptchaState.message || 'Khach chua dang nhap da xem qua nhieu san pham lien tiep.')}</p>
                <p>${buildAnonymousCaptchaSummary()}</p>
                <div id="anonymous-product-recaptcha" class="recaptcha-slot is-hidden"></div>
                <p id="anonymous-product-recaptcha-status" class="captcha-gate-status"></p>
                <div style="margin-top:16px; display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                    <button type="button" id="anonymous-product-verify-btn" class="btn-primary">
                        Xac thuc va xem san pham
                    </button>
                    <button type="button" id="anonymous-product-retry-btn" class="btn-outline" hidden>
                        Tai lai xac thuc
                    </button>
                    <button type="button" id="anonymous-product-home-btn" class="btn-outline">
                        Ve trang chu
                    </button>
                </div>
            </div>
        `;

        bindAnonymousCaptchaGateEvents();
        updateAnonymousCaptchaGateState();
    }

    function buildAnonymousCaptchaSummary() {
        if (anonymousViewCaptchaState.reason === 'rapid_views') {
            return `Đã ghi nhận ${anonymousViewCaptchaState.viewCount} lượt mở trang sản phẩm trong thời gian ngắn. Sau ${anonymousViewCaptchaState.spamThreshold} lượt, hệ thống yêu cầu reCAPTCHA.`;
        }

        return `Đã ghi nhận ${anonymousViewCaptchaState.distinctProductCount} sản phẩm khác nhau. Sau ${anonymousViewCaptchaState.threshold} sản phẩm, hệ thống yêu cầu reCAPTCHA.`;
    }

    function updateAnonymousCaptchaGateState() {
        const statusEl = document.getElementById('anonymous-product-recaptcha-status');
        const verifyBtn = document.getElementById('anonymous-product-verify-btn');
        const retryBtn = document.getElementById('anonymous-product-retry-btn');

        if (statusEl) {
            statusEl.classList.toggle('is-error', anonymousViewCaptchaState.status === 'error');
            if (anonymousViewCaptchaState.status === 'loading') {
                statusEl.textContent = 'Đang tải hộp xác thực người dùng...';
            } else if (anonymousViewCaptchaState.status === 'ready') {
                statusEl.textContent = anonymousViewCaptchaState.enabled
                    ? 'Đánh dấu "Tôi không phải robot" rồi bấm xác thực.'
                    : '';
            } else if (anonymousViewCaptchaState.status === 'error') {
                statusEl.textContent = anonymousViewCaptchaState.renderError || 'Không thể hiện reCAPTCHA. Vui lòng thử lại.';
            } else {
                statusEl.textContent = '';
            }
        }

        if (verifyBtn) {
            const disabled = anonymousViewCaptchaState.status !== 'ready';
            verifyBtn.disabled = disabled;
            verifyBtn.innerHTML = anonymousViewCaptchaState.status === 'loading'
                ? '<i class="fas fa-spinner fa-spin"></i> Đang xác thực...'
                : 'XÁC THỰC VÀ THÊM SẢN PHẨM';
        }

        if (retryBtn) {
            retryBtn.hidden = anonymousViewCaptchaState.status !== 'error';
            retryBtn.disabled = anonymousViewCaptchaState.status === 'loading';
        }
    }

    function getEffectiveProductPrice(productInput = {}) {
        const effectivePrice = Number(productInput.effective_price);
        if (Number.isFinite(effectivePrice)) {
            return effectivePrice;
        }
        return Number(productInput.price || 0);
    }

    function getOriginalProductPrice(productInput = {}) {
        const originalPrice = Number(productInput.original_price);
        if (Number.isFinite(originalPrice)) {
            return originalPrice;
        }
        return Number(productInput.price || 0);
    }

    function renderProductDetailPrice(productInput = {}) {
        const effectivePrice = getEffectiveProductPrice(productInput);
        const originalPrice = getOriginalProductPrice(productInput);
        const salePercent = Number(productInput.sale_percent || 0);
        const hasSale = salePercent > 0 && effectivePrice < originalPrice;

        if (!hasSale) {
            return `<div class="price">${formatMoney(effectivePrice)}</div>`;
        }

        return `
            <div class="price">${formatMoney(effectivePrice)}</div>
            <div class="price-detail-row">
                <span class="price-old">${formatMoney(originalPrice)}</span>
                <span class="price-sale-badge">-${Math.round(salePercent)}%</span>
            </div>
            ${hasSale && (productInput.sale_title || productInput.sale_note) ? `
                <div class="sale-event-info">
                    ${productInput.sale_title ? `<strong>${escapeHtml(productInput.sale_title)}</strong>` : ''}
                    ${productInput.sale_note ? `<p>${escapeHtml(productInput.sale_note)}</p>` : ''}
                </div>
            ` : ''}
        `;
    }

    function renderPurchaseButtons() {
        const user = Auth.getCurrentUser();
        const canEdit = user && (user.is_primary_admin === true || Number(user.id) === Number(product.seller_id));
        const isFreeProduct = getEffectiveProductPrice(product) <= 0;
        const editBtn = canEdit ? `
            <button class="btn btn-outline" onclick="router.navigate('/suasanpham/${product.id}')">
                <i class="fas fa-pen"></i> Sữa sản phẩm
            </button>
        ` : '';

        if (product.is_archived) {
            return `
                <div class="badge badge-info">Sản phẩm đã lưu trữ</div>
                ${editBtn}
            `;
        }

        if (product.is_purchased) {
            return `
                <button class="btn btn-buy" onclick="downloadProduct()">
                    <i class="fas fa-download"></i> Tải xuống
                </button>
                ${editBtn}
            `;
        }

        return `
            <div class="purchase-actions">
                <button class="btn btn-buy" id="product-purchase-btn" onclick="purchaseProduct()">
                    <i class="fas fa-shopping-cart"></i> Mua ngay
                </button>
                ${product.demo_url ? `
                    <a href="${product.demo_url}" target="_blank" class="btn btn-demo">
                        <i class="fas fa-eye"></i> Xem demo
                    </a>
                ` : ''}
                ${editBtn}
            </div>
            <div id="purchase-verification-panel" class="purchase-verification-panel is-hidden">
                <div class="purchase-verification-head">
                    <div>
                        <strong>Xác thực mua hàng</strong>
                        <p>Khối này chỉ hiện sau khi bạn bấm mua.</p>
                    </div>
                    <button type="button" class="btn-ghost purchase-close-btn" id="purchase-close-btn">
                        Đóng
                    </button>
                </div>
                <div class="purchase-verification-note" id="purchase-verification-note">
                    ${isFreeProduct ? 'Sản phẩm này miễn phí nhưng vẫn cần xác thực trước khi nhận.' : 'Xác thực robot để tiếp tục thanh toán.'}
                </div>
                <div id="purchase-recaptcha" class="recaptcha-slot is-hidden"></div>
                <p id="purchase-recaptcha-status" class="captcha-gate-status"></p>
                <div class="purchase-verification-actions">
                    <button type="button" class="btn-outline" id="purchase-cancel-btn">Hủy</button>
                    <button type="button" class="btn btn-buy" id="purchase-confirm-btn">Xác nhận mua</button>
                </div>
            </div>
        `;
    }

    function renderSellerInfo() {
        return `
            <div class="seller-info">
                ${renderAvatarWithFrame({
                    avatar: product.seller_avatar,
                    gender: product.seller_gender,
                    is_verified: product.seller_is_verified
                }, 'lg', product.seller_name || 'seller')}
                <div class="seller-details">
                    <h3>${renderDisplayName({ full_name: product.seller_name, is_verified: product.seller_is_verified }, product.seller_name)}</h3>
                    <p>${product.seller_email}</p>
                    <a href="/trangcanhan/${product.seller_id}" 
                       data-link 
                       onclick="event.preventDefault(); window.router && window.router.navigate('/trangcanhan/${product.seller_id}')">
                        Xem trang cá nhân
                    </a>
                </div>
            </div>
        `;
    }

    function renderVideo() {
        if (!product.video_url) {
            return '<p>Sản phẩm không có video demo</p>';
        }

        if (isEmbedVideo(product.video_url)) {
            return `
                <div class="video-container">
                    <iframe src="${toEmbedUrl(product.video_url)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                </div>
            `;
        }

        return `
            <div class="video-container">
                <video controls>
                    <source src="${product.video_url}" type="video/mp4">
                    Trình duyệt không hỗ trợ video
                </video>
            </div>
        `;
    }

    function renderReviews() {
        const avgRating = Number(reviewsData.avg_rating || product.avg_rating || 0);
        const reviewCount = Number(reviewsData.review_count || product.review_count || 0);

        return `
            <div class="review-summary-card">
                <div class="review-summary-score">${avgRating.toFixed(1)}</div>
                <div>
                    <div class="review-summary-stars">${renderStarIcons(avgRating)}</div>
                    <div class="review-summary-count">${reviewCount} đánh giá</div>
                </div>
            </div>
            ${renderReviewForm()}
            ${renderReviewList()}
        `;
    }

    function renderReviewForm() {
        const myReview = reviewsData.my_review || product.my_review || null;
        const initialRating = Number(myReview?.rating || 5);
        const initialComment = escapeHtml(myReview?.comment || '');

        if (!Auth.isAuthenticated()) {
            return `
                <div class="review-form-card">
                    <p>Vui lòng <a href="/login" data-link onclick="event.preventDefault(); router.navigate('/login?redirect=' + window.location.pathname)">đăng nhập</a> để gửi đánh giá.</p>
                </div>
            `;
        }

        if (!reviewsData.can_review) {
            return `
                <div class="review-form-card">
                    <p>${escapeHtml(reviewsData.review_reason || 'Bạn chưa thể đánh giá sản phẩm này')}</p>
                </div>
            `;
        }

        return `
            <form id="review-form" class="review-form-card">
                <h3>${myReview ? 'Cập nhật đánh giá của bạn' : 'Viết đánh giá của bạn'}</h3>
                <div class="rating-stars-select" id="rating-stars">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <button type="button" class="rating-star-btn ${star <= initialRating ? 'active' : ''}" data-rating-value="${star}" aria-label="${star} sao">
                            <i class="fas fa-star"></i>
                        </button>
                    `).join('')}
                </div>
                <input type="hidden" id="review-rating-input" value="${initialRating}">
                <textarea id="review-comment-input" rows="4" placeholder="Mô tả trải nghiệm của bạn..." required>${initialComment}</textarea>
                <button type="submit" class="btn btn-buy">${myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button>
            </form>
        `;
    }

    function renderReviewList() {
        const items = Array.isArray(reviewsData.reviews) ? reviewsData.reviews : [];
        if (!items.length) {
            return `
                <div class="review-list">
                    <p class="review-empty">Chưa có đánh giá nào.</p>
                </div>
            `;
        }

        return `
            <div class="review-list">
                ${items.map(item => `
                    <article class="review-item">
                        <div class="review-item-head">
                            <div class="review-item-user">
                                ${renderAvatarWithFrame(item, 'sm', item.full_name)}
                                <strong>${renderDisplayName(item, `User #${item.user_id}`)}</strong>
                            </div>
                            <div class="review-item-side">
                                <span class="review-item-date">${formatDateShort(item.updated_at || item.created_at)}</span>
                                ${(currentUser && (currentUser.role === 'admin' || Number(currentUser.id) === Number(item.user_id) || Number(currentUser.id) === Number(product?.seller_id))) ? `
                                    <button type="button" class="btn-ghost btn-danger review-delete-btn" data-review-delete="${item.id}">Xóa</button>
                                ` : ''}
                            </div>
                        </div>
                        <div class="review-item-stars">${renderStarIcons(item.rating)}</div>
                        <p class="review-item-comment">${escapeHtml(item.comment || '')}</p>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function isEmbedVideo(url) {
        return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
    }

    function toEmbedUrl(url) {
        if (url.includes('youtube.com')) {
            const id = new URL(url).searchParams.get('v');
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('youtu.be')) {
            const id = url.split('/').pop();
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('vimeo.com')) {
            const id = url.split('/').pop();
            return `https://player.vimeo.com/video/${id}`;
        }
        return url;
    }

    function renderAiAssistant() {
        return `
            <div class="ai-assistant-box">
                <div class="ai-assistant-head">
                    <h3>Tro ly AI phẩm</h3>
                    <p>Hoi nhanh ve tinh nang, doi tuong phu hop, cach su dung.</p>
                </div>
                <div class="ai-assistant-form">
                    <textarea id="ai-question" rows="3" placeholder="Ví dụ: Sản phẩm này phù hợp với người mới không?"></textarea>
                    <button class="btn btn-buy" id="ai-ask-btn" type="button">
                        <i class="fas fa-robot"></i> Hoi AI
                    </button>
                </div>
                <div class="ai-assistant-result" id="ai-assistant-result" style="display:none;">
                    <p class="ai-summary" id="ai-summary"></p>
                    <ul class="ai-highlights" id="ai-highlights"></ul>
                    <div class="ai-answer" id="ai-answer"></div>
                    <div class="ai-section" id="ai-links-section" style="display:none;">
                        <div class="ai-section-title">Link tham khảo</div>
                        <div class="ai-links" id="ai-links"></div>
                    </div>
                    <div class="ai-section" id="ai-code-section" style="display:none;">
                        <div class="ai-section-title">Code mẫu / cấu hình</div>
                        <div class="ai-code-samples" id="ai-code-samples"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function loadGallery() {
        const images = getProductGalleryUrls(product);
        bindGalleryImages('main-image', 'gallery-thumbs', images);
    }

    function loadDemoGallery(images = []) {
        bindGalleryImages('demo-main-image', 'demo-gallery-thumbs', images);
    }

    function bindGalleryImages(mainImageId, thumbsContainerId, images = []) {
        const thumbsContainer = document.getElementById(thumbsContainerId);
        const mainImage = document.getElementById(mainImageId);

        if (!thumbsContainer || !mainImage) {
            return;
        }

        syncImageFrameAspectRatio(mainImage);

        if (!images.length) {
            thumbsContainer.innerHTML = '';
            return;
        }

        thumbsContainer.innerHTML = images.map((img, index) => `
            <img src="${img}"
                 onerror="${getProductImageErrorHandler()}"
                 alt="Thumbnail ${index + 1}"
                 class="thumb ${index === 0 ? 'active' : ''}"
                 data-image="${img}">
        `).join('');

        thumbsContainer.querySelectorAll('.thumb').forEach(thumb => {
            syncThumbnailAspectRatio(thumb);
            thumb.addEventListener('click', () => {
                mainImage.src = thumb.dataset.image;
                thumbsContainer.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }

    function syncThumbnailAspectRatio(thumbElement) {
        if (!thumbElement) {
            return;
        }

        const applyRatio = () => {
            const width = Number(thumbElement.naturalWidth || 0);
            const height = Number(thumbElement.naturalHeight || 0);
            if (width > 0 && height > 0) {
                thumbElement.style.aspectRatio = `${width} / ${height}`;
                thumbElement.style.height = 'auto';
            }
        };

        thumbElement.addEventListener('load', applyRatio, { passive: true });
        if (thumbElement.complete) {
            applyRatio();
        }
    }

    function syncImageFrameAspectRatio(imageElement) {
        if (!imageElement) {
            return;
        }

        const frame = imageElement.closest('[data-image-frame]');
        if (!frame) {
            return;
        }

        const applyRatio = () => {
            const width = Number(imageElement.naturalWidth || 0);
            const height = Number(imageElement.naturalHeight || 0);
            if (width > 0 && height > 0) {
                const ratio = width / height;
                frame.style.aspectRatio = `${width} / ${height}`;
                frame.style.height = 'auto';

                if (window.matchMedia('(max-width: 768px)').matches && ratio < 1) {
                    const maxHeight = frame.classList.contains('product-demo-main-image-wrap')
                        ? 420
                        : 420;
                    const parentWidth = frame.parentElement ? frame.parentElement.clientWidth : window.innerWidth;
                    const clampedWidth = Math.max(220, Math.min(parentWidth, Math.round(maxHeight * ratio)));
                    frame.style.width = `${clampedWidth}px`;
                    frame.style.marginInline = 'auto';
                } else {
                    frame.style.width = '100%';
                    frame.style.marginInline = '';
                }
            }
        };

        imageElement.addEventListener('load', applyRatio, { passive: true });
        if (imageElement.complete) {
            applyRatio();
        }
    }

    function renderDemoGallery(images = []) {
        if (!images.length) {
            return '';
        }

        const previewImages = images.slice(0, 2);
        return `
            <section class="product-demo-gallery">
                <div class="section-header">
                    <div>
                        <h2 class="section-title">Ảnh demo sản phẩm</h2>
                        <p class="section-subtitle">Xem ảnh lớn ở cuối trang để soi rõ giao diện và chi tiết hơn.</p>
                    </div>
                </div>
                <div class="product-demo-layout">
                    <div class="product-demo-main">
                        <div class="product-demo-main-image-wrap" data-image-frame>
                            <img
                                id="demo-main-image"
                                src="${previewImages[0]}"
                                onerror="${getProductImageErrorHandler()}"
                                alt="${escapeHtml(product.title)} demo"
                                class="product-demo-main-image"
                            >
                        </div>
                    </div>
                    <div class="product-demo-sidebar">
                        <div class="product-demo-note">
                            <strong>Xem rõ hơn:</strong>
                            <span>Bấm vào ảnh nhỏ để đổi ảnh lớn bên trái.</span>
                        </div>
                        <div id="demo-gallery-thumbs" class="gallery-thumbs product-demo-thumbs">
                            <!-- Demo thumbnails -->
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });

        bindReviewForm();
        bindReviewActions();
        bindAiAssistant();
    }

    function bindReviewForm() {
        const form = document.getElementById('review-form');
        if (!form) return;

        const ratingInput = document.getElementById('review-rating-input');
        const commentInput = document.getElementById('review-comment-input');

        const refreshStarSelection = (value) => {
            form.querySelectorAll('[data-rating-value]').forEach(btn => {
                const starValue = Number(btn.dataset.ratingValue || 0);
                btn.classList.toggle('active', starValue <= value);
            });
        };

        form.querySelectorAll('[data-rating-value]').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = Number(btn.dataset.ratingValue || 0);
                ratingInput.value = String(value);
                refreshStarSelection(value);
            });
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const rating = Number(ratingInput.value || 0);
            const comment = (commentInput.value || '').trim();

            if (rating < 1 || rating > 5) {
                showToast('Vui lòng chọn số sao từ 1 đến 5', 'warning');
                return;
            }
            if (!comment) {
                showToast('Vui lòng nhập mô tả đánh giá', 'warning');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
            }

            try {
                const response = await api.post(`/products/${productId}/reviews`, { rating, comment });
                if (response.success) {
                    showToast('Đánh giá đã được lưu', 'success');
                    await loadReviews();
                    product.avg_rating = Number(reviewsData.avg_rating || product.avg_rating || 0);
                    product.review_count = Number(reviewsData.review_count || product.review_count || 0);
                    product.my_review = reviewsData.my_review || product.my_review || null;
                    renderProduct();
                    setTimeout(() => {
                        const reviewTabBtn = document.querySelector('[data-tab="reviews"]');
                        if (reviewTabBtn) reviewTabBtn.click();
                    }, 0);
                }
            } catch (error) {
                showToast(error.message || 'Không thể gửi đánh giá', 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = reviewsData.my_review ? 'Cập nhật đánh giá' : 'Gửi đánh giá';
                }
            }
        });
    }

    function bindReviewActions() {
        document.querySelectorAll('button[data-review-delete]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Xóa đánh giá này?')) return;
                try {
                    const response = await api.delete(`/products/${productId}/reviews/${btn.dataset.reviewDelete}`);
                    if (response.success) {
                        showToast('Đã xóa đánh giá', 'success');
                        await loadReviews();
                        product.avg_rating = Number(reviewsData.avg_rating || 0);
                        product.review_count = Number(reviewsData.review_count || 0);
                        product.my_review = reviewsData.my_review || null;
                        renderProduct();
                        setTimeout(() => {
                            const reviewTabBtn = document.querySelector('[data-tab="reviews"]');
                            if (reviewTabBtn) reviewTabBtn.click();
                        }, 0);
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể xóa đánh giá', 'error');
                }
            });
        });
    }

    function bindAiAssistant() {
        const askBtn = document.getElementById('ai-ask-btn');
        const questionInput = document.getElementById('ai-question');
        const resultBox = document.getElementById('ai-assistant-result');
        const summaryEl = document.getElementById('ai-summary');
        const highlightsEl = document.getElementById('ai-highlights');
        const answerEl = document.getElementById('ai-answer');
        const linksSectionEl = document.getElementById('ai-links-section');
        const linksEl = document.getElementById('ai-links');
        const codeSectionEl = document.getElementById('ai-code-section');
        const codeSamplesEl = document.getElementById('ai-code-samples');

        if (!askBtn || !questionInput || !resultBox || !summaryEl || !highlightsEl || !answerEl || !linksSectionEl || !linksEl || !codeSectionEl || !codeSamplesEl) {
            return;
        }

        askBtn.addEventListener('click', async () => {
            const question = questionInput.value.trim();
            askBtn.disabled = true;
            askBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang hỏi...';

            try {
                const response = await api.post(`/products/${productId}/assistant-ai`, { question });
                const data = response.data || {};
                resultBox.style.display = 'block';
                summaryEl.innerHTML = renderAiRichText(data.summary || '');
                answerEl.innerHTML = renderAiRichText(data.answer || '');

                const highlights = Array.isArray(data.highlights) ? data.highlights : [];
                highlightsEl.innerHTML = highlights.map(item => `<li>${renderAiRichText(item)}</li>`).join('');

                const links = Array.isArray(data.links) ? data.links.filter(Boolean) : [];
                linksSectionEl.style.display = links.length ? 'block' : 'none';
                linksEl.innerHTML = links.length
                    ? links.map(item => buildAiLinkHtml(item)).join('')
                    : '';

                const codeExamples = Array.isArray(data.code_examples) ? data.code_examples.filter(Boolean) : [];
                codeSectionEl.style.display = codeExamples.length ? 'block' : 'none';
                codeSamplesEl.innerHTML = codeExamples.length
                    ? codeExamples.map((item, index) => buildAiCodeBlock(item, index + 1)).join('')
                    : '';
            } catch (error) {
                showToast(error.message || 'Không thể sử dụng trợ lý AI lúc này', 'warning');
            } finally {
                askBtn.disabled = false;
                askBtn.innerHTML = '<i class="fas fa-robot"></i> Hoi AI';
            }
        });
    }

    function renderAiRichText(input) {
        const text = (input || '').toString();
        const codeFenceRegex = /```([a-z0-9_-]+)?\n([\s\S]*?)```/gi;
        let html = '';
        let lastIndex = 0;
        let match;

        while ((match = codeFenceRegex.exec(text)) !== null) {
            const before = text.slice(lastIndex, match.index);
            if (before) {
                html += renderAiMarkdown(before);
            }

            const language = (match[1] || '').trim();
            const code = match[2] || '';
            html += buildAiCodeBlock(code, null, language);
            lastIndex = match.index + match[0].length;
        }

        const tail = text.slice(lastIndex);
        if (tail) {
            html += renderAiMarkdown(tail);
        }

        return html || escapeHtml(text).replace(/\n/g, '<br>');
    }

    function renderAiMarkdown(input) {
        const lines = escapeHtml((input || '').toString()).split('\n');
        const html = [];
        let listBuffer = [];

        const flushList = () => {
            if (!listBuffer.length) return;
            html.push(`<ul class="ai-inline-list">${listBuffer.map(item => `<li>${item}</li>`).join('')}</ul>`);
            listBuffer = [];
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
                flushList();
                html.push('<br>');
                continue;
            }

            const listMatch = line.match(/^[-*]\s+(.+)$/);
            if (listMatch) {
                listBuffer.push(renderAiInlineMarkup(listMatch[1]));
                continue;
            }

            flushList();
            html.push(`<div class="ai-text-line">${renderAiInlineMarkup(line)}</div>`);
        }

        flushList();
        return html.join('');
    }

    function renderAiInlineMarkup(text) {
        let output = text;
        const linkPlaceholders = [];
        const codePlaceholders = [];

        output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, label, url) => {
            const token = `[[AI_LINK_${linkPlaceholders.length}]]`;
            linkPlaceholders.push(buildAiLinkHtml(url, label));
            return token;
        });

        output = output.replace(/`([^`]+)`/g, (_, code) => {
            const token = `[[AI_CODE_${codePlaceholders.length}]]`;
            codePlaceholders.push(`<code class="ai-inline-code">${escapeHtml(code)}</code>`);
            return token;
        });

        output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        output = output.replace(/(https?:\/\/[^\s<>"']+)/gi, (_, url) => buildAiLinkHtml(url));

        codePlaceholders.forEach((snippet, index) => {
            output = output.replace(`[[AI_CODE_${index}]]`, snippet);
        });

        linkPlaceholders.forEach((snippet, index) => {
            output = output.replace(`[[AI_LINK_${index}]]`, snippet);
        });

        return output.replace(/\n/g, '<br>');
    }

    function renderStarIcons(rating) {
        const rounded = Math.round(Number(rating || 0));
        return [1, 2, 3, 4, 5].map(index =>
            `<i class="fas fa-star ${index <= rounded ? 'star-filled' : 'star-empty'}"></i>`
        ).join('');
    }

    function buildAiLinkHtml(rawUrl, customLabel = '') {
        const normalizedUrl = sanitizeHttpUrl(rawUrl, { allowRelative: false });
        const label = escapeHtml(customLabel || formatLinkLabel(rawUrl));
        if (!normalizedUrl) {
            return `<span class="ai-rich-link ai-rich-link-disabled"><i class="fas fa-link"></i><span>${label}</span></span>`;
        }
        const safeUrl = escapeHtml(normalizedUrl);
        return `<a class="ai-rich-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${safeUrl}"><i class="fas fa-link"></i><span>${label}</span></a>`;
    }

    function buildAiCodeBlock(code, index = null, language = '') {
        const languageLabel = language ? escapeHtml(language) : 'code';
        const title = index ? `Mau ${index}` : languageLabel;
        return `
            <div class="ai-code-block">
                <div class="ai-code-block-head">
                    <span>${escapeHtml(title)}</span>
                    <span class="ai-code-block-lang">${languageLabel}</span>
                </div>
                <pre><code>${escapeHtml((code || '').toString().replace(/^\n+|\n+$/g, ''))}</code></pre>
            </div>
        `;
    }

    function formatLinkLabel(rawUrl) {
        try {
            const url = new URL(rawUrl);
            const host = (url.hostname || '').replace(/^www\./i, '');
            const path = (url.pathname && url.pathname !== '/') ? url.pathname : '';
            if (!path) return host || rawUrl;
            const shortPath = path.length > 22 ? `${path.slice(0, 22)}...` : path;
            return `${host}${shortPath}`;
        } catch (error) {
            return rawUrl;
        }
    }

    async function loadReviews() {
        try {
            const response = await api.get(`/products/${productId}/reviews`);
            if (response.success) {
                reviewsData = {
                    ...reviewsData,
                    ...(response.data || {})
                };
            }
        } catch (error) {
            reviewsData = {
                ...reviewsData,
                reviews: [],
                can_review: false,
                review_reason: 'Không thể tải danh sách đánh giá'
            };
        }
    }

    function updatePurchaseGateState() {
        const panel = document.getElementById('purchase-verification-panel');
        const note = document.getElementById('purchase-verification-note');
        const status = document.getElementById('purchase-recaptcha-status');
        const confirmBtn = document.getElementById('purchase-confirm-btn');
        const cancelBtn = document.getElementById('purchase-cancel-btn');
        const closeBtn = document.getElementById('purchase-close-btn');
        const purchaseBtn = document.getElementById('product-purchase-btn');
        const recaptchaSlot = document.getElementById('purchase-recaptcha');

        if (panel) {
            panel.classList.toggle('is-hidden', !purchaseGateState.open);
        }

        if (purchaseBtn) {
            purchaseBtn.innerHTML = purchaseGateState.open
                ? '<i class="fas fa-shield-alt"></i> Tiếp tục mua'
                : '<i class="fas fa-shopping-cart"></i> Mua ngay';
        }

        if (confirmBtn) {
            confirmBtn.disabled = purchaseGateState.submitting || purchaseRecaptchaState.status === 'loading';
            confirmBtn.innerHTML = purchaseGateState.submitting
                ? '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...'
                : 'Xác nhận mua';
        }

        if (cancelBtn) {
            cancelBtn.disabled = purchaseGateState.submitting;
        }

        if (closeBtn) {
            closeBtn.disabled = purchaseGateState.submitting;
        }

        if (recaptchaSlot) {
            recaptchaSlot.classList.toggle('is-hidden', !purchaseGateState.open);
        }

        if (note) {
            note.textContent = getEffectiveProductPrice(product || {}) <= 0
                ? 'Sản phẩm này miễn phí nhưng vẫn cần xác thực trước khi nhận.'
                : 'Xác thực robot để tiếp tục thanh toán.';
        }

        if (status) {
            if (!purchaseGateState.open) {
                status.textContent = '';
            } else if (purchaseRecaptchaState.status === 'loading') {
                status.textContent = 'Đang tải xác thực robot...';
            } else if (purchaseRecaptchaState.status === 'error') {
                status.textContent = 'Không thể tải xác thực robot. Vui lòng tải lại hoặc thử lại.';
            } else if (purchaseRecaptchaState.status === 'not_needed' || purchaseRecaptchaState.enabled === false) {
                status.textContent = 'Hệ thống chưa bật xác thực robot. Bấm xác nhận mua để tiếp tục.';
            } else {
                status.textContent = 'Hãy xác nhận robot rồi bấm xác nhận mua.';
            }
        }
    }

    async function initPurchaseRecaptcha(forceReload = false) {
        const container = document.getElementById('purchase-recaptcha');
        if (!container) {
            purchaseRecaptchaState = {
                enabled: false,
                widgetId: null,
                status: 'not_needed'
            };
            updatePurchaseGateState();
            return;
        }

        if (!purchaseGateState.open) {
            updatePurchaseGateState();
            return;
        }

        purchaseRecaptchaState = {
            enabled: false,
            widgetId: null,
            status: 'loading'
        };
        updatePurchaseGateState();

        try {
            const nextState = await window.RecaptchaManager.render(container, { forceReload });
            purchaseRecaptchaState = {
                ...nextState,
                status: nextState.enabled ? 'ready' : 'not_needed'
            };
        } catch (error) {
            purchaseRecaptchaState = {
                enabled: true,
                widgetId: null,
                status: 'error'
            };
            showToast(error.message || 'Không thể tải reCAPTCHA', 'error');
        }

        updatePurchaseGateState();
    }

    function openPurchaseGate() {
        purchaseGateState.open = true;
        purchaseGateState.submitting = false;
        updatePurchaseGateState();
        void initPurchaseRecaptcha();

        const panel = document.getElementById('purchase-verification-panel');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function closePurchaseGate() {
        purchaseGateState.open = false;
        purchaseGateState.submitting = false;
        if (purchaseRecaptchaState.enabled && purchaseRecaptchaState.widgetId !== null && window.RecaptchaManager) {
            window.RecaptchaManager.reset(purchaseRecaptchaState.widgetId);
        }
        purchaseRecaptchaState = {
            enabled: false,
            widgetId: null,
            status: 'idle'
        };
        updatePurchaseGateState();
    }

    function bindPurchaseGateEvents() {
        const confirmBtn = document.getElementById('purchase-confirm-btn');
        const cancelBtn = document.getElementById('purchase-cancel-btn');
        const closeBtn = document.getElementById('purchase-close-btn');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                void submitPurchaseAfterCaptcha();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                closePurchaseGate();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closePurchaseGate();
            });
        }

        updatePurchaseGateState();
    }

    function bindAnonymousCaptchaGateEvents() {
        const verifyBtn = document.getElementById('anonymous-product-verify-btn');
        const retryBtn = document.getElementById('anonymous-product-retry-btn');
        const homeBtn = document.getElementById('anonymous-product-home-btn');

        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                router.navigate('/');
            });
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                anonymousViewCaptchaState = {
                    ...anonymousViewCaptchaState,
                    enabled: false,
                    widgetId: null,
                    status: 'pending',
                    renderError: ''
                };
                updateAnonymousCaptchaGateState();
                void initAnonymousViewRecaptcha(true);
            });
        }

        if (!verifyBtn) {
            return;
        }

        verifyBtn.addEventListener('click', async () => {
            if (anonymousViewCaptchaState.status === 'loading') {
                return;
            }

            const recaptchaToken = anonymousViewCaptchaState.enabled
                ? window.RecaptchaManager.getResponse(anonymousViewCaptchaState.widgetId)
                : '';

            if (anonymousViewCaptchaState.enabled && !recaptchaToken) {
                showToast('Vui lòng xác nhận "Tôi không phải robot"', 'warning');
                return;
            }

            anonymousViewCaptchaState.status = 'loading';
            updateAnonymousCaptchaGateState();

            try {
                await loadProduct({ recaptchaToken });
            } catch (_) {
                // loadProduct tu xu ly giao dien loi
            } finally {
                if (document.getElementById('anonymous-product-verify-btn')) {
                    anonymousViewCaptchaState.status = anonymousViewCaptchaState.renderError ? 'error' : 'ready';
                    updateAnonymousCaptchaGateState();
                }
            }
        });
    }

    async function initAnonymousViewRecaptcha(forceReload = false) {
        const container = document.getElementById('anonymous-product-recaptcha');
        if (!container) {
            anonymousViewCaptchaState = {
                ...anonymousViewCaptchaState,
                enabled: false,
                widgetId: null,
                status: 'not_needed',
                renderError: ''
            };
            return;
        }

        anonymousViewCaptchaState = {
            ...anonymousViewCaptchaState,
            enabled: false,
            widgetId: null,
            status: 'loading',
            renderError: ''
        };
        updateAnonymousCaptchaGateState();

        try {
            const nextState = await window.RecaptchaManager.render(container, { forceReload });
            if (!nextState.enabled) {
                throw new Error('Không nhận được cấu hình reCAPTCHA hợp lệ. Vui lòng tải lại trang.');
            }

            anonymousViewCaptchaState = {
                ...anonymousViewCaptchaState,
                ...nextState,
                status: 'ready',
                renderError: ''
            };
        } catch (error) {
            anonymousViewCaptchaState = {
                ...anonymousViewCaptchaState,
                enabled: false,
                widgetId: null,
                status: 'error',
                renderError: error.message || 'Không thể tải reCAPTCHA'
            };
            showToast(anonymousViewCaptchaState.renderError, 'error');
        }

        updateAnonymousCaptchaGateState();
    }

    function updateSeoMeta() {
        if (!product) {
            return;
        }

        const title = [product.title, 'Sang dev'].filter(Boolean).join(' | ');
        const description = buildShareDescription(product);
        const image = toAbsoluteUrl(getProductImageUrl(product) || '/img/icon.ico');
        const pageUrl = window.location.href;

        setMetaTag('title', title);
        setMetaTag('description', description);
        setMetaTag('og:title', title);
        setMetaTag('og:description', description);
        setMetaTag('og:image', image);
        setMetaTag('og:url', pageUrl);
        setMetaTag('twitter:title', title);
        setMetaTag('twitter:description', description);
        setMetaTag('twitter:image', image);
    }

    function buildShareDescription(productInput) {
        const pieces = [];
        const summary = stripHtml((productInput.description || productInput.content || '').toString());
        if (summary) {
            pieces.push(summary);
        }

        const price = Number(productInput.effective_price ?? productInput.price ?? 0);
        pieces.push(price > 0 ? `Gia ${formatMoney(price)}` : 'San pham mien phi');

        if (productInput.seller_name) {
            pieces.push(`Nguoi ban: ${productInput.seller_name}`);
        }

        return truncateText(pieces.join(' | '), 200);
    }

    function stripHtml(input) {
        return String(input || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function truncateText(input, maxLength = 180) {
        const text = String(input || '').trim();
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
    }

    function ensureMetaElement(selector, builder) {
        let element = document.head.querySelector(selector);
        if (element) {
            return element;
        }

        element = builder();
        document.head.appendChild(element);
        return element;
    }

    function setMetaTag(key, value) {
        const content = String(value || '').trim();
        if (key === 'title') {
            document.title = content || defaultTitle;
            return;
        }

        const selectors = {
            'description': 'meta[name="description"]',
            'og:title': 'meta[property="og:title"]',
            'og:description': 'meta[property="og:description"]',
            'og:image': 'meta[property="og:image"]',
            'og:url': 'meta[property="og:url"]',
            'twitter:title': 'meta[name="twitter:title"]',
            'twitter:description': 'meta[name="twitter:description"]',
            'twitter:image': 'meta[name="twitter:image"]'
        };

        const builders = {
            'description': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('name', 'description');
                return meta;
            },
            'og:title': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('property', 'og:title');
                return meta;
            },
            'og:description': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('property', 'og:description');
                return meta;
            },
            'og:image': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('property', 'og:image');
                return meta;
            },
            'og:url': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('property', 'og:url');
                return meta;
            },
            'twitter:title': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('name', 'twitter:title');
                return meta;
            },
            'twitter:description': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('name', 'twitter:description');
                return meta;
            },
            'twitter:image': () => {
                const meta = document.createElement('meta');
                meta.setAttribute('name', 'twitter:image');
                return meta;
            }
        };

        const selector = selectors[key];
        const builder = builders[key];
        if (!selector || !builder) {
            return;
        }

        const meta = ensureMetaElement(selector, builder);
        meta.setAttribute('content', content);
    }

    function toAbsoluteUrl(input) {
        const raw = String(input || '').trim();
        if (!raw) {
            return '';
        }

        try {
            return new URL(raw, window.location.origin).href;
        } catch (_) {
            return '';
        }
    }

    function escapeHtml(input) {
        return (input || '')
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Global functions
    window.purchaseProduct = async function() {
        const effectivePrice = getEffectiveProductPrice(product || {});

        if (product.is_archived) {
            showToast('Sản phẩm đã lưu trữ, không thể mua', 'warning');
            return;
        }

        if (!Auth.isAuthenticated()) {
            showToast('Vui lòng đăng nhập để mua sản phẩm', 'warning');
            router.navigate('/login?redirect=' + window.location.pathname);
            return;
        }

        if (!purchaseGateState.open) {
            openPurchaseGate();
            return;
        }

        await submitPurchaseAfterCaptcha(effectivePrice);
    };

    async function submitPurchaseAfterCaptcha(effectivePrice = getEffectiveProductPrice(product || {})) {
        if (purchaseGateState.submitting) {
            return;
        }

        if (!purchaseGateState.open) {
            openPurchaseGate();
            return;
        }

        if (purchaseRecaptchaState.status === 'loading') {
            showToast('reCAPTCHA đang được tải, vui lòng đợi một chút', 'warning');
            return;
        }

        if (purchaseRecaptchaState.status === 'error') {
            showToast('Không thể tải reCAPTCHA. Vui lòng thử lại.', 'error');
            return;
        }

        if (!confirm(`Bạn có chắc muốn mua "${String(product.title || '')}" với giá ${formatMoney(effectivePrice)}?`)) {
            return;
        }

        const recaptchaToken = purchaseRecaptchaState.enabled
            ? window.RecaptchaManager.getResponse(purchaseRecaptchaState.widgetId)
            : '';

        if (purchaseRecaptchaState.enabled && !recaptchaToken) {
            showToast('Vui lòng xác nhận "Tôi không phải robot"', 'warning');
            return;
        }

        try {
            purchaseGateState.submitting = true;
            updatePurchaseGateState();

            const response = await api.post(`/products/${productId}/purchase`, {
                recaptcha_token: recaptchaToken
            });

            if (response.success) {
                showToast('Mua sản phẩm thành công!', 'success');
                
                // Update user balance
                const user = Auth.getCurrentUser();
                user.balance = response.data.newBalance;
                Auth.updateUser(user);

                // Reload product
                await loadProduct();
            }

        } catch (error) {
            if (purchaseRecaptchaState.enabled && purchaseRecaptchaState.widgetId !== null) {
                window.RecaptchaManager.reset(purchaseRecaptchaState.widgetId);
            }
            showToast(error.message || 'Không thể mua sản phẩm', 'error');
        } finally {
            purchaseGateState.submitting = false;
            updatePurchaseGateState();
        }
    }

    window.downloadProduct = function() {
        if (product.download_url) {
            window.open(product.download_url, '_blank');
            showToast('Đang tải xuống...', 'success');
        } else {
            showToast('Link tải chưa có sẵn', 'warning');
        }
    };
};
