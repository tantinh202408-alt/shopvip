// File: frontend/js/pages/register.js
window.pageInit = async function() {
    const PENDING_STORAGE_KEY = 'pending_register_verification_v1';
    const form = document.getElementById('register-request-form');
    const tosOpen = document.getElementById('tos-open');
    const tosModal = document.getElementById('tos-modal');
    const tosClose = document.getElementById('tos-close');
    const tosConfirm = document.getElementById('tos-confirm');
    const tosTitle = document.getElementById('tos-title');
    const tosContent = document.getElementById('tos-content');
    const tosStatus = document.getElementById('tos-status');
    const recaptchaContainer = document.getElementById('register-recaptcha');
    const sendOtpBtn = document.getElementById('send-register-otp');
    const requestNote = document.getElementById('register-request-note');
    let hasReadTerms = false;
    let canSubmitAuthForm = false;
    let recaptchaState = { enabled: false, widgetId: null };
    let pendingRegistration = null;

    window.PublicIpManager?.warmup?.();
    await loadTerms();
    bindTermsModal();
    restorePendingRegistration();
    updateUi();
    await initRecaptcha();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = collectRequestData();
        if (!validateRequestData(payload)) {
            return;
        }

        if (!hasReadTerms) {
            showToast('Bạn phải mở điều khoản và bấm "Đã đọc" trước khi đăng ký', 'error');
            openTermsModal();
            return;
        }

        const recaptchaToken = recaptchaState.enabled
            ? window.RecaptchaManager.getResponse(recaptchaState.widgetId)
            : '';

        if (recaptchaState.enabled && !recaptchaToken) {
            showToast('Vui lòng xác nhận reCAPTCHA', 'error');
            return;
        }

        setLoadingState(true);

        try {
            const response = await api.post('/auth/register', {
                ...payload,
                terms_acknowledged: true,
                recaptcha_token: recaptchaToken
            });

            if (response.success && response.data?.otp_required) {
                persistPendingRegistration(payload, response.data);
                showToast('Mã OTP đã được gửi về email của bạn', 'success');
                router.navigate('/register/verify');
            }
        } catch (error) {
            showToast(error.message || 'Không gửi được mã OTP', 'error');
        } finally {
            if (recaptchaState.enabled) {
                window.RecaptchaManager.reset(recaptchaState.widgetId);
            }
            setLoadingState(false);
        }
    });

    async function loadTerms() {
        if (!tosTitle || !tosContent) return;
        try {
            const res = await api.get('/settings', { keys: 'tos_title,tos_content' });
            if (!res.success) return;
            const title = res.data.tos_title || 'Điều khoản dịch vụ';
            const content = res.data.tos_content || '';
            tosTitle.textContent = title;
            tosContent.innerHTML = content
                ? content.split('\n').map((line) => `<p>${line}</p>`).join('')
                : '<p>Chưa có nội dung điều khoản.</p>';
        } catch (_) {
            tosContent.innerHTML = '<p>Không thể tải điều khoản.</p>';
        }
    }

    function bindTermsModal() {
        if (tosOpen && tosModal) {
            tosOpen.addEventListener('click', openTermsModal);
        }
        if (tosClose && tosModal) {
            tosClose.addEventListener('click', () => tosModal.classList.remove('active'));
        }
        if (tosConfirm && tosModal) {
            tosConfirm.addEventListener('click', () => {
                hasReadTerms = true;
                updateUi();
                tosModal.classList.remove('active');
                showToast('Đã xác nhận điều khoản', 'success');
            });
        }
        if (tosModal) {
            tosModal.addEventListener('click', (event) => {
                if (event.target === tosModal) {
                    tosModal.classList.remove('active');
                }
            });
        }
    }

    function openTermsModal() {
        if (!tosModal) return;
        tosModal.classList.add('active');
    }

    function updateUi() {
        if (tosStatus) {
            tosStatus.textContent = hasReadTerms
                ? 'Bạn đã đọc điều khoản dịch vụ. Có thể tiếp tục đăng ký.'
                : 'Bạn cần đọc điều khoản dịch vụ trước khi tiếp tục.';
            tosStatus.classList.toggle('is-read', hasReadTerms);
        }

        if (tosOpen) {
            tosOpen.textContent = hasReadTerms ? 'Xem lại điều khoản dịch vụ' : 'Đọc điều khoản dịch vụ';
        }

        if (sendOtpBtn) {
            sendOtpBtn.disabled = !hasReadTerms || !canSubmitAuthForm;
            sendOtpBtn.textContent = pendingRegistration ? 'Gửi lại mã OTP' : 'Tiếp tục và gửi mã OTP';
        }

        if (requestNote) {
            requestNote.textContent = pendingRegistration
                ? `Đang có OTP cho ${pendingRegistration.email}. Bạn có thể đổi thông tin và gửi lại mã mới.`
                : 'Email này sẽ được dùng để nhận mã OTP và thông báo liên quan đến tài khoản.';
        }
    }

    async function initRecaptcha() {
        try {
            recaptchaState = await window.RecaptchaManager.render(recaptchaContainer);
            canSubmitAuthForm = true;
        } catch (error) {
            canSubmitAuthForm = false;
            showToast(error.message || 'Không thể tải reCAPTCHA', 'error');
        } finally {
            updateUi();
        }
    }

    function collectRequestData() {
        const formData = new FormData(form);
        return {
            email: String(formData.get('email') || '').trim(),
            password: String(formData.get('password') || ''),
            full_name: String(formData.get('full_name') || '').trim(),
            gender: String(formData.get('gender') || 'male')
        };
    }

    function validateRequestData(data) {
        if (!data.full_name) {
            showToast('Vui lòng nhập họ tên', 'error');
            return false;
        }

        if (!isValidEmail(data.email)) {
            showToast('Email không hợp lệ', 'error');
            return false;
        }

        if (data.password.length < 6) {
            showToast('Mật khẩu phải có ít nhất 6 ký tự', 'error');
            return false;
        }

        return true;
    }

    function persistPendingRegistration(payload, responseData) {
        pendingRegistration = {
            email: responseData.email || payload.email,
            payload,
            hint: buildOtpHint(responseData),
            hasReadTerms: true,
            createdAt: Date.now()
        };

        sessionStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pendingRegistration));
    }

    function restorePendingRegistration() {
        const raw = sessionStorage.getItem(PENDING_STORAGE_KEY);
        if (!raw) {
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            if (!parsed?.email || !parsed?.payload?.email) {
                sessionStorage.removeItem(PENDING_STORAGE_KEY);
                return;
            }

            pendingRegistration = parsed;
            hasReadTerms = parsed.hasReadTerms === true;
            fillRequestForm(parsed.payload);
        } catch (_) {
            sessionStorage.removeItem(PENDING_STORAGE_KEY);
        }
    }

    function fillRequestForm(payload) {
        if (!payload) return;

        const fields = {
            full_name: payload.full_name || '',
            email: payload.email || '',
            gender: payload.gender || 'male',
            password: payload.password || ''
        };

        Object.entries(fields).forEach(([name, value]) => {
            const field = form.elements.namedItem(name);
            if (field) {
                field.value = value;
            }
        });
    }

    function buildOtpHint(data) {
        const expireMinutes = Math.max(Math.ceil((Number(data?.expires_in_seconds) || 0) / 60), 1);
        const resendSeconds = Number(data?.resend_after_seconds) || 60;
        return `Mã OTP có hiệu lực ${expireMinutes} phút. Bạn có thể gửi lại mã sau khoảng ${resendSeconds} giây.`;
    }

    function setLoadingState(isLoading) {
        sendOtpBtn.disabled = isLoading || !hasReadTerms || !canSubmitAuthForm;
        sendOtpBtn.textContent = isLoading
            ? 'Đang gửi OTP...'
            : (pendingRegistration ? 'Gửi lại mã OTP' : 'Tiếp tục và gửi mã OTP');
    }
};
