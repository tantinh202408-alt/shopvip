// ============================================
// PRODUCT SERVICE
// File: backend/services/productService.js
// ============================================

const db = require('../config/database');
const { queueFullBackup } = require('./telegramBackupService');
const { getArchive, purgeArchivedProducts } = require('./archiveService');
const spamProtectionService = require('./spamProtectionService');
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL || 'duongthithuyhangkupee@gmail.com';
const PRODUCT_SALE_SETTING_KEYS = [
    'product_sale_enabled',
    'product_sale_title',
    'product_sale_note',
    'product_sale_scope',
    'product_sale_percent',
    'product_sale_category_ids'
];

function createStatusError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

// Sanitize text - treat as plain text only, no HTML/code execution
function sanitizeText(input) {
    if (input === null || input === undefined) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseCategoryIds(input) {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input.map(id => parseInt(id, 10)).filter(Number.isFinite);
    }
    if (typeof input === 'string') {
        return input
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(Number.isFinite);
    }
    return [];
}

function extractImageUrl(item) {
    if (typeof item === 'string') {
        return item.trim();
    }
    if (item && typeof item.image_url === 'string') {
        return item.image_url.trim();
    }
    return '';
}

function resolveProductMainImage(mainImage, gallery = []) {
    const direct = (mainImage || '').toString().trim();
    if (direct) return direct;

    for (const item of gallery) {
        const url = extractImageUrl(item);
        if (url) return url;
    }

    return null;
}

function parseBooleanSetting(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function parseSaleScope(value = '', fallback = 'all') {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'all' || normalized === 'category') return normalized;
    return fallback;
}

function parseCategoryIdsFromSetting(value = '') {
    return String(value || '')
        .split(',')
        .map(item => parseInt(item.trim(), 10))
        .filter(Number.isFinite);
}

function uniqueCategoryIds(input = []) {
    return Array.from(new Set(
        (Array.isArray(input) ? input : [])
            .map(item => parseInt(item, 10))
            .filter(Number.isFinite)
    ));
}

function parseSalePercent(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(parsed, 0, 100);
}

async function getSettingsMap(keys = [], executor = db) {
    if (!Array.isArray(keys) || keys.length === 0) {
        return {};
    }
    const placeholders = keys.map(() => '?').join(', ');
    const [rows] = await executor.execute(
        `SELECT setting_key, setting_value
         FROM system_settings
         WHERE setting_key IN (${placeholders})`,
        keys
    );
    const map = {};
    rows.forEach(item => {
        map[item.setting_key] = item.setting_value;
    });
    return map;
}

async function loadProductSaleSettings(executor = db) {
    const settings = await getSettingsMap(PRODUCT_SALE_SETTING_KEYS, executor);
    return {
        enabled: parseBooleanSetting(settings.product_sale_enabled, false),
        title: String(settings.product_sale_title || '').trim(),
        note: String(settings.product_sale_note || '').trim(),
        scope: parseSaleScope(settings.product_sale_scope, 'all'),
        percent: parseSalePercent(settings.product_sale_percent, 0),
        categoryIds: uniqueCategoryIds(parseCategoryIdsFromSetting(settings.product_sale_category_ids || ''))
    };
}

async function getProductCategoryIds(productId, primaryCategoryId = null, executor = db) {
    const ids = [];

    if (Number.isFinite(Number(primaryCategoryId))) {
        ids.push(Number(primaryCategoryId));
    }

    const [rows] = await executor.execute(
        `SELECT category_id
         FROM product_categories
         WHERE product_id = ?`,
        [productId]
    );

    rows.forEach(item => {
        if (Number.isFinite(Number(item.category_id))) {
            ids.push(Number(item.category_id));
        }
    });

    return uniqueCategoryIds(ids);
}

function buildSalePricing(basePrice, productCategoryIds = [], saleSettings = null) {
    const safeBasePrice = Number(basePrice || 0);
    const normalizedPrice = Number.isFinite(safeBasePrice) ? safeBasePrice : 0;
    const settings = saleSettings || {
        enabled: false,
        title: '',
        note: '',
        scope: 'all',
        percent: 0,
        categoryIds: []
    };

    const categoryIds = uniqueCategoryIds(productCategoryIds);
    const matchesCategory = settings.scope === 'all'
        ? true
        : categoryIds.some(id => settings.categoryIds.includes(id));
    const canApply = settings.enabled
        && normalizedPrice > 0
        && settings.percent > 0
        && matchesCategory;
    const salePercent = canApply ? settings.percent : 0;
    const discountAmount = canApply ? Math.round((normalizedPrice * salePercent) / 100) : 0;
    const effectivePrice = canApply ? Math.max(0, normalizedPrice - discountAmount) : normalizedPrice;

    return {
        originalPrice: normalizedPrice,
        effectivePrice,
        salePercent,
        discountAmount,
        saleApplied: canApply
    };
}

function applySalePricingToProduct(product, saleSettings) {
    if (!product || typeof product !== 'object') {
        return product;
    }

    const categories = Array.isArray(product.categories) ? product.categories : [];
    const categoryIds = uniqueCategoryIds([
        product.category_id,
        ...categories.map(item => item?.id)
    ]);
    const pricing = buildSalePricing(product.price, categoryIds, saleSettings);

    return {
        ...product,
        original_price: pricing.originalPrice,
        effective_price: pricing.effectivePrice,
        sale_percent: pricing.salePercent,
        sale_amount: pricing.discountAmount,
        sale_applied: pricing.saleApplied,
        sale_title: saleSettings?.title || '',
        sale_note: saleSettings?.note || ''
    };
}

function canAccessProductDownload(product = {}, viewer = {}) {
    const viewerRole = String(viewer.role || '').trim().toLowerCase();
    const viewerId = Number(viewer.userId || 0);
    const sellerId = Number(product.seller_id || 0);

    if (viewerRole === 'admin') {
        return true;
    }

    if (viewerRole === 'seller' && viewerId > 0 && viewerId === sellerId) {
        return true;
    }

    return Boolean(viewer.hasPurchased);
}

function sanitizeProductForViewer(product, viewer = {}) {
    if (!product || typeof product !== 'object') {
        return product;
    }

    const sanitized = {
        ...product
    };

    if (!canAccessProductDownload(sanitized, viewer)) {
        sanitized.download_url = null;
    }

    return sanitized;
}

function normalizeArchiveProduct(product = {}) {
    const normalized = { ...product, is_archived: true };
    if (!Array.isArray(normalized.gallery)) normalized.gallery = [];
    normalized.main_image = resolveProductMainImage(normalized.main_image, normalized.gallery);
    if (!Array.isArray(normalized.categories)) {
        if (normalized.category_id) {
            normalized.categories = [{
                id: normalized.category_id,
                name: normalized.category_name,
                slug: normalized.category_slug
            }].filter(item => item.id);
        } else {
            normalized.categories = [];
        }
    }
    return normalized;
}

function filterProductsByOptions(products, options = {}) {
    const {
        category_id,
        category_ids,
        seller_id,
        search,
        status
    } = options;

    const categoryList = parseCategoryIds(category_ids);
    const statusValue = status ? String(status) : null;
    const searchText = search ? String(search).toLowerCase() : '';

    return products.filter(product => {
        if (statusValue && product.status !== statusValue) return false;
        if (seller_id && Number(product.seller_id) !== Number(seller_id)) return false;

        if (category_id) {
            const cid = Number(category_id);
            const categories = Array.isArray(product.categories) ? product.categories : [];
            const inPrimary = Number(product.category_id) === cid;
            const inList = categories.some(c => Number(c.id) === cid);
            if (!inPrimary && !inList) return false;
        }

        if (categoryList.length) {
            const categories = Array.isArray(product.categories) ? product.categories : [];
            const primaryMatch = categoryList.includes(Number(product.category_id));
            const listMatch = categories.some(c => categoryList.includes(Number(c.id)));
            if (!primaryMatch && !listMatch) return false;
        }

        if (searchText) {
            const title = (product.title || '').toString().toLowerCase();
            const description = (product.description || '').toString().toLowerCase();
            if (!title.includes(searchText) && !description.includes(searchText)) return false;
        }

        return true;
    });
}

function sortProducts(items = [], sort = 'newest') {
    const data = [...items];
    const readPrice = (item) => Number(item?.effective_price ?? item?.price ?? 0);

    if (sort === 'price_asc') {
        data.sort((a, b) => readPrice(a) - readPrice(b));
        return data;
    }
    if (sort === 'price_desc') {
        data.sort((a, b) => readPrice(b) - readPrice(a));
        return data;
    }
    if (sort === 'popular') {
        data.sort((a, b) => {
            const aScore = Number(a.purchase_count || 0) * 2 + Number(a.view_count || 0);
            const bScore = Number(b.purchase_count || 0) * 2 + Number(b.view_count || 0);
            if (bScore !== aScore) return bScore - aScore;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return data;
    }
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return data;
}

async function getReviewStatsByProductIds(productIds = []) {
    if (!Array.isArray(productIds) || productIds.length === 0) return {};

    const placeholders = productIds.map(() => '?').join(',');
    const [rows] = await db.execute(
        `SELECT product_id, AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM product_reviews
         WHERE product_id IN (${placeholders})
         GROUP BY product_id`,
        productIds
    );

    const map = {};
    rows.forEach(item => {
        map[item.product_id] = {
            avg_rating: Number(item.avg_rating || 0),
            review_count: Number(item.review_count || 0)
        };
    });
    return map;
}

async function getUserEmailById(userId) {
    const [rows] = await db.execute(
        'SELECT email FROM users WHERE id = ?',
        [userId]
    );
    return rows[0]?.email || null;
}

async function resolveLiveProductByIdentifier(productIdentifier, executor = db) {
    const [rows] = await executor.execute(
        `SELECT id, seller_id, title, slug, status, price, category_id
         FROM products
         WHERE id = ? OR slug = ?
         LIMIT 1`,
        [productIdentifier, productIdentifier]
    );
    return rows[0] || null;
}

class ProductService {
    async getPurchaseTarget(productIdentifier) {
        const product = await resolveLiveProductByIdentifier(productIdentifier);
        if (!product) {
            throw createStatusError('Product not found', 404);
        }

        const [saleSettings, categoryIds] = await Promise.all([
            loadProductSaleSettings(),
            getProductCategoryIds(product.id, product.category_id)
        ]);
        const pricing = buildSalePricing(product.price, categoryIds, saleSettings);

        return {
            ...product,
            original_price: pricing.originalPrice,
            effective_price: pricing.effectivePrice,
            sale_percent: pricing.salePercent,
            sale_amount: pricing.discountAmount,
            sale_applied: pricing.saleApplied,
            price: pricing.effectivePrice
        };
    }

    async getProductSharePreview(productIdentifier) {
        try {
            const archive = await getArchive();
            const archivedProducts = Array.isArray(archive.products) ? archive.products : [];
            await purgeArchivedProducts(archivedProducts.map(p => p.id).filter(Boolean));

            const archivedMatch = archivedProducts.find(item =>
                String(item.id) === String(productIdentifier) ||
                String(item.slug || '') === String(productIdentifier)
            );

            if (archivedMatch) {
                const product = normalizeArchiveProduct(archivedMatch);
                const saleSettings = await loadProductSaleSettings();
                return applySalePricingToProduct(product, saleSettings);
            }

            const [products] = await db.execute(
                `SELECT
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender,
                    u.email as seller_email,
                    u.is_verified as seller_is_verified
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN users u ON p.seller_id = u.id
                 WHERE p.id = ? OR p.slug = ?
                 LIMIT 1`,
                [productIdentifier, productIdentifier]
            );

            if (products.length === 0) {
                throw createStatusError('Product not found', 404);
            }

            const product = products[0];
            const productId = product.id;

            const [[images], [categories], [reviewRows], saleSettings] = await Promise.all([
                db.execute(
                    'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order, id',
                    [productId]
                ),
                db.execute(
                    `SELECT c.id, c.name, c.slug
                     FROM product_categories pc
                     JOIN categories c ON c.id = pc.category_id
                     WHERE pc.product_id = ?`,
                    [productId]
                ),
                db.execute(
                    `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
                     FROM product_reviews
                     WHERE product_id = ?`,
                    [productId]
                ),
                loadProductSaleSettings()
            ]);

            product.gallery = images || [];
            product.main_image = resolveProductMainImage(product.main_image, product.gallery);
            product.avg_rating = Number(reviewRows[0]?.avg_rating || 0);
            product.review_count = Number(reviewRows[0]?.review_count || 0);

            if (Array.isArray(categories) && categories.length > 0) {
                product.categories = categories;
            } else if (product.category_id) {
                product.categories = [{
                    id: product.category_id,
                    name: product.category_name,
                    slug: product.category_slug
                }];
            } else {
                product.categories = [];
            }

            return applySalePricingToProduct(product, saleSettings);
        } catch (error) {
            throw error;
        }
    }
    // Lấy danh sách sản phẩm với phân trang và filter
    async getProducts(options = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                sort = 'newest'
            } = options;

            const normalizedOptions = {
                ...options,
                status: options.status ?? 'active'
            };

            const archive = await getArchive();
            const archivedProducts = Array.isArray(archive.products) ? archive.products : [];

            await purgeArchivedProducts(archivedProducts.map(p => p.id).filter(Boolean));

            const [dbProducts] = await db.execute(
                `SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender,
                    u.is_verified as seller_is_verified
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN users u ON p.seller_id = u.id`
            );

            const productIds = dbProducts.map(p => p.id);
            const categoriesMap = {};
            const imagesMap = {};
            if (productIds.length > 0) {
                const placeholders = productIds.map(() => '?').join(',');
                const [catRows] = await db.execute(
                    `SELECT pc.product_id, c.id, c.name, c.slug
                     FROM product_categories pc
                     JOIN categories c ON c.id = pc.category_id
                     WHERE pc.product_id IN (${placeholders})`,
                    productIds
                );
                catRows.forEach(item => {
                    if (!categoriesMap[item.product_id]) categoriesMap[item.product_id] = [];
                    categoriesMap[item.product_id].push({
                        id: item.id,
                        name: item.name,
                        slug: item.slug
                    });
                });

                const [imageRows] = await db.execute(
                    `SELECT * FROM product_images
                     WHERE product_id IN (${placeholders})
                     ORDER BY product_id ASC, display_order ASC, id ASC`,
                    productIds
                );
                imageRows.forEach(item => {
                    if (!imagesMap[item.product_id]) imagesMap[item.product_id] = [];
                    imagesMap[item.product_id].push(item);
                });
            }

            // Review stats
            const reviewStatsMap = await getReviewStatsByProductIds(productIds);

            const archivedIds = new Set(archivedProducts.map(p => String(p.id)));
            const liveProducts = dbProducts
                .filter(p => !archivedIds.has(String(p.id)))
                .map(p => {
                    const gallery = imagesMap[p.id] || [];
                    const mainImage = resolveProductMainImage(p.main_image, gallery);
                    return {
                    ...p,
                    main_image: mainImage,
                    gallery,
                    categories: categoriesMap[p.id] || (p.category_id ? [{
                        id: p.category_id,
                        name: p.category_name,
                        slug: p.category_slug
                    }] : []),
                    is_archived: false,
                    avg_rating: reviewStatsMap[p.id]?.avg_rating || 0,
                    review_count: reviewStatsMap[p.id]?.review_count || 0
                    };
                });

            const saleSettings = await loadProductSaleSettings();
            const pricedLiveProducts = liveProducts.map(item => applySalePricingToProduct(item, saleSettings));
            const archiveList = archivedProducts.map(normalizeArchiveProduct);

            const filtered = filterProductsByOptions(
                [...pricedLiveProducts, ...archiveList],
                normalizedOptions
            );

            const sorted = sortProducts(filtered, sort);
            const safeLimit = Math.max(parseInt(limit, 10) || 20, 1);
            const safePage = Math.max(parseInt(page, 10) || 1, 1);
            const offset = (safePage - 1) * safeLimit;
            const paged = sorted
                .slice(offset, offset + safeLimit)
                .map(item => sanitizeProductForViewer(item, { userId: null, role: null, hasPurchased: false }));
            const total = sorted.length;
            const totalPages = Math.ceil(total / safeLimit);

            return {
                products: paged,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            throw error;
        }
    }

    // Lấy chi tiết sản phẩm
    async getProductById(productIdentifier, userId = null) {
        try {
            let viewerRole = null;
            if (userId) {
                const [viewerRows] = await db.execute(
                    'SELECT role FROM users WHERE id = ? LIMIT 1',
                    [userId]
                );
                viewerRole = viewerRows[0]?.role || null;
            }

            const archive = await getArchive();
            const archivedProducts = Array.isArray(archive.products) ? archive.products : [];
            await purgeArchivedProducts(archivedProducts.map(p => p.id).filter(Boolean));

            const archivedMatch = archivedProducts.find(item =>
                String(item.id) === String(productIdentifier) ||
                String(item.slug || '') === String(productIdentifier)
            );

            if (archivedMatch) {
                const product = normalizeArchiveProduct(archivedMatch);
                product.is_purchased = false;

                if (userId && product.id) {
                    const [purchases] = await db.execute(
                        'SELECT id FROM purchases WHERE user_id = ? AND product_id = ?',
                        [userId, product.id]
                    );
                    product.is_purchased = purchases.length > 0;
                }

                return sanitizeProductForViewer(product, {
                    userId,
                    role: viewerRole,
                    hasPurchased: Boolean(product.is_purchased)
                });
            }

            // Get product
            const [products] = await db.execute(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.id as seller_id,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender,
                    u.email as seller_email,
                    u.is_verified as seller_is_verified
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.seller_id = u.id
                WHERE p.id = ? OR p.slug = ?
            `, [productIdentifier, productIdentifier]);

            if (products.length === 0 && /^[0-9]+$/.test(String(productIdentifier))) {
                const [fallback] = await db.execute(`
                    SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.id as seller_id,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender,
                    u.email as seller_email,
                    u.is_verified as seller_is_verified
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN users u ON p.seller_id = u.id
                    WHERE p.id = ?
                `, [productIdentifier]);
                if (fallback.length > 0) {
                    products.push(fallback[0]);
                }
            }

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const product = products[0];
            const productId = product.id;

            // Review stats
            const [reviewRows] = await db.execute(
                `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
                 FROM product_reviews
                 WHERE product_id = ?`,
                [productId]
            );
            product.avg_rating = Number(reviewRows[0]?.avg_rating || 0);
            product.review_count = Number(reviewRows[0]?.review_count || 0);

            // User review (if any)
            let hasPurchased = false;
            if (userId) {
                const [myReviewRows] = await db.execute(
                    'SELECT id, rating, comment, created_at, updated_at FROM product_reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
                    [productId, userId]
                );
                product.my_review = myReviewRows[0] || null;
            }

            // Get gallery images
            const [images] = await db.execute(
                'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order',
                [productId]
            );

            product.gallery = images;
            product.main_image = resolveProductMainImage(product.main_image, images);

            // Get categories
            const [categories] = await db.execute(
                `SELECT c.id, c.name, c.slug
                 FROM product_categories pc
                 JOIN categories c ON c.id = pc.category_id
                 WHERE pc.product_id = ?`,
                [productId]
            );

            if (categories.length > 0) {
                product.categories = categories;
            } else if (product.category_id) {
                product.categories = [{
                    id: product.category_id,
                    name: product.category_name,
                    slug: product.category_slug
                }];
            } else {
                product.categories = [];
            }

            const saleSettings = await loadProductSaleSettings();
            const pricedProduct = applySalePricingToProduct(product, saleSettings);

            // Check if user purchased
            if (userId) {
                const [purchases] = await db.execute(
                    'SELECT id FROM purchases WHERE user_id = ? AND product_id = ?',
                    [userId, productId]
                );
                hasPurchased = purchases.length > 0;
                pricedProduct.is_purchased = hasPurchased;
            }

            // Increment view count
            await db.execute(
                'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
                [productId]
            );

            return sanitizeProductForViewer(pricedProduct, {
                userId,
                role: viewerRole,
                hasPurchased
            });

        } catch (error) {
            throw error;
        }
    }

    // Tạo sản phẩm mới
    async getProductReviews(productIdentifier, userId = null) {
        try {
            const product = await resolveLiveProductByIdentifier(productIdentifier);
            if (!product) {
                throw new Error('Product not found');
            }

            const [reviews] = await db.execute(
                `SELECT 
                    r.id,
                    r.product_id,
                    r.user_id,
                    r.rating,
                    r.comment,
                    r.created_at,
                    r.updated_at,
                    u.full_name,
                    u.avatar,
                    u.gender,
                    u.is_verified
                 FROM product_reviews r
                 LEFT JOIN users u ON u.id = r.user_id
                 WHERE r.product_id = ?
                 ORDER BY r.updated_at DESC, r.created_at DESC`,
                [product.id]
            );

            const [statsRows] = await db.execute(
                `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
                 FROM product_reviews
                 WHERE product_id = ?`,
                [product.id]
            );

            let canReview = false;
            let reviewReason = null;
            let myReview = null;

            if (userId) {
                myReview = reviews.find(item => Number(item.user_id) === Number(userId)) || null;

                if (Number(userId) === Number(product.seller_id)) {
                    reviewReason = 'Bạn không thể đánh giá sản phẩm của chính mình';
                } else {
                    const [purchaseRows] = await db.execute(
                        'SELECT id FROM purchases WHERE user_id = ? AND product_id = ? LIMIT 1',
                        [userId, product.id]
                    );
                    canReview = purchaseRows.length > 0;
                    if (!canReview) {
                        reviewReason = 'Bạn cần mua sản phẩm trước khi đánh giá';
                    }
                }
            } else {
                reviewReason = 'Vui lòng đăng nhập để gửi đánh giá';
            }

            return {
                product_id: product.id,
                avg_rating: Number(statsRows[0]?.avg_rating || 0),
                review_count: Number(statsRows[0]?.review_count || 0),
                can_review: canReview,
                review_reason: reviewReason,
                my_review: myReview ? {
                    id: myReview.id,
                    rating: myReview.rating,
                    comment: myReview.comment,
                    created_at: myReview.created_at,
                    updated_at: myReview.updated_at
                } : null,
                reviews
            };
        } catch (error) {
            throw error;
        }
    }

    async upsertProductReview(productIdentifier, userId, { rating, comment }) {
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const product = await resolveLiveProductByIdentifier(productIdentifier, connection);
            if (!product) {
                throw new Error('Product not found');
            }

            if (Number(userId) === Number(product.seller_id)) {
                throw new Error('Bạn không thể đánh giá sản phẩm của chính mình');
            }

            const parsedRating = Number.parseInt(rating, 10);
            if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                throw new Error('Số sao đánh giá phải từ 1 đến 5');
            }

            const safeComment = (comment || '').toString().trim();
            if (!safeComment) {
                throw new Error('Vui lòng nhập mô tả đánh giá');
            }

            const [purchases] = await connection.execute(
                'SELECT id FROM purchases WHERE user_id = ? AND product_id = ? LIMIT 1',
                [userId, product.id]
            );
            if (purchases.length === 0) {
                throw new Error('Bạn cần mua sản phẩm trước khi đánh giá');
            }

            const [existing] = await connection.execute(
                'SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
                [product.id, userId]
            );

            if (existing.length > 0) {
                await connection.execute(
                    `UPDATE product_reviews
                     SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [parsedRating, safeComment, existing[0].id]
                );
            } else {
                await connection.execute(
                    `INSERT INTO product_reviews (product_id, user_id, rating, comment)
                     VALUES (?, ?, ?, ?)`,
                    [product.id, userId, parsedRating, safeComment]
                );
            }

            const [reviewRows] = await connection.execute(
                'SELECT id, rating, comment, created_at, updated_at FROM product_reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
                [product.id, userId]
            );

            const [statsRows] = await connection.execute(
                `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
                 FROM product_reviews
                 WHERE product_id = ?`,
                [product.id]
            );

            await connection.commit();

            return {
                review: reviewRows[0] || null,
                avg_rating: Number(statsRows[0]?.avg_rating || 0),
                review_count: Number(statsRows[0]?.review_count || 0)
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async deleteProductReview(productIdentifier, reviewId, requesterId, requesterRole = 'user', requesterEmail = '') {
        try {
            const product = await resolveLiveProductByIdentifier(productIdentifier);
            if (!product) {
                throw createStatusError('Product not found', 404);
            }

            const [rows] = await db.execute(
                `SELECT id, user_id
                 FROM product_reviews
                 WHERE id = ? AND product_id = ?
                 LIMIT 1`,
                [reviewId, product.id]
            );

            if (!rows.length) {
                throw createStatusError('Review not found', 404);
            }

            const review = rows[0];
            const isPrimaryAdminRequester = requesterRole === 'admin'
                && String(requesterEmail || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
            const canDelete = isPrimaryAdminRequester
                || Number(review.user_id) === Number(requesterId)
                || Number(product.seller_id) === Number(requesterId);

            if (!canDelete) {
                throw createStatusError('You do not have permission to delete this review', 403);
            }

            await db.execute(
                'DELETE FROM product_reviews WHERE id = ? AND product_id = ?',
                [reviewId, product.id]
            );

            return true;
        } catch (error) {
            throw error;
        }
    }

    async createProduct(sellerId, productData) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            const {
                title,
                slug,
                description,
                content,
                price,
                category_id,
                category_ids,
                main_image,
                background_image,
                video_url,
                demo_url,
                download_url,
                gallery = []
            } = productData;

            // Store raw text in DB - frontend handles escaping when rendering
            const safeDescription = description ?? null;
            const safeContent = content ?? null;
            const safeBackgroundImage = background_image ?? null;
            const safeVideoUrl = video_url ?? null;
            const safeDemoUrl = demo_url ?? null;
            const safeDownloadUrl = download_url ?? null;
            const safeGallery = [...new Set(
                (Array.isArray(gallery) ? gallery : [])
                    .map(item => (item || '').toString().trim())
                    .filter(Boolean)
            )];
            const safeMainImage = resolveProductMainImage(main_image, safeGallery);
            const rawCategoryIds = Array.isArray(category_ids) && category_ids.length
                ? category_ids.filter(Boolean)
                : (category_id ? [category_id] : []);
            const safeCategoryIds = [...new Set(rawCategoryIds)];
            const safeSlug = (slug && slug.trim().length)
                ? slug.trim()
                : (title || '').toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/đ/g, 'd')
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim();
            const primaryCategoryId = safeCategoryIds[0] ?? category_id;

            if (!primaryCategoryId) {
                throw new Error('Category is required');
            }
            if (!safeMainImage) {
                throw new Error('Main image is required');
            }

            // Insert product
            const [result] = await connection.execute(
                `INSERT INTO products 
                (title, slug, description, content, price, category_id, seller_id, 
                main_image, background_image, video_url, demo_url, download_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, safeSlug, safeDescription, safeContent, price, primaryCategoryId, sellerId,
                 safeMainImage, safeBackgroundImage, safeVideoUrl, safeDemoUrl, safeDownloadUrl]
            );

            const productId = result.insertId;

            // Insert gallery images
            if (safeGallery.length > 0) {
                for (let i = 0; i < safeGallery.length; i++) {
                    await connection.execute(
                        'INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)',
                        [productId, safeGallery[i], i]
                    );
                }
            }

            // Insert product categories
            if (safeCategoryIds.length > 0) {
                for (const catId of safeCategoryIds) {
                    await connection.execute(
                        'INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)',
                        [productId, catId]
                    );
                }
            }

            await connection.commit();

            return await this.getProductById(productId);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Cập nhật sản phẩm
    async updateProduct(productId, userId, userRole, requesterEmailOrProductData, maybeProductData) {
        const requesterEmailFromController = maybeProductData === undefined ? '' : requesterEmailOrProductData;
        const productData = maybeProductData === undefined ? requesterEmailOrProductData : maybeProductData;
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            // Check ownership
            const [products] = await connection.execute(
                `SELECT p.seller_id, p.status, u.email as seller_email
                 FROM products p
                 JOIN users u ON u.id = p.seller_id
                 WHERE p.id = ?`,
                [productId]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const requesterEmail = await getUserEmailById(userId);
            if (products[0].seller_email === PRIMARY_ADMIN_EMAIL && requesterEmail !== PRIMARY_ADMIN_EMAIL) {
                throw new Error('Không thể chỉnh sửa sản phẩm của admin chính');
            }

            const isPrimaryAdminRequester = userRole === 'admin'
                && String(requesterEmailFromController || requesterEmail || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

            if (!isPrimaryAdminRequester && Number(products[0].seller_id) !== Number(userId)) {
                throw new Error('You do not have permission to edit this product');
            }

            const updates = [];
            const values = [];
            const hasGallery = Object.prototype.hasOwnProperty.call(productData, 'gallery');
            const safeGallery = hasGallery
                ? [...new Set(
                    (Array.isArray(productData.gallery) ? productData.gallery : [])
                        .map(item => (item || '').toString().trim())
                        .filter(Boolean)
                )]
                : [];

            const fields = ['title', 'slug', 'description', 'content', 'price', 'category_id',
                           'main_image', 'background_image', 'video_url', 'demo_url', 'download_url', 'status'];

            fields.forEach(field => {
                if (productData[field] !== undefined) {
                    if (field === 'status' && !isPrimaryAdminRequester && products[0].status === 'banned') {
                        throw new Error('Sản phẩm đã bị cấm, không thể thay đổi trạng thái');
                    }
                    updates.push(`${field} = ?`);
                    values.push(productData[field]);
                }
            });

            if (updates.length === 0 && !hasGallery) {
                throw new Error('No data to update');
            }

            if (updates.length > 0) {
                values.push(productId);

                await connection.execute(
                    `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
                    values
                );
            }

            if (hasGallery) {
                await connection.execute(
                    'DELETE FROM product_images WHERE product_id = ?',
                    [productId]
                );

                for (let i = 0; i < safeGallery.length; i++) {
                    await connection.execute(
                        'INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)',
                        [productId, safeGallery[i], i]
                    );
                }
            }

            await connection.commit();

            return await this.getProductById(productId);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Xóa sản phẩm
    async deleteProduct(productId, userId, userRole, requesterEmailFromController = '') {
        try {
            // Check ownership
            const [products] = await db.execute(
                `SELECT p.seller_id, u.email as seller_email
                 FROM products p
                 JOIN users u ON u.id = p.seller_id
                 WHERE p.id = ?`,
                [productId]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const requesterEmail = await getUserEmailById(userId);
            if (products[0].seller_email === PRIMARY_ADMIN_EMAIL && requesterEmail !== PRIMARY_ADMIN_EMAIL) {
                throw new Error('Không thể xóa sản phẩm của admin chính');
            }

            const isPrimaryAdminRequester = userRole === 'admin'
                && String(requesterEmailFromController || requesterEmail || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

            if (!isPrimaryAdminRequester && Number(products[0].seller_id) !== Number(userId)) {
                throw new Error('You do not have permission to delete this product');
            }

            await db.execute('DELETE FROM products WHERE id = ?', [productId]);

            return true;

        } catch (error) {
            throw error;
        }
    }

    // Mua sản phẩm
    async purchaseProduct(userId, productId, context = {}) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            let resolvedProductId = productId;
            if (!/^\d+$/.test(String(productId))) {
                const [bySlug] = await connection.execute(
                    'SELECT id FROM products WHERE slug = ?',
                    [productId]
                );
                if (bySlug.length === 0) {
                    throw new Error('Product not found');
                }
                resolvedProductId = bySlug[0].id;
            }

            // Check if already purchased
            const [existing] = await connection.execute(
                'SELECT id FROM purchases WHERE user_id = ? AND product_id = ?',
                [userId, resolvedProductId]
            );

            if (existing.length > 0) {
                throw new Error('You have already purchased this product');
            }

            // Get product and user
            const [products] = await connection.execute(
                'SELECT id, title, price, category_id, seller_id, status FROM products WHERE id = ?',
                [resolvedProductId]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const product = products[0];
            const saleSettings = await loadProductSaleSettings(connection);
            const productCategoryIds = await getProductCategoryIds(
                resolvedProductId,
                product.category_id,
                connection
            );
            const pricing = buildSalePricing(product.price, productCategoryIds, saleSettings);
            const payablePrice = pricing.effectivePrice;

            if (product.status !== 'active') {
                throw new Error('Product is not available');
            }

            // Ngăn người bán tự mua sản phẩm của mình (tránh vòng trừ rồi cộng lại)
            if (Number(product.seller_id) === Number(userId)) {
                throw new Error('Bạn không thể mua sản phẩm của chính mình');
            }

            const [users] = await connection.execute(
                'SELECT balance FROM users WHERE id = ?',
                [userId]
            );

            const user = users[0];
            const [sellers] = await connection.execute(
                'SELECT balance FROM users WHERE id = ?',
                [product.seller_id]
            );
            if (sellers.length === 0) {
                throw new Error('Seller not found');
            }
            const sellerBalanceBefore = Number(sellers[0].balance || 0);

            if (Number(payablePrice || 0) <= 0) {
                await spamProtectionService.guardFreePurchase(connection, {
                    userId,
                    ip: context.ip || '',
                    productId: resolvedProductId
                });
            }

            // Check balance
            if (user.balance < payablePrice) {
                throw new Error('Insufficient balance');
            }

            // Deduct balance
            const newBalance = user.balance - payablePrice;

            await connection.execute(
                'UPDATE users SET balance = ? WHERE id = ?',
                [newBalance, userId]
            );

            const sellerBalanceAfter = sellerBalanceBefore + payablePrice;

            // Add to seller balance
            await connection.execute(
                'UPDATE users SET balance = ? WHERE id = ?',
                [sellerBalanceAfter, product.seller_id]
            );

            // Create purchase record
            await connection.execute(
                'INSERT INTO purchases (user_id, product_id, price_paid) VALUES (?, ?, ?)',
                [userId, resolvedProductId, payablePrice]
            );

            // Create transaction record
            await connection.execute(
                `INSERT INTO transactions 
                (user_id, type, amount, balance_before, balance_after, description, reference_id)
                VALUES (?, 'purchase', ?, ?, ?, ?, ?)`,
                [userId, -payablePrice, user.balance, newBalance, `Purchase: ${product.title}`, resolvedProductId]
            );

            await connection.execute(
                `INSERT INTO transactions
                (user_id, type, amount, balance_before, balance_after, description, reference_id)
                VALUES (?, 'seller_sale_credit', ?, ?, ?, ?, ?)`,
                [product.seller_id, payablePrice, sellerBalanceBefore, sellerBalanceAfter, `Sale income: ${product.title}`, resolvedProductId]
            );

            // Update product purchase count
            await connection.execute(
                'UPDATE products SET purchase_count = purchase_count + 1 WHERE id = ?',
                [resolvedProductId]
            );

            // Update system revenue
            await connection.execute(
                `UPDATE system_settings 
                SET setting_value = CAST(setting_value AS REAL) + ? 
                WHERE setting_key = 'total_revenue'`,
                [payablePrice]
            );

            await connection.commit();

            queueFullBackup('purchase', { user_id: userId, product_id: resolvedProductId });

            return {
                success: true,
                newBalance,
                product: {
                    id: resolvedProductId,
                    title: product.title,
                    price: payablePrice,
                    original_price: pricing.originalPrice,
                    effective_price: payablePrice,
                    sale_percent: pricing.salePercent,
                    sale_amount: pricing.discountAmount,
                    sale_applied: pricing.saleApplied,
                    seller_id: product.seller_id
                }
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new ProductService();
