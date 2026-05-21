// ==UserScript==
// @name         TikTok Report Bot - FIXED CLICK
// @namespace    http://tampermonkey.net/
// @version      18.1
// @description  Fix click upload và agreements
// @match        https://www.tiktok.com/legal/report/feedback*
// @match        https://www.tiktok.com/report*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        setTimeout(() => {
            new TikTokReportBot();
        }, 2000);
    }

    class TikTokReportBot {
        constructor() {
            this.running = false;
            this.createPanel();
            this.loadSettings();
            this.log("✅ Bot đã sẵn sàng!");
        }

        log(msg, type = 'info') {
            const logDiv = document.getElementById('tt-log');
            if (!logDiv) return;
            const time = new Date().toLocaleTimeString();
            const colors = { error: 'red', success: 'green', info: 'black' };
            logDiv.innerHTML += `<div style="color: ${colors[type]}; border-bottom: 1px solid #ddd; padding: 4px; font-size: 11px;">[${time}] ${msg}</div>`;
            logDiv.scrollTop = logDiv.scrollHeight;
            console.log(msg);
        }

        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async clickElement(element, timeout = 10000) {
            if (!element) return false;

            try {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.wait(300);

                // Click bằng nhiều cách
                element.click();
                element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

                await this.wait(500);
                return true;
            } catch (e) {
                this.log(`Click lỗi: ${e.message}`, 'error');
                return false;
            }
        }

        async clickTopic() {
            this.log("📍 Bước 1: Click Topic...");

            let topic = document.querySelector('div[aria-label="Topic"]');
            if (!topic) topic = document.querySelector('[aria-label="Topic"]');

            if (!topic) {
                const divs = document.querySelectorAll('div');
                for (let div of divs) {
                    if (div.textContent === 'Topic') {
                        topic = div;
                        break;
                    }
                }
            }

            if (!topic) {
                throw new Error("Không tìm thấy Topic!");
            }

            await this.clickElement(topic);
            this.log("✅ Đã click Topic");
            await this.wait(1500);
            return true;
        }

        async selectOption5() {
            this.log("📍 Bước 2: Chọn Report an underage user...");

            let option = document.querySelector('#option_5');
            if (!option) {
                const options = document.querySelectorAll('div, li, button');
                for (let el of options) {
                    if (el.textContent && el.textContent.includes('Report an underage user')) {
                        option = el;
                        break;
                    }
                }
            }

            if (!option) {
                throw new Error("Không tìm thấy option 5!");
            }

            await this.clickElement(option);
            this.log("✅ Đã chọn Report an underage user");
            await this.wait(2000);
            return true;
        }

        async selectOption2_0() {
            this.log("📍 Bước 3: Chọn I'm a parent or legal guardian...");

            let option = document.querySelector('#option2_0');
            if (!option) {
                const options = document.querySelectorAll('div, li, button');
                for (let el of options) {
                    if (el.textContent && (el.textContent.includes('parent') || el.textContent.includes('guardian'))) {
                        option = el;
                        break;
                    }
                }
            }

            if (option) {
                await this.clickElement(option);
                this.log("✅ Đã chọn parent/guardian");
                await this.wait(2000);
            } else {
                this.log("⚠️ Không thấy option parent/guardian, bỏ qua");
            }
            return true;
        }

        async fillForm(myUser, targetUser, email, desc) {
            this.log("📍 Bước 4: Điền form...");

            let input = document.querySelector('input#username');
            if (input) {
                input.value = myUser;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                this.log("✅ Đã điền Your Username");
            }

            await this.wait(500);

            input = document.querySelector('input#underageUsername');
            if (input) {
                input.value = targetUser;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                this.log("✅ Đã điền Target Username");
            }

            await this.wait(500);

            input = document.querySelector('input#email');
            if (input) {
                input.value = email;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                this.log("✅ Đã điền Email");
            }

            await this.wait(500);

            const textarea = document.querySelector('textarea#feedback');
            if (textarea) {
                textarea.value = desc;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                this.log("✅ Đã điền Description");
            }

            await this.wait(1000);
        }

        async clickUploadButton() {
            this.log("📍 Bước 5: Click nút Upload...");

            // Tìm nút upload theo đúng cấu trúc bạn đưa
            let uploadBtn = document.querySelector('label[for="input-file-screenshots"] .choose-file');
            if (!uploadBtn) uploadBtn = document.querySelector('label[for="input-file-screenshots"]');
            if (!uploadBtn) uploadBtn = document.querySelector('.choose-file-button');
            if (!uploadBtn) uploadBtn = document.querySelector('span[aria-label="Upload"]');

            if (!uploadBtn) {
                this.log("⚠️ Không tìm thấy nút upload", "error");
                return false;
            }

            this.log("✅ Tìm thấy nút upload, đang click...");
            await this.clickElement(uploadBtn);
            await this.wait(1000);

            // Mở dialog chọn file
            const fileInput = document.querySelector('#input-file-screenshots');
            if (fileInput) {
                fileInput.click();
                this.log("✅ Đã mở hộp thoại chọn file");
            }

            return true;
        }

        async checkAgreement(index) {
            this.log(`📍 Check agreement ${index}...`);

            // Tìm theo cấu trúc HTML bạn cung cấp
            let input = document.querySelector(`#${index}agreement`);

            if (!input) {
                this.log(`❌ Không tìm thấy agreement ${index}`, 'error');
                return false;
            }

            // Nếu đã check thì bỏ qua
            if (input.checked) {
                this.log(`✅ Agreement ${index} đã được check trước đó`);
                return true;
            }

            // Đợi DOM ổn định
            await this.wait(800);

            // Tìm label tương ứng và click
            const label = document.querySelector(`label[for="${index}agreement"]`);

            if (label) {
                this.log(`🖱️ Đang click vào label của agreement ${index}...`);
                await this.clickElement(label);
                await this.wait(500);
            } else {
                this.log(`⚠️ Không tìm thấy label cho agreement ${index}, thử click trực tiếp vào input`, 'error');
                await this.clickElement(input);
                await this.wait(500);
            }

            // Kiểm tra lại sau khi click
            if (!input.checked) {
                this.log(`⚠️ Agreement ${index} vẫn chưa được check, ép buộc bằng JavaScript`, 'error');
                // Force check bằng JavaScript
                const nativeSetter = Object.getOwnPropertyDescriptor(
                    HTMLInputElement.prototype,
                    'checked'
                ).set;

                nativeSetter.call(input, true);
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await this.wait(300);
            }

            // Final check
            if (input.checked) {
                this.log(`✅ Đã check thành công agreement ${index}`, 'success');
                return true;
            } else {
                this.log(`❌ Không thể check agreement ${index}`, 'error');
                return false;
            }
        }

        async submitReport() {
            this.log("📍 Bước 8: Submit report...");

            const submitBtn = document.querySelector('button[aria-label="Submit"]');
            if (!submitBtn) {
                throw new Error("Không tìm thấy nút Submit!");
            }

            await this.clickElement(submitBtn);
            this.log("✅ Đã click Submit");
            await this.wait(3000);

            const okBtn = document.querySelector('.success-tip-btn-submitted');
            if (okBtn) {
                await this.clickElement(okBtn);
                this.log("✅ Đã click OK");
            }
        }

        async runOnce(data) {
            try {
                await this.clickTopic();
                await this.selectOption5();
                await this.selectOption2_0();
                await this.fillForm(data.myUser, data.targetUser, data.email, data.desc);
                await this.clickUploadButton();    // Click nút upload

                // Check cả 2 agreement
                await this.checkAgreement(0);
                await this.wait(300);
                await this.checkAgreement(1);
                await this.wait(500);

                await this.submitReport();
                return true;
            } catch (error) {
                this.log(`❌ Lỗi: ${error.message}`, 'error');
                return false;
            }
        }

        async start() {
            if (this.running) {
                this.log("Bot đang chạy!", "error");
                return;
            }

            const loop = parseInt(document.getElementById('tt-loop').value);
            const myUser = document.getElementById('tt-myuser').value.trim();
            const targetUser = document.getElementById('tt-target').value.trim();
            const email = document.getElementById('tt-email').value.trim();
            const desc = document.getElementById('tt-desc').value;
            const delay = parseInt(document.getElementById('tt-delay').value);

            if (!myUser || !targetUser || !email) {
                this.log("❌ Vui lòng điền đủ: Your Username, Target Username, Email", "error");
                return;
            }

            this.running = true;
            document.getElementById('tt-start').disabled = true;
            document.getElementById('tt-stop').disabled = false;

            this.saveSettings();
            this.log(`🚀 Bắt đầu ${loop} lượt report`, "success");

            for (let i = 1; i <= loop && this.running; i++) {
                this.log(`\n========== LƯỢT ${i}/${loop} ==========`);
                document.getElementById('tt-status').innerHTML = `⏳ Lượt ${i}/${loop}`;

                const data = { myUser, targetUser, email, desc };
                const success = await this.runOnce(data);

                const progress = (i / loop) * 100;
                document.getElementById('tt-progress').style.width = `${progress}%`;
                document.getElementById('tt-status').innerHTML = `✅ ${i}/${loop}`;

                if (success && i < loop && this.running) {
                    this.log(`⏳ Đợi ${delay} giây rồi reload...`);
                    await this.wait(delay * 1000);
                    this.log("🔄 Reload trang...");
                    location.reload();
                    await this.wait(5000);
                } else if (!success) {
                    this.log("❌ Dừng do lỗi", "error");
                    break;
                }
            }

            if (this.running) {
                this.log("🎉 HOÀN THÀNH TẤT CẢ LƯỢT!", "success");
                GM_notification("TikTok Report", "Hoàn thành tất cả lượt report!");
            }

            this.stop();
        }

        stop() {
            this.running = false;
            document.getElementById('tt-start').disabled = false;
            document.getElementById('tt-stop').disabled = true;
            document.getElementById('tt-status').innerHTML = '✅ Stopped';
            this.log("🛑 Đã dừng bot");
        }

        createPanel() {
            const panel = document.createElement('div');
            panel.id = 'tt-panel';
            panel.innerHTML = `
                <div style="position: fixed; top: 20px; right: 20px; width: 420px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 100000; font-family: Arial, sans-serif;">
                    <div style="background: #fe2c55; color: white; padding: 12px; border-radius: 12px 12px 0 0; cursor: move; display: flex; justify-content: space-between;">
                        <span style="font-weight: bold;">🎯 TikTok Report Bot</span>
                        <div>
                            <span id="tt-minimize" style="cursor: pointer; margin-right: 10px;">−</span>
                            <span id="tt-close" style="cursor: pointer;">✕</span>
                        </div>
                    </div>
                    <div id="tt-main" style="padding: 15px;">
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: bold;">Số lần chạy:</label>
                            <input type="number" id="tt-loop" min="1" max="20" value="1" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: bold;">Your Username:</label>
                            <input type="text" id="tt-myuser" placeholder="@username" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: bold;">Target Username:</label>
                            <input type="text" id="tt-target" placeholder="@target" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: bold;">Email:</label>
                            <input type="email" id="tt-email" placeholder="you@example.com" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;">
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: bold;">Description:</label>
                            <textarea id="tt-desc" rows="3" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;">Underage user report. This user is under 13 years old.</textarea>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: bold;">Delay (giây):</label>
                            <input type="number" id="tt-delay" min="3" max="10" value="5" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 6px;">
                        </div>
                        <button id="tt-start" style="width: 100%; padding: 10px; background: #fe2c55; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 8px;">▶ BẮT ĐẦU</button>
                        <button id="tt-stop" style="width: 100%; padding: 10px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;" disabled>⏹ DỪNG</button>
                        <div id="tt-progress" style="height: 3px; background: #fe2c55; width: 0%; margin-top: 10px; border-radius: 3px;"></div>
                        <div id="tt-status" style="text-align: center; margin-top: 8px; font-size: 12px; font-weight: bold;">✅ Ready</div>
                        <div id="tt-log" style="background: #f5f5f5; height: 200px; overflow-y: auto; margin-top: 10px; padding: 8px; font-size: 11px; border-radius: 6px;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);

            document.getElementById('tt-start').onclick = () => this.start();
            document.getElementById('tt-stop').onclick = () => this.stop();
            document.getElementById('tt-close').onclick = () => panel.remove();
            document.getElementById('tt-minimize').onclick = () => {
                const main = document.getElementById('tt-main');
                main.style.display = main.style.display === 'none' ? 'block' : 'none';
            };

            this.makeDraggable(panel);
        }

        makeDraggable(panel) {
            const header = panel.querySelector('div:first-child');
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            header.onmousedown = (e) => {
                if (e.target === header || e.target.id === 'tt-minimize' || e.target.id === 'tt-close') return;
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = () => {
                    document.onmouseup = null;
                    document.onmousemove = null;
                };
                document.onmousemove = (e) => {
                    e.preventDefault();
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    panel.style.top = (panel.offsetTop - pos2) + 'px';
                    panel.style.left = (panel.offsetLeft - pos1) + 'px';
                    panel.style.right = 'auto';
                };
            };
        }

        saveSettings() {
            const settings = {
                loop: document.getElementById('tt-loop').value,
                myUser: document.getElementById('tt-myuser').value,
                targetUser: document.getElementById('tt-target').value,
                email: document.getElementById('tt-email').value,
                desc: document.getElementById('tt-desc').value,
                delay: document.getElementById('tt-delay').value
            };
            GM_setValue('tt_settings', JSON.stringify(settings));
        }

        loadSettings() {
            const saved = GM_getValue('tt_settings');
            if (saved) {
                try {
                    const s = JSON.parse(saved);
                    document.getElementById('tt-loop').value = s.loop || '1';
                    document.getElementById('tt-myuser').value = s.myUser || '';
                    document.getElementById('tt-target').value = s.targetUser || '';
                    document.getElementById('tt-email').value = s.email || '';
                    document.getElementById('tt-desc').value = s.desc || 'Underage user report.';
                    document.getElementById('tt-delay').value = s.delay || '5';
                } catch (e) { }
            }
        }
    }
})();