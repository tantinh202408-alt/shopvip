// ============================================
// API CLIENT
// File: frontend/js/api.js
// ============================================

const API_BASE_URL = (() => {
    const explicit = window.API_BASE_URL || window.__API_BASE_URL__;
    if (explicit) {
        return String(explicit).replace(/\/+$/, '');
    }

    const host = window.location.hostname;
    const relativeBase = '/api';

    // Local development
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }

    // Default: same-origin API path; hosting/edge should proxy as needed
    return relativeBase;
})();

const HUMAN_CHECK_URL = `${window.location.origin}/human-check.html`;

window.API_BASE_URL = API_BASE_URL;
if (typeof window.buildApiUrl !== 'function') {
    window.buildApiUrl = (path = '') => {
        const clean = String(path || '').replace(/^\/+/, '');
        return `${API_BASE_URL}/${clean}`;
    };
}

// ============================================
// API CRYPTO HELPERS (Web Crypto API)
// ============================================
const SECRET_KEY = 'default_secret_key_source_market'; // Must match backend key source

function hexToUint8Array(hexString) {
    const length = hexString.length / 2;
    const array = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        array[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return array;
}

function uint8ArrayToHex(uint8Array) {
    return Array.from(uint8Array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function getCryptoKey() {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const hash = await window.crypto.subtle.digest('SHA-256', keyData);
    return window.crypto.subtle.importKey(
        'raw',
        hash,
        { name: 'AES-CBC' },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(text) {
    if (!text) return '';
    try {
        const key = await getCryptoKey();
        const iv = window.crypto.getRandomValues(new Uint8Array(16));
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: iv },
            key,
            data
        );
        const ciphertextHex = uint8ArrayToHex(new Uint8Array(encrypted));
        const ivHex = uint8ArrayToHex(iv);
        return `${ivHex}:${ciphertextHex}`;
    } catch (e) {
        console.error('Encryption error:', e);
        return text;
    }
}

async function decryptData(encryptedStr) {
    if (!encryptedStr || !encryptedStr.includes(':')) return encryptedStr;
    try {
        const parts = encryptedStr.split(':');
        const ivHex = parts[0];
        const ciphertextHex = parts[1];
        
        const key = await getCryptoKey();
        const iv = hexToUint8Array(ivHex);
        const ciphertext = hexToUint8Array(ciphertextHex);
        
        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-CBC', iv: iv },
            key,
            ciphertext
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (e) {
        console.error('Decryption error:', e);
        return encryptedStr;
    }
}

class APIClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.blockedIpPath = '/blocked-ip.html';
        this.humanGateCode = 'HUMAN_GATE_REQUIRED';
        this.pendingGetRequests = new Map();
        this.responseCache = new Map();
        this.maxCacheEntries = 120;
    }

    cloneData(data) {
        if (data === undefined) {
            return undefined;
        }

        if (typeof structuredClone === 'function') {
            return structuredClone(data);
        }

        return JSON.parse(JSON.stringify(data));
    }

    getCacheTtl(endpoint = '') {
        const path = String(endpoint || '').split('?')[0];

        if (path === '/categories') {
            return 5 * 60 * 1000;
        }

        if (path === '/settings') {
            return 60 * 1000;
        }

        if (path === '/auth/me') {
            return 20 * 1000;
        }

        if (path === '/notifications/important') {
            return 60 * 1000;
        }

        return 0;
    }

    buildRequestKey(endpoint = '', method = 'GET') {
        return `${String(method || 'GET').toUpperCase()}:${this.baseURL}${endpoint}`;
    }

    readCache(cacheKey, ttlMs) {
        if (!ttlMs) {
            return null;
        }

        const cached = this.responseCache.get(cacheKey);
        if (!cached) {
            return null;
        }

        if (Date.now() - cached.cachedAt > ttlMs) {
            this.responseCache.delete(cacheKey);
            return null;
        }

        return this.cloneData(cached.data);
    }

    writeCache(cacheKey, data) {
        if (!cacheKey) {
            return;
        }

        this.responseCache.set(cacheKey, {
            cachedAt: Date.now(),
            data: this.cloneData(data)
        });

        if (this.responseCache.size <= this.maxCacheEntries) {
            return;
        }

        const oldestKey = this.responseCache.keys().next().value;
        if (oldestKey) {
            this.responseCache.delete(oldestKey);
        }
    }

    clearCache() {
        this.responseCache.clear();
    }

    getHeaders(options = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const headers = {
            'X-App-Client': 'web',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Encrypted-Payload': '1'
        };
        const hasJsonBody = options.body !== undefined && options.body !== null && !(options.body instanceof FormData);

        if (hasJsonBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
            headers['Content-Type'] = 'application/json';
        }

        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    shouldAttachClientIp(endpoint = '') {
        const value = String(endpoint || '').split('?')[0];
        return value.startsWith('/auth/') || value === '/security/visitor-entry';
    }

    async getClientIpHeaders(endpoint) {
        if (!this.shouldAttachClientIp(endpoint)) {
            return {};
        }

        if (!window.PublicIpManager || typeof window.PublicIpManager.getPublicIp !== 'function') {
            return {};
        }

        try {
            const publicIp = await window.PublicIpManager.getPublicIp();
            if (!publicIp) {
                return {};
            }

            return {
                'X-Client-Public-IP': publicIp
            };
        } catch (_) {
            return {};
        }
    }

    isBlockedIpResponse(response) {
        if (!response?.url) {
            return false;
        }

        try {
            const responseUrl = new URL(response.url, window.location.origin);
            return responseUrl.pathname === this.blockedIpPath;
        } catch (_) {
            return false;
        }
    }

    redirectToBlockedIp(response) {
        const responseUrl = new URL(response.url, window.location.origin);
        const target = `${responseUrl.pathname}${responseUrl.search}${responseUrl.hash}`;
        window.location.replace(target);
    }

    redirectToHumanGate() {
        try {
            const gateUrl = new URL(HUMAN_CHECK_URL, window.location.origin);
            // Prevent redirect loop if already on gate page
            if (window.location.pathname === gateUrl.pathname) {
                return;
            }
            const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            gateUrl.searchParams.set('next', next);
            window.location.replace(gateUrl.toString());
        } catch (_) {
            window.location.reload();
        }
    }

    showMaintenanceMessage(message) {
        // Only show one at a time
        if (document.getElementById('maintenance-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'maintenance-overlay';
        overlay.className = 'maintenance-overlay';
        overlay.innerHTML = `
            <div class="maintenance-card">
                <div class="maintenance-icon">
                    <i class="fas fa-hammer"></i>
                </div>
                <h2 class="maintenance-title">Tính năng bảo trì</h2>
                <p class="maintenance-message">${message || 'Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm tốt nhất. Vui lòng quay lại sau ít phút.'}</p>
                <button class="maintenance-btn" onclick="document.getElementById('maintenance-overlay').remove(); if(window.router) window.router.navigate('/'); else window.location.href='/';">Đã hiểu, quay về trang chủ</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    async request(endpoint, options = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const url = this.baseURL + endpoint;
        const cacheKey = this.buildRequestKey(endpoint, method);
        const cacheTtl = method === 'GET' ? this.getCacheTtl(endpoint) : 0;
        const shouldUseCache = method === 'GET' && !options.forceRefresh;

        if (shouldUseCache) {
            const cached = this.readCache(cacheKey, cacheTtl);
            if (cached) {
                return cached;
            }

            if (this.pendingGetRequests.has(cacheKey)) {
                return this.pendingGetRequests.get(cacheKey);
            }
        }

        const requestTask = (async () => {
            let requestBody = options.body;
            if (requestBody && typeof requestBody === 'string') {
                try {
                    const encryptedBody = await encryptData(requestBody);
                    requestBody = JSON.stringify({ data: encryptedBody });
                } catch (err) {
                    console.error('Failed to encrypt request body:', err);
                }
            }

            const clientIpHeaders = await this.getClientIpHeaders(endpoint);
            const config = {
                ...options,
                method,
                body: requestBody,
                credentials: 'include',
                headers: {
                    ...this.getHeaders({
                        method,
                        body: requestBody
                    }),
                    ...clientIpHeaders,
                    ...options.headers
                }
            };

            try {
                const response = await fetch(url, config);
                if (this.isBlockedIpResponse(response)) {
                    this.redirectToBlockedIp(response);
                    throw new Error('IP cua ban dang bi khoa tam thoi');
                }

                const contentType = response.headers.get('content-type') || '';
                let data = contentType.includes('application/json')
                    ? await response.json()
                    : null;

                if (data && data.data && typeof data.data === 'string' && data.data.includes(':')) {
                    try {
                        const decrypted = await decryptData(data.data);
                        data = JSON.parse(decrypted);
                    } catch (err) {
                        console.error('Error decrypting response:', err);
                    }
                }

                if (!response.ok) {
                    const error = new Error(data?.message || 'Request failed');
                    error.status = response.status;
                    error.code = data?.code || '';
                    error.data = data?.data;
                    error.payload = data;
                    error.retryAfter = response.headers.get('retry-after') || '';
                    
                    if (error.code === this.humanGateCode) {
                        this.redirectToHumanGate();
                    }
                    
                    if (error.code === 'FEATURE_LOCKED') {
                        this.showMaintenanceMessage(data?.message || 'Tính năng này đang bảo trì');
                    }
                    
                    throw error;
                }

                if (method === 'GET' && cacheTtl > 0) {
                    this.writeCache(cacheKey, data);
                } else if (method !== 'GET') {
                    this.clearCache();
                }

                return data;
            } catch (error) {
                console.error('API Error:', error);
                throw error;
            } finally {
                if (method === 'GET') {
                    this.pendingGetRequests.delete(cacheKey);
                }
            }
        })();

        if (method === 'GET') {
            this.pendingGetRequests.set(cacheKey, requestTask);
        }

        return requestTask;
    }

    async get(endpoint, params = {}, options = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, {
            ...options,
            method: 'GET'
        });
    }

    async post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    }

    async put(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: body === undefined ? undefined : JSON.stringify(body)
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }

    async upload(endpoint, formData) {
        const token = localStorage.getItem('token');
        const headers = {
            'X-App-Client': 'web',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Encrypted-Payload': '1'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(this.baseURL + endpoint, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });

        if (this.isBlockedIpResponse(response)) {
            this.redirectToBlockedIp(response);
            throw new Error('IP cua ban dang bi khoa tam thoi');
        }

        let data = await response.json();
        if (data && data.data && typeof data.data === 'string' && data.data.includes(':')) {
            try {
                const decrypted = await decryptData(data.data);
                data = JSON.parse(decrypted);
            } catch (err) {
                console.error('Error decrypting upload response:', err);
            }
        }

        if (data?.code === this.humanGateCode) {
            this.redirectToHumanGate();
            throw new Error(data.message || 'Vui lòng xác nhận bạn là người thật');
        }

        if (response.ok) {
            this.clearCache();
        }

        return data;
    }

    uploadWithProgress(endpoint, formData, onProgress) {
        const token = localStorage.getItem('token');
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', this.baseURL + endpoint, true);
            xhr.withCredentials = true;
            xhr.setRequestHeader('X-App-Client', 'web');
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            xhr.setRequestHeader('X-Encrypted-Payload', '1');
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.upload.addEventListener('progress', (event) => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                if (typeof onProgress === 'function') {
                    onProgress(percent);
                }
            });

            xhr.onload = async () => {
                try {
                    const responseURL = xhr.responseURL ? new URL(xhr.responseURL, window.location.origin) : null;
                    if (responseURL && responseURL.pathname === this.blockedIpPath) {
                        window.location.replace(`${responseURL.pathname}${responseURL.search}${responseURL.hash}`);
                        reject(new Error('IP cua ban dang bi khoa tam thoi'));
                        return;
                    }

                    let responseText = xhr.responseText || '{}';
                    try {
                        const parsed = JSON.parse(responseText);
                        if (parsed && parsed.data && typeof parsed.data === 'string' && parsed.data.includes(':')) {
                            const decrypted = await decryptData(parsed.data);
                            responseText = decrypted;
                        }
                    } catch (_) {}

                    const data = JSON.parse(responseText);
                    if (data?.code === this.humanGateCode) {
                        this.redirectToHumanGate();
                        reject(new Error(data.message || 'Vui lòng xác nhận bạn là người thật'));
                        return;
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        this.clearCache();
                        resolve(data);
                    } else {
                        reject(new Error(data.message || 'Upload failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            };

            xhr.onerror = () => {
                reject(new Error('Upload failed'));
            };

            xhr.send(formData);
        });
    }
}

const api = new APIClient(API_BASE_URL);
