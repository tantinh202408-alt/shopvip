const crypto = require('crypto');
const axios = require('axios');
const https = require('https');

// Bỏ qua SSL verification (tương tự verify=False trong Python)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Domain list
const __domains = [
    "api22-core-c-useast1a.tiktokv.com",
    "api19-core-c-useast1a.tiktokv.com",
    "api16-core-c-useast1a.tiktokv.com",
    "api21-core-c-useast1a.tiktokv.com"
];

// Device list
const __devices = [
    "SM-G9900", "SM-A136U1", "SM-M225FV", "SM-E426B", "SM-M526BR",
    "SM-M326B", "SM-A528B", "SM-F711B", "SM-F926B", "SM-A037G",
    "SM-A225F", "SM-M325FV", "SM-A226B", "SM-M426B", "SM-A525F", "SM-N976N"
];

// Version list
const __versions = [
    "190303", "190205", "190204", "190103", "180904",
    "180804", "180803", "180802", "270204"
];

class Gorgon {
    constructor(params, data, cookies, unix) {
        this.unix = unix;
        this.params = params;
        this.data = data;
        this.cookies = cookies;
    }

    hash(data) {
        try {
            return crypto.createHash('md5').update(data).digest('hex');
        } catch (e) {
            return crypto.createHash('md5').update(String(data)).digest('hex');
        }
    }

    getBaseString() {
        let baseStr = this.hash(this.params);
        baseStr += this.data ? this.hash(this.data) : '0'.repeat(32);
        baseStr += this.cookies ? this.hash(this.cookies) : '0'.repeat(32);
        return baseStr;
    }

    reverse(num) {
        let tmpString = this.hexString(num);
        return parseInt(tmpString[1] + tmpString[0], 16);
    }

    rbitAlgorithm(num) {
        let result = '';
        let tmpString = num.toString(2);
        while (tmpString.length < 8) {
            tmpString = '0' + tmpString;
        }
        for (let i = 0; i < 8; i++) {
            result += tmpString[7 - i];
        }
        return parseInt(result, 2);
    }

    hexString(num) {
        let tmpString = num.toString(16);
        if (tmpString.length < 2) {
            tmpString = '0' + tmpString;
        }
        return tmpString;
    }

    encrypt(data) {
        const unix = this.unix;
        const lenVal = 20;
        const key = [223, 119, 185, 64, 185, 155, 132, 131, 209, 185, 203, 209, 247, 194, 185, 133, 195, 208, 251, 195];
        let paramList = [];

        for (let i = 0; i < 12; i += 4) {
            let temp = data.slice(8 * i, 8 * (i + 1));
            for (let j = 0; j < 4; j++) {
                let H = parseInt(temp.slice(j * 2, (j + 1) * 2), 16);
                paramList.push(H);
            }
        }

        paramList.push(...[0, 6, 11, 28]);
        
        let H = parseInt(unix.toString(16), 16);
        paramList.push((H & 0xff000000) >> 24);
        paramList.push((H & 0x00ff0000) >> 16);
        paramList.push((H & 0x0000ff00) >> 8);
        paramList.push((H & 0x000000ff) >> 0);
        
        let eorResultList = [];
        for (let i = 0; i < paramList.length; i++) {
            eorResultList.push(paramList[i] ^ key[i]);
        }

        for (let i = 0; i < lenVal; i++) {
            let C = this.reverse(eorResultList[i]);
            let D = eorResultList[(i + 1) % lenVal];
            let E = C ^ D;
            let F = this.rbitAlgorithm(E);
            let H = (F ^ 0xffffffff ^ lenVal) & 0xff;
            eorResultList[i] = H;
        }

        let result = '';
        for (let param of eorResultList) {
            result += this.hexString(param);
        }
        
        return {
            'X-Gorgon': '0404b0d30000' + result,
            'X-Khronos': String(unix)
        };
    }

    getValue() {
        const baseStr = this.getBaseString();
        return this.encrypt(baseStr);
    }
}

// Hàm tạo params URL
function buildParams(device_id, install_id) {
    const version = __versions[Math.floor(Math.random() * __versions.length)];
    const device_type = __devices[Math.floor(Math.random() * __devices.length)];
    
    const params = {
        os_api: "25",
        device_type: device_type,
        ssmix: "a",
        manifest_version_code: version,
        dpi: "240",
        region: "VN",
        carrier_region: "VN",
        app_name: "musically_go",
        version_name: "27.2.4",
        timezone_offset: "-28800",
        ab_version: "27.2.4",
        ac2: "wifi",
        ac: "wifi",
        app_type: "normal",
        channel: "googleplay",
        update_version_code: version,
        device_platform: "android",
        iid: install_id,
        build_number: "27.2.4",
        locale: "vi",
        op_region: "VN",
        version_code: version,
        timezone_name: "Asia/Ho_Chi_Minh",
        device_id: device_id,
        sys_region: "VN",
        app_language: "vi",
        resolution: "720*1280",
        device_brand: "samsung",
        language: "vi",
        os_version: "7.1.2",
        aid: "1340"
    };
    
    return new URLSearchParams(params).toString();
}

// Hàm gửi request view
async function sendView(aweme_id, device_id, install_id, cdid, openudid, proxy = null) {
    try {
        const params = buildParams(device_id, install_id);
        const payload = `item_id=${aweme_id}&play_delta=1`;
        const unixTime = Math.floor(Date.now() / 1000);
        
        const sig = new Gorgon(params, payload, null, unixTime).getValue();
        
        const domain = __domains[Math.floor(Math.random() * __domains.length)];
        const url = `https://${domain}/aweme/v1/aweme/stats/?${params}`;
        
        const headers = {
            'cookie': 'sessionid=90c38a59d8076ea0fbc01c8643efbe47',
            'x-gorgon': sig['X-Gorgon'],
            'x-khronos': sig['X-Khronos'],
            'user-agent': 'com.zhiliaoapp.musically/2022405030 (Linux; U; Android 12; vi_VN; SM-G9900; Build/TP1A.220624.014; Cronet/58.0.2991.0)',
            'content-type': 'application/x-www-form-urlencoded'
        };
        
        const requestConfig = {
            method: 'POST',
            url: url,
            data: payload,
            headers: headers,
            httpsAgent: httpsAgent
        };
        
        if (proxy) {
            requestConfig.proxy = {
                host: proxy.split(':')[0],
                port: parseInt(proxy.split(':')[1])
            };
        }
        
        const response = await axios(requestConfig);
        
        if (response.data && response.data.status_code === 0) {
            return { success: true, message: 'View added successfully' };
        } else {
            return { success: false, message: 'Failed to add view' };
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Hàm lấy video ID từ link
function extractVideoId(link) {
    const patterns = [
        /(\d{18,19})/,
        /video\/(\d+)/,
        /share\/video\/(\d+)/
    ];
    
    for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    // Nếu link ngắn, cần redirect
    if (link.includes('tiktok.com') && !link.includes('vm.tiktok')) {
        return null;
    }
    
    return null;
}

// Hàm fetch proxy từ các nguồn
async function fetchProxies() {
    const urlList = [
        "https://raw.githubusercontent.com/yemixzy/proxy-list/main/proxy-list/data.txt",
        "https://raw.githubusercontent.com/UptimerBot/proxy-list/main/proxies/http.txt",
        "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/http.txt",
        "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/socks4.txt",
        "https://raw.githubusercontent.com/rdavydov/proxy-list/main/proxies/socks5.txt"
    ];
    
    let allProxies = [];
    
    for (const url of urlList) {
        try {
            const response = await axios.get(url, { timeout: 5000 });
            if (response.data) {
                const proxies = response.data.split('\n').filter(line => line.trim());
                allProxies.push(...proxies);
            }
        } catch (error) {
            // Bỏ qua lỗi
        }
    }
    
    return [...new Set(allProxies)]; // Loại bỏ trùng lặp
}

// Hàm chính
async function main() {
    // Đọc cấu hình
    const fs = require('fs');
    let config = {
        proxy: {
            "use-proxy": false,
            "proxy-type": "http",
            "proxyscrape": true,
            "credential": "",
            "auth": false
        }
    };
    
    let devices = [];
    let link = null;
    
    // Đọc link từ file nếu có
    if (fs.existsSync('current_link.txt')) {
        link = fs.readFileSync('current_link.txt', 'utf8').trim();
        console.log(`\x1b[1;33m[+] Tự động lấy link: ${link}\x1b[0m`);
    }
    
    // Đọc devices
    if (fs.existsSync('devices.txt')) {
        devices = fs.readFileSync('devices.txt', 'utf8').split('\n').filter(line => line.trim());
    } else {
        fs.writeFileSync('devices.txt', 'did:iid:cdid:openudid');
        devices = ['did:iid:cdid:openudid'];
    }
    
    // Đọc config
    if (fs.existsSync('config.json')) {
        config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    } else {
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    }
    
    // Fetch proxies nếu cần
    let proxies = [];
    if (config.proxy['use-proxy'] && config.proxy['proxyscrape']) {
        proxies = await fetchProxies();
        console.log(`\x1b[1;32m[+] Fetched ${proxies.length} proxies\x1b[0m`);
    } else if (config.proxy['use-proxy'] && fs.existsSync('proxies.txt')) {
        proxies = fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(line => line.trim());
    }
    
    // Xóa màn hình
    console.clear();
    console.log('\x1b[1;34m TikTok View Bot \x1b[0m');
    
    // Nhập link nếu chưa có
    if (!link) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        link = await new Promise(resolve => {
            readline.question('\x1b[1;32m LINK VIDEO TikTok: \x1b[1;37m', resolve);
        });
        readline.close();
    }
    
    // Trích xuất video ID
    let aweme_id = extractVideoId(link);
    if (!aweme_id) {
        console.log('\x1b[1;31m INVALID LINK\x1b[0m');
        process.exit(1);
    }
    
    console.log(`\x1b[1;32m[+] Video ID: ${aweme_id}\x1b[0m`);
    console.log('\x1b[1;37m- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\x1b[0m');
    
    let success = 0;
    let fails = 0;
    let reqs = 0;
    
    // Stats loop
    setInterval(() => {
        process.stdout.write(`\r\x1b[1;31m[SD\x1b[0m] \x1b[1;32mDONE: ${success} \x1b[1;34m| \x1b[1;31mFAIL: ${fails} \x1b[1;34m| \x1b[1;33mREQS: ${reqs}\x1b[0m`);
    }, 1000);
    
    // Main loop - gửi view liên tục
    while (true) {
        try {
            const device = devices[Math.floor(Math.random() * devices.length)];
            const [did, iid, cdid, openudid] = device.split(':');
            
            const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
            const proxyConfig = config.proxy['use-proxy'] && proxy ? 
                (config.proxy['proxy-type'].toLowerCase() === 'http' ? proxy : null) : null;
            
            const result = await sendView(aweme_id, did, iid, cdid, openudid, proxyConfig);
            
            reqs++;
            if (result.success) {
                success++;
            } else {
                fails++;
            }
            
            // Điều chỉnh tốc độ
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            fails++;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

// Export các class và function để sử dụng
module.exports = {
    Gorgon,
    sendView,
    extractVideoId,
    fetchProxies
};

// Chạy chương trình nếu file được chạy trực tiếp
if (require.main === module) {
    main().catch(console.error);
}