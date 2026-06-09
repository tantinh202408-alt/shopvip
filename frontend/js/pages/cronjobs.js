// ============================================
// USER CRON JOBS PAGE
// File: frontend/js/pages/cronjobs.js
// ============================================

window.pageInit = async function(params, query = {}) {
    // Bind events
    const btnAdd = document.getElementById('btn-add-cronjob');
    const btnClose = document.getElementById('cronjob-modal-close');
    const btnCancel = document.getElementById('btn-cancel-cronjob');
    const form = document.getElementById('cronjob-form');

    if (btnAdd) btnAdd.onclick = () => showCronJobModal();
    if (btnClose) btnClose.onclick = () => hideCronJobModal();
    if (btnCancel) btnCancel.onclick = () => hideCronJobModal();
    if (form) form.onsubmit = handleFormSubmit;

    window.onclick = (e) => {
        const modal = document.getElementById('cronjob-modal');
        if (e.target === modal) {
            hideCronJobModal();
        }
    };

    await fetchAndRenderCronJobs();

    function buildScheduleFromPreset(preset, timezone) {
        const schedule = {
            timezone: timezone || 'Asia/Ho_Chi_Minh',
            minutes: [0],
            hours: [-1],
            mdays: [-1],
            months: [-1],
            wdays: [-1]
        };

        if (preset === 'every_minute') {
            schedule.minutes = [-1];
        } else if (preset === 'every_5_minutes') {
            schedule.minutes = Array.from({ length: 12 }, (_, i) => i * 5);
        } else if (preset === 'every_15_minutes') {
            schedule.minutes = [0, 15, 30, 45];
        } else if (preset === 'every_30_minutes') {
            schedule.minutes = [0, 30];
        } else if (preset === 'every_hour') {
            schedule.minutes = [0];
        } else if (preset === 'every_12_hours') {
            schedule.minutes = [0];
            schedule.hours = [0, 12];
        } else if (preset === 'every_day') {
            schedule.minutes = [0];
            schedule.hours = [0];
        } else if (preset === 'every_week') {
            schedule.minutes = [0];
            schedule.hours = [0];
            schedule.wdays = [0];
        } else if (preset === 'every_month') {
            schedule.minutes = [0];
            schedule.hours = [0];
            schedule.mdays = [1];
        }

        return schedule;
    }

    function detectPresetFromSchedule(schedule) {
        if (!schedule) return 'every_15_minutes';
        
        const m = schedule.minutes || [];
        const h = schedule.hours || [];
        const md = schedule.mdays || [];
        const wd = schedule.wdays || [];

        if (m.length === 1 && m[0] === -1) return 'every_minute';
        if (m.length === 12 && m.includes(5)) return 'every_5_minutes';
        if (m.length === 4 && m.includes(15)) return 'every_15_minutes';
        if (m.length === 2 && m.includes(30)) return 'every_30_minutes';
        if (m.length === 1 && m[0] === 0) {
            if (h.length === 1 && h[0] === -1) return 'every_hour';
            if (h.length === 2 && h.includes(12)) return 'every_12_hours';
            if (h.length === 1 && h[0] === 0) {
                if (wd.length === 1 && wd[0] === 0) return 'every_week';
                if (md.length === 1 && md[0] === 1) return 'every_month';
                return 'every_day';
            }
        }

        return 'every_15_minutes';
    }

    async function fetchAndRenderCronJobs() {
        const container = document.getElementById('cronjobs-list-container');
        if (!container) return;

        try {
            const res = await api.get('/cronjobs');
            if (res.success && res.data && res.data.jobs) {
                renderCronJobsList(res.data.jobs);
                
                // Update quota UI
                const count = res.data.jobs.length;
                const pct = Math.min((count / 5) * 100, 100);
                const desc = document.getElementById('cronjobs-quota-desc');
                const pctText = document.getElementById('cronjobs-quota-pct');
                const bar = document.getElementById('cronjobs-quota-bar');
                if (desc) desc.textContent = `Bạn đã sử dụng ${count} trong tổng số 5 tác vụ được phép.`;
                if (pctText) pctText.textContent = `${count}/5`;
                if (bar) {
                    bar.style.width = `${pct}%`;
                    if (count >= 5) {
                        bar.style.background = 'linear-gradient(90deg, var(--danger), #ef4444)';
                        bar.style.boxShadow = '0 0 8px #ef4444';
                    } else {
                        bar.style.background = 'linear-gradient(90deg, var(--primary), var(--primary-strong))';
                        bar.style.boxShadow = '0 0 8px var(--primary)';
                    }
                }
            } else {
                container.innerHTML = `
                    <div class="admin-empty-state" style="padding: 40px; text-align: center;">
                        <i class="fas fa-exclamation-circle" style="font-size: 48px; color: var(--muted); margin-bottom: 12px;"></i>
                        <h4>Không thể tải danh sách cron jobs</h4>
                        <p>${res.message || 'Lỗi không xác định khi truy cập API.'}</p>
                    </div>
                `;
            }
        } catch (error) {
            container.innerHTML = `
                <div class="admin-empty-state" style="padding: 40px; text-align: center;">
                    <i class="fas fa-triangle-exclamation" style="font-size: 48px; color: var(--danger); margin-bottom: 12px;"></i>
                    <h4>Lỗi hệ thống</h4>
                    <p>${error.message || 'Không thể kết nối đến server.'}</p>
                </div>
            `;
        }
    }

    function renderCronJobsList(jobs) {
        const container = document.getElementById('cronjobs-list-container');
        if (!container) return;

        if (!jobs || jobs.length === 0) {
            container.innerHTML = `
                <div class="admin-empty-state" style="padding: 40px; text-align: center;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: var(--muted); margin-bottom: 12px;"></i>
                    <h4>Chưa có tác vụ cron job nào</h4>
                    <p>Hãy nhấn nút "Thêm Tác Vụ" để tạo tác vụ cron job đầu tiên của bạn.</p>
                </div>
            `;
            return;
        }

        const formatUnixTime = (timestamp) => {
            if (!timestamp) return 'Chưa chạy';
            const date = new Date(timestamp * 1000);
            return date.toLocaleString('vi-VN');
        };

        const getStatusBadge = (status) => {
            if (status === 200) {
                return '<span class="badge badge-success" style="font-weight: 600;"><i class="fas fa-circle-check" style="margin-right: 4px;"></i>200 OK</span>';
            }
            if (status > 0) {
                return `<span class="badge badge-danger" style="font-weight: 600;"><i class="fas fa-circle-xmark" style="margin-right: 4px;"></i>Lỗi ${status}</span>`;
            }
            return '<span class="badge badge-outline" style="font-weight: 600; color: var(--muted); border-color: var(--border);"><i class="fas fa-clock" style="margin-right: 4px;"></i>Chờ chạy</span>';
        };

        const getScheduleLabel = (preset) => {
            const labels = {
                every_minute: 'Mỗi phút',
                every_5_minutes: 'Mỗi 5 phút',
                every_15_minutes: 'Mỗi 15 phút',
                every_30_minutes: 'Mỗi 30 phút',
                every_hour: 'Mỗi giờ',
                every_12_hours: 'Mỗi 12 giờ',
                every_day: 'Hàng ngày',
                every_week: 'Hàng tuần',
                every_month: 'Hàng tháng'
            };
            return labels[preset] || 'Tùy chỉnh';
        };

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Tên tác vụ</th>
                            <th>Đường dẫn (URL)</th>
                            <th>Tần suất</th>
                            <th>Lần chạy cuối</th>
                            <th>Kết quả</th>
                            <th style="text-align: center;">Kích hoạt</th>
                            <th style="text-align: right;">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${jobs.map(job => {
                            const preset = detectPresetFromSchedule(job.schedule);
                            return `
                                <tr data-job-id="${job.jobId}">
                                    <td><strong>${escapeHtml(job.title || `Job #${job.jobId}`)}</strong></td>
                                    <td><code style="word-break: break-all; font-size: 12px; color: var(--primary);">${escapeHtml(job.url)}</code></td>
                                    <td>
                                        <div style="font-weight: 500;">${getScheduleLabel(preset)}</div>
                                        <small style="color: var(--muted); font-size: 11px;">${job.schedule?.timezone || 'GMT'}</small>
                                    </td>
                                    <td><span style="font-size: 13px; color: var(--muted);">${formatUnixTime(job.lastExecution)}</span></td>
                                    <td>${getStatusBadge(job.lastStatus)}</td>
                                    <td style="text-align: center;">
                                        <label class="switch-container" style="display: inline-flex; align-items: center; cursor: pointer; position: relative;">
                                            <input type="checkbox" class="cronjob-toggle-status" data-job-id="${job.jobId}" ${job.enabled ? 'checked' : ''} style="display: none;">
                                            <span class="custom-switch-slider" style="width: 44px; height: 22px; background: ${job.enabled ? 'var(--success)' : '#475569'}; border-radius: 999px; display: block; position: relative; transition: all 0.3s ease;">
                                                <span style="width: 16px; height: 16px; background: #ffffff; border-radius: 50%; display: block; position: absolute; top: 3px; left: ${job.enabled ? '25px' : '3px'}; transition: all 0.3s ease;"></span>
                                            </span>
                                        </label>
                                    </td>
                                    <td style="text-align: right;">
                                        <div style="display: flex; justify-content: flex-end; gap: 8px;">
                                            <button type="button" class="btn btn-outline btn-sm cronjob-edit-btn" data-job-id="${job.jobId}" title="Chỉnh sửa">
                                                <i class="fas fa-edit" style="margin-right: 4px;"></i>Sửa
                                            </button>
                                            <button type="button" class="btn btn-danger-outline btn-sm cronjob-delete-btn" data-job-id="${job.jobId}" title="Xóa">
                                                <i class="fas fa-trash-can" style="margin-right: 4px;"></i>Xóa
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Bind Switch toggler click events
        container.querySelectorAll('.cronjob-toggle-status').forEach(checkbox => {
            const slider = checkbox.nextElementSibling;
            slider.onclick = async (e) => {
                e.preventDefault();
                const jobId = checkbox.dataset.jobId;
                const isCurrentlyEnabled = checkbox.checked;
                await toggleJobStatus(jobId, !isCurrentlyEnabled);
            };
        });

        // Bind edit click events
        container.querySelectorAll('.cronjob-edit-btn').forEach(btn => {
            btn.onclick = () => {
                const jobId = btn.dataset.jobId;
                const job = jobs.find(j => String(j.jobId) === String(jobId));
                if (job) {
                    showCronJobModal(job);
                }
            };
        });

        // Bind delete click events
        container.querySelectorAll('.cronjob-delete-btn').forEach(btn => {
            btn.onclick = async () => {
                const jobId = btn.dataset.jobId;
                const job = jobs.find(j => String(j.jobId) === String(jobId));
                if (confirm(`Bạn chắc chắn muốn xóa tác vụ "${job?.title || jobId}"?`)) {
                    await deleteCronJob(jobId);
                }
            };
        });
    }

    async function toggleJobStatus(jobId, enable) {
        showToast('Đang cập nhật trạng thái...', 'info');
        try {
            const res = await api.request(`/cronjobs/${jobId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    job: {
                        enabled: enable
                    }
                })
            });
            if (res.success) {
                showToast('Đã cập nhật trạng thái tác vụ', 'success');
                await fetchAndRenderCronJobs();
            } else {
                showToast(res.message || 'Cập nhật thất bại', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Lỗi kết nối', 'error');
        }
    }

    async function deleteCronJob(jobId) {
        showToast('Đang xóa tác vụ...', 'info');
        try {
            const res = await api.delete(`/cronjobs/${jobId}`);
            if (res.success) {
                showToast('Đã xóa tác vụ thành công', 'success');
                await fetchAndRenderCronJobs();
            } else {
                showToast(res.message || 'Xóa tác vụ thất bại', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Lỗi kết nối', 'error');
        }
    }

    function showCronJobModal(job = null) {
        const modal = document.getElementById('cronjob-modal');
        const form = document.getElementById('cronjob-form');
        const titleField = document.getElementById('cronjob-modal-title');
        const idField = document.getElementById('cronjob-id-field');
        const timezoneSelect = document.getElementById('cronjob-timezone');
        const presetSelect = document.getElementById('cronjob-preset');

        if (!modal || !form) return;

        form.reset();

        if (job) {
            titleField.textContent = 'Chỉnh Sửa Tác Vụ';
            idField.value = job.jobId;
            form.title.value = job.title;
            form.url.value = job.url;
            form.enabled.value = job.enabled ? 'true' : 'false';
            
            if (job.schedule) {
                timezoneSelect.value = job.schedule.timezone || 'Asia/Ho_Chi_Minh';
                presetSelect.value = detectPresetFromSchedule(job.schedule);
            }
        } else {
            titleField.textContent = 'Thêm Tác Vụ Mới';
            idField.value = '';
            timezoneSelect.value = 'Asia/Ho_Chi_Minh';
            presetSelect.value = 'every_15_minutes';
        }

        modal.style.display = 'flex';
    }

    function hideCronJobModal() {
        const modal = document.getElementById('cronjob-modal');
        if (modal) modal.style.display = 'none';
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const jobId = form.jobId.value;
        const title = form.title.value.trim();
        const url = form.url.value.trim();
        const enabled = form.enabled.value === 'true';
        const timezone = form.timezone.value;
        const preset = document.getElementById('cronjob-preset').value;

        const schedule = buildScheduleFromPreset(preset, timezone);

        const payload = {
            job: {
                title,
                url,
                enabled,
                saveResponses: true,
                schedule
            }
        };

        showToast('Đang lưu cấu hình...', 'info');
        try {
            let res;
            if (jobId) {
                res = await api.request(`/cronjobs/${jobId}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload)
                });
            } else {
                res = await api.request('/cronjobs', {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            }

            if (res.success) {
                showToast(jobId ? 'Đã cập nhật tác vụ thành công' : 'Đã tạo tác vụ mới thành công', 'success');
                hideCronJobModal();
                await fetchAndRenderCronJobs();
            } else {
                showToast(res.message || 'Lưu cấu hình thất bại', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Lỗi kết nối', 'error');
        }
    }
};
