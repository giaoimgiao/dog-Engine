import type { BookSource } from './types';
import { VM } from 'vm2';
import * as cheerio from 'cheerio';
import { getAuth } from './book-source-auth';

// 重新导出书源存储函数以保持向后兼容
export { getBookSources, saveBookSources } from './book-source-storage';
export { parseRuleWithCssJs } from './book-source-rule-parser';

// 全局变量存储，用于 java.put/get 跨sandbox共享
const globalJavaVariables = new Map<string, any>();

const getHostsFromComment = (comment: string = '', jsLib: string = '', loginUrl: string = ''): string[] => {
    const combinedScript = `${comment}\n${jsLib}\n${loginUrl}`;
    
    // 方法1: 查找 const host = [...]
    let match = combinedScript.match(/const\s+host\s*=\s*(\[[\s\S]*?\])/);
    if (match && match[1]) {
        try {
            const vm = new VM();
            return vm.run(`module.exports = ${match[1]};`);
        } catch (e) {
            // console.error('Could not parse hosts from script', e);
        }
    }
    
    // 方法2: 查找 encodedEndpoints（大灰狼书源格式）
    match = combinedScript.match(/const\s+encodedEndpoints\s*=\s*\[([\s\S]*?)\];/);
    if (match && match[1]) {
        try {
            // 提取所有单引号包裹的字符串
            const base64Strings = match[1].match(/'([^']+)'/g) || [];
            console.log(`[getHostsFromComment] 找到 ${base64Strings.length} 个 encodedEndpoints`);
            
            const decodedHosts = base64Strings
                .map(s => s.replace(/'/g, '').trim())
                .filter(s => s.length > 0)
                .map(b64 => {
                    try {
                        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
                        // console.log(`[getHostsFromComment] 解码: ${b64.substring(0, 20)}... → ${decoded}`);
                        return decoded;
                    } catch (e) {
                        // console.error(`[getHostsFromComment] Base64解码失败: ${b64}`, e);
                        return null;
                    }
                })
                .filter(h => h && (h.startsWith('http://') || h.startsWith('https://')));
            
            if (decodedHosts.length > 0) {
                // console.log(`[getHostsFromComment] ✅ 从 encodedEndpoints 解码得到 ${decodedHosts.length} 个有效服务器`);
                return decodedHosts as string[];
            } else {
                // console.log(`[getHostsFromComment] ⚠️ encodedEndpoints 解码后没有有效的HTTP服务器`);
            }
        } catch (e) {
            // console.error('[getHostsFromComment] 解析 encodedEndpoints 失败:', e);
        }
    } else {
        // console.log(`[getHostsFromComment] 未找到 encodedEndpoints 定义`);
    }
    
    return [];
};


const createSandbox = (source: BookSource | undefined, key?: string, page?: number, result?: any, overrideBaseUrl?: string, sharedVariables?: Record<string, any>) => {
    const hosts = getHostsFromComment(source?.comment, source?.jsLib, source?.loginUrl);
    // console.log(`[createSandbox] 为书源 "${source?.name}" 提取到 ${hosts.length} 个服务器:`, hosts.length > 0 ? hosts[0] : '无');
    // console.log(`[createSandbox] source.jsLib存在: ${!!source?.jsLib}, 长度: ${source?.jsLib?.length || 0}`);
    
    // 初始化运行时配置：如果没有保存的变量，使用默认值
    const defaultConfig = {
        server: hosts.length > 0 ? hosts[0] : '',
        media: '小说',
        tone_id: '默认音色',
        source: '全部',
        source_type: '男频'
    };
    
    const variableMap: Record<string, any> = {
        _open_argument: (source as any)?.variable || JSON.stringify(defaultConfig),
        ...(sharedVariables || {})  // 合并共享变量
    };

    // console.log(`[createSandbox] 初始化变量:`, variableMap._open_argument);
    
    const sandbox = {
        java: {
            ajax: (url: string) => {
                // 🔧 同步网络请求 - 使用 sync-fetch 或 deasync
                console.log(`[Mock] java.ajax called: ${url.substring(0, 200)}`);
                try {
                    if (typeof window === 'undefined') {
                        let actualUrl = String(url);
                        let options: any = {};
                        
                        // 处理 Legado 格式: URL,{options}
                        if (actualUrl.includes(',{')) {
                            const parts = actualUrl.split(',{');
                            actualUrl = parts[0];
                            try {
                                const optsJson = '{' + parts.slice(1).join(',{');
                                options = JSON.parse(optsJson);
                            } catch (e) {
                                options = {};
                            }
                        }
                        
                        // 合并 headers（包含从 auth 注入的 cookie/qtoken）
                        let headers: Record<string, string> = {
                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
                            'Accept': 'application/json,text/plain,*/*',
                            'versiontype': 'reading',
                        };
                        if (options && options.headers && typeof options.headers === 'object') {
                            for (const k of Object.keys(options.headers)) {
                                headers[k] = String(options.headers[k]);
                            }
                        }
                        
                        // 如果未显式传 Cookie，尝试从 auth 中注入
                        try {
                            if (source?.id) {
                                const auth = getAuthSync(source.id);
                                const cookieFromAuth = getCookieStringForUrl(auth, actualUrl);
                                if (cookieFromAuth) {
                                    if (!headers['Cookie'] && !headers['cookie']) headers['Cookie'] = cookieFromAuth;
                                }
                            }
                        } catch {}
                        
                        // 使用 child_process.spawnSync 执行 curl（更可靠）
                        const { spawnSync } = require('child_process');
                        
                        const args = [
                            '-s',  // silent
                            '-L',  // follow redirects
                            '-m', '8',  // max time 8 seconds
                        ];
                        // 追加常用 headers
                        let referer = '';
                        try { const u = new URL(actualUrl); referer = `${u.protocol}//${u.host}/`; } catch {}
                        if (!headers['Accept']) headers['Accept'] = 'application/json,text/plain,*/*';
                        if (!headers['User-Agent']) headers['User-Agent'] = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36';
                        if (!headers['versiontype']) headers['versiontype'] = 'reading';
                        if (referer && !headers['Referer']) headers['Referer'] = referer;
                        
                        // POST 自动补充 content-type
                        const method = (options && typeof options.method === 'string') ? options.method.toUpperCase() : 'GET';
                        if (method === 'POST') {
                            const hasCT = Object.keys(headers).some(k => k.toLowerCase() === 'content-type');
                            if (!hasCT && typeof options.body === 'string') {
                                headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
                            }
                        }
                        // 追加 headers
                        Object.keys(headers).forEach((k) => {
                            if (headers[k]) {
                                args.push('-H', `${k}: ${headers[k]}`);
                            }
                        });
                        
                        // 支持 POST 与 body
                        if (method === 'POST') {
                            args.push('-X', 'POST');
                            if (typeof options.body === 'string' && options.body.length > 0) {
                                args.push('--data', options.body);
                            } else if (options.body && typeof options.body === 'object') {
                                try { args.push('--data', new URLSearchParams(options.body).toString()); } catch {}
                            }
                        }
                        args.push(actualUrl);
                        
                        const result = spawnSync('curl', args, {
                            encoding: 'utf-8',
                            timeout: 10000,
                            maxBuffer: 10 * 1024 * 1024  // 10MB
                        });
                        
                        if (result.error) {
                            console.warn(`[Mock] java.ajax curl not available:`, result.error.message);
                            console.log(`[Mock] java.ajax falling back to Node.js https module...`);
                            
                            // Fallback: 使用 deasync 实现真正的同步请求
                            try {
                                console.log(`[Mock] java.ajax trying deasync fallback...`);
                                
                                // 方法1: 尝试使用 deasync（如果已安装）
                                try {
                                    const deasync = require('deasync');
                                    let done = false;
                                    let responseData = '';
                                    let requestError: any = null;
                                    
                                    fetch(actualUrl, {
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
                                            'Accept': 'application/json,text/plain,*/*',
                                            'versiontype': 'reading'
                                        }
                                    })
                                    .then(res => res.text())
                                    .then(text => {
                                        responseData = text;
                                        done = true;
                                    })
                                    .catch(err => {
                                        requestError = err;
                                        done = true;
                                    });
                                    
                                    // 同步等待
                                    deasync.loopWhile(() => !done);
                                    
                                    if (requestError) {
                                        throw requestError;
                                    }
                                    
                                    console.log(`[Mock] java.ajax (deasync) succeeded, response length: ${responseData.length}`);
                                    return responseData;
                                } catch (deasyncError: any) {
                                    if (deasyncError.code === 'MODULE_NOT_FOUND') {
                                        console.log(`[Mock] deasync not installed, using simple fallback...`);
                                    } else {
                                        console.error(`[Mock] deasync error:`, deasyncError.message);
                                    }
                                    
                                    // 方法2: 返回空数据，让书源使用默认分类
                                    console.warn(`[Mock] java.ajax 无法同步执行，返回空数据`);
                                    return JSON.stringify({ data: [] });
                                }
                            } catch (fallbackError: any) {
                                console.error(`[Mock] java.ajax fallback failed:`, fallbackError.message);
                                return JSON.stringify({ data: [] });
                            }
                        }
                        
                        if (result.status !== 0) {
                            console.error(`[Mock] java.ajax curl exit code:`, result.status, result.stderr);
                            return JSON.stringify({ data: [] });
                        }
                        
                        const responseData = result.stdout || '';
                        // 精简日志：只在失败或异常时输出
                        if (result.stderr || responseData.length === 0 || (responseData.trim().startsWith('<') && responseData.includes('<html'))) {
                            console.log(`[Mock] java.ajax: ${actualUrl.substring(0,80)}... [${method}] 响应:${responseData.length}字节`);
                            if (responseData.trim().startsWith('<') && responseData.includes('<html')) {
                                console.error(`  ❌ 返回HTML错误页`);
                            }
                        }
                        return responseData;
                    } else {
                        // 客户端：无法同步请求
                        console.warn(`[Mock] ⚠️ java.ajax 在浏览器中无法同步执行`);
                        return JSON.stringify({ data: [] });
                    }
                } catch (e) {
                    console.error(`[Mock] java.ajax failed:`, e);
                return JSON.stringify({ data: [] });
                }
            },
            put: (key: string, value: any) => { 
                variableMap[key] = value;
                // 保存到全局存储，让不同sandbox能共享
                globalJavaVariables.set(key, value);
                // console.log(`[Mock] ✓ java.put: ${key} = ${String(value).substring(0, 100)}`);
            },
            get: (arg: string, _opts?: any) => {
                // Overloaded: when arg looks like URL → do HTTP GET and return { body(), header(name) }
                // otherwise → act as key-value getter
                // 判断是 HTTP 请求还是 key-value getter
                if (typeof arg === 'string' && (/^https?:\/\//i.test(arg) || /^data:/i.test(arg))) {
                    // console.log(`[Mock] java.get: 请求 URL = ${arg.substring(0, 200)}`);
                    try {
                        if (typeof window === 'undefined') {
                            const { execSync } = require('child_process');
                            let referer = '';
                            try { const u = new URL(arg); referer = `${u.protocol}//${u.host}/`; } catch {}
                            const command = `curl -i -s -L \
 -H "User-Agent: Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36" \
 -H "Accept: application/json,text/plain,*/*" \
 -H "versiontype: reading" \
 ${referer ? `-H "Referer: ${referer}"` : ''} \
 "${arg}"`;
                            const resp = execSync(command, { encoding: 'utf-8', timeout: 10000 });
                            const parts = resp.split(/\r?\n\r?\n/);
                            let headerText = '';
                            let bodyText = '';
                            if (parts.length >= 2) {
                                headerText = parts.slice(0, -1).join('\n\n');
                                bodyText = parts[parts.length - 1];
                            } else {
                                bodyText = resp;
                            }
                            const headers: Record<string, string> = {};
                            headerText.split(/\r?\n/).forEach((line: string) => {
                                const idx = line.indexOf(':');
                                if (idx > 0) {
                                    const k = line.substring(0, idx).trim().toLowerCase();
                                    const v = line.substring(idx + 1).trim();
                                    if (k) headers[k] = v;
                                }
                            });
                            // console.log(`[Mock] java.get body length: ${bodyText.length}`);
                            return {
                                body: () => bodyText,
                                header: (name: string) => headers[String(name || '').toLowerCase()] || ''
                            };
                        }
                    } catch (e: any) {
                        console.warn('[Mock] java.get http failed:', (e && e.message) || e);
                    }
                    // HTTP 分支失败，返回空响应对象
                    return { body: () => '', header: (_: string) => '' };
                }
                // key-value getter - 优先从全局存储读取
                const value = globalJavaVariables.get(arg) ?? variableMap[arg as any];
                // console.log(`[Mock] java.get: ${arg} = ${String(value).substring(0, 100)}`);
                return value;
            },
            base64Encode: (str: string) => Buffer.from(str).toString('base64'),
            base64Decode: (str: string) => Buffer.from(str, 'base64').toString('utf-8'),
            hexDecodeToString: (input: string) => {
                const inputStr = String(input || '');
                    // console.log(`[hexDecodeToString] 输入: ${inputStr.substring(0, 100)}`);
                
                // 大灰狼书源场景：data URL已经解码过了，传入的是UTF-8字符串
                // 格式：7046844484302144036大灰狼融合4小说大灰狼融合4第1章...
                // 如果包含中文或其他非ASCII字符，直接返回
                if (/[^\x00-\x7F]/.test(inputStr)) {
                    // console.log(`[hexDecodeToString] ✓ 检测到非ASCII字符（包含中文），直接返回`);
                    return inputStr;
                }
                
                // 只有纯hex字符串才尝试hex解码
                if (/^[0-9a-fA-F]+$/.test(inputStr) && inputStr.length % 2 === 0) {
                    try {
                        const decoded = Buffer.from(inputStr, 'hex').toString('utf-8');
                        // console.log(`[hexDecodeToString] ✓ Hex解码成功: ${inputStr.substring(0, 20)}... -> ${decoded.substring(0, 50)}...`);
                        return decoded;
                    } catch (e) {
                        // console.warn(`[hexDecodeToString] ✗ Hex解码失败，返回原字符串`);
                        return inputStr;
                    }
                }
                
                // 其他情况直接返回
                // console.log(`[hexDecodeToString] ✓ 非hex格式，直接返回`);
                return inputStr;
            },
            createSymmetricCrypto: (algorithm: string, key: string, iv: string) => {
                // Support DES/CBC/PKCS5Padding decrypt used in 晋江
                // console.log(`[Mock] java.createSymmetricCrypto: ${algorithm}`);
                const crypto = require('crypto');
                const algo = algorithm && /DES\/CBC/i.test(algorithm) ? 'des-cbc' : 'des-cbc';
                const keyBuf = Buffer.from(key, 'utf8');
                const ivBuf = Buffer.from(iv, 'utf8');
                return {
                    encryptBase64: (data: string) => {
                        try {
                            const cipher = crypto.createCipheriv(algo, keyBuf, ivBuf);
                            let enc = cipher.update(data, 'utf8', 'base64');
                            enc += cipher.final('base64');
                            return enc;
                        } catch (e: any) {
                            console.warn('[Mock] encryptBase64 failed:', (e && e.message) || e);
                        return Buffer.from(data).toString('base64');
                        }
                    },
                    decryptStr: (data: string) => {
                        try {
                            // Try base64 first; fallback to hex/raw
                            let buf: Buffer;
                            try { buf = Buffer.from(data, 'base64'); } catch { buf = Buffer.from(data, 'hex'); }
                            const decipher = crypto.createDecipheriv(algo, keyBuf, ivBuf);
                            let dec = decipher.update(buf, undefined, 'utf8');
                            dec += decipher.final('utf8');
                            return dec;
                        } catch (e: any) {
                            console.warn('[Mock] decryptStr failed:', (e && e.message) || e);
                            return '';
                        }
                    }
                };
            },
            md5Encode: (str: string) => {
                const crypto = require('crypto');
                return crypto.createHash('md5').update(String(str), 'utf8').digest('hex');
            },
            // 提供 getString(rule) 以便 @js: 中快速按规则提取字符串
            getString: (rule: string) => {
                try {
                    const htmlOrJson = (sandbox as any).result ?? '';
                    const base = (sandbox as any).baseUrl || '';
                    return parseWithRules(htmlOrJson, String(rule), base, source);
                } catch (e) {
                    return '';
                }
            },
            setContent: (content: string) => {
                // console.log(`[Mock] java.setContent called, content length: ${content.length}`);
                variableMap['_jjcontent_'] = content;
                // 关键：更新 sandbox 的 result，让后续的模板 {{$.xxx}} 能正确解析
                try {
                    if (typeof content === 'string' && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
                        const parsed = JSON.parse(content);
                        (sandbox as any).result = parsed;
                        // console.log(`[Mock] java.setContent: 已更新 sandbox.result 为解析后的JSON对象`);
                    }
                } catch (e) {
                    // console.warn(`[Mock] java.setContent: JSON解析失败，保持原样`);
                }
            },
            getElement: (selector: string) => {
                // console.log(`[Mock] java.getElement: ${selector}`);
                return { 
                    text: () => '',
                    html: () => ''
                };
            },
            // Mock Android APP methods
            log: (msg: any) => {
                // console.log(`[Mock] java.log:`, msg);
            },
            toast: (msg: string) => {
                console.log(`[Mock] java.toast: ${msg}`);
            },
            longToast: (msg: string) => {
                console.log(`[Mock] java.longToast: ${msg}`);
            },
            androidId: () => {
                // Mock返回null，表示不是Android环境
                return null;
            },
            deviceID: () => {
                // Mock返回null，表示没有设备ID
                return null;
            },
            getCookie: (domain: string) => {
                try {
                    const auth = source?.id ? getAuthSync(source.id) : null;
                    const cookie = getCookieStringForUrl(auth, domain);
                    console.log(`[Mock] java.getCookie: domain="${domain}", sourceId="${source?.id}", cookie="${cookie.substring(0, 100)}${cookie.length > 100 ? '...' : ''}"`);
                    return cookie || '';
                } catch (e: any) {
                    console.error(`[Mock] java.getCookie error:`, e.message);
                return '';
                }
            },
            startBrowser: (url: string, title: string) => {
                // console.log(`[Mock] java.startBrowser: ${url}, title: ${title}`);
            },
            startBrowserAwait: (url: string, title: string) => {
                // console.log(`[Mock] java.startBrowserAwait: ${url}, title: ${title}`);
            },
        },
        // 安全 eval：
        // - 若传入是正文/HTML/纯文本（包含大量非ASCII或HTML标签），直接原样返回，避免误清空
        // - 其它短小的JS表达式，使用独立vm沙箱限时执行，并返回其结果字符串
        eval: (code: any) => {
            try {
                const str = typeof code === 'string' ? code : String(code ?? '');
                // 判定为"很可能是正文/HTML/长文本"
                const hasHtml = /<[^>]+>/.test(str);
                const nonAsciiRatio = (() => {
                    const len = str.length || 1; let nonAscii = 0; for (let i = 0; i < Math.min(len, 2000); i++) { if (str.charCodeAt(i) > 127) nonAscii++; }
                    return nonAscii / Math.min(len, 2000);
                })();
                const isLong = str.length > 400; // 正文通常较长
                if (hasHtml || nonAsciiRatio > 0.1 || isLong) {
                    return str; // 视为正文/HTML，不执行
                }
                // 对短JS尝试安全执行
                try {
                    const { VM } = require('vm2');
                    const miniVm = new VM({ timeout: 500, sandbox: {} });
                    const result = miniVm.run(str);
                    return typeof result === 'string' ? result : String(result ?? '');
                } catch {
                    return str; // 执行失败则原样返回
                }
            } catch {
                return code;
            }
        },
        localStorage: {
            _storage: new Map<string, string>(),
            getItem: function(key: string) {
                // console.log(`[Mock] localStorage.getItem: ${key}`);
                return this._storage.get(key) || null;
            },
            setItem: function(key: string, value: string) {
                // console.log(`[Mock] localStorage.setItem: ${key} = ${value}`);
                this._storage.set(key, String(value));
            },
            removeItem: function(key: string) {
                // console.log(`[Mock] localStorage.removeItem: ${key}`);
                this._storage.delete(key);
            },
            clear: function() {
                // console.log(`[Mock] localStorage.clear`);
                this._storage.clear();
            }
        },
        cookie: {
            getCookie: (url: string) => {
                try {
                    const auth = source?.id ? getAuthSync(source.id) : null;
                    const cookie = getCookieStringForUrl(auth, url);
                    console.log(`[Mock] cookie.getCookie: url="${url}", sourceId="${source?.id}", cookie="${cookie.substring(0, 100)}${cookie.length > 100 ? '...' : ''}"`);
                    return cookie || '';
                } catch (e: any) {
                    console.error(`[Mock] cookie.getCookie error:`, e.message);
                return '';
                }
            }
        },
        cache: {
            get: (key: string) => {
                // console.log(`[Mock] cache.get: ${key}`);
                return null;
            },
            put: (key: string, value: any) => {
                // console.log(`[Mock] cache.put: ${key} = ${value}`);
            }
        },
        source: {
            ...source,
            getVariable: () => variableMap._open_argument,
            setVariable: (v: string) => { variableMap._open_argument = v; },
            getLoginInfoMap: () => {
                // console.log(`[Mock] source.getLoginInfoMap`);
                return {};
            },
            getLoginHeaderMap: () => {
                // console.log(`[Mock] source.getLoginHeaderMap`);
                return { get: (key: string) => variableMap[key] || '' };
            }
        },
        key: key || '',
        page: page || 1,
        result,
        baseUrl: overrideBaseUrl || source?.url || '',
        // 🔧 Legado 常用全局辅助函数
        bDe: (str: string) => {
            // 仅解码 data:*base64, 后的有效部分，避免误把整串当作base64
            try {
                if (typeof str !== 'string') return str as any;
                const m = str.match(/base64,([^,}]+)$/);
                if (m) {
                    return Buffer.from(m[1], 'base64').toString('utf-8');
                }
                // 尝试普通base64
                if (/^[A-Za-z0-9+/=]+$/.test(str)) {
                    return Buffer.from(str, 'base64').toString('utf-8');
                }
                return str;
            } catch (e) {
                return str;
            }
        },
        bEn: (str: string) => {
            // base64 encode
            return Buffer.from(str).toString('base64');
        },
        getNid: (url: string) => {
            // 从 URL 中提取小说ID (novelId)
            // 支持多种格式：novelId=xxx, novelId:xxx, 或 base64 编码的
            // console.log(`[getNid] 输入 URL: ${url}`);
            try {
                // 先尝试直接匹配
                let match = url.match(/novelId[=:](\d+)/i);
                if (match) {
                    // console.log(`[getNid] 直接匹配成功: ${match[1]}`);
                    return match[1];
                }
                
                // 尝试 base64 decode
                if (url.includes('base64,')) {
                    const base64Part = url.split('base64,')[1].split(',')[0];
                    // console.log(`[getNid] Base64 部分: ${base64Part}`);
                    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
                    // console.log(`[getNid] 解码后: ${decoded}`);
                    match = decoded.match(/novelId[=:](\d+)/i);
                    if (match) {
                        // console.log(`[getNid] Base64 解码后匹配成功: ${match[1]}`);
                        return match[1];
                    }
                }
                
                // console.warn(`[getNid] 未能提取 novelId`);
                return '';
            } catch (e) {
                // console.error(`[getNid] 错误:`, e);
                return '';
            }
        },
        Map: (key: string) => {
            // 获取存储的登录信息
            return variableMap[key] || '';
        },
        encode: (str: string) => {
            // URL 编码或加密（简化实现）
            // 晋江用这个函数生成签名，具体算法不明，先返回 base64
            return Buffer.from(str).toString('base64');
        },
        book: {
            ...(result || {}),
            getVariable: (key: string) => {
                // 获取书籍变量
                return variableMap[`book_${key}`] || '';
            },
            setVariable: (key: string, value: any) => {
                // 设置书籍变量
                variableMap[`book_${key}`] = value;
            }
        },
        chapter: result || {},        // 添加chapter对象
        getArguments: (open_argument: string, key: string) => {
            let args;
            try {
                args = JSON.parse(open_argument);
            } catch (e) {
                args = {};
            }
            
            const defaults = {
                "media": "小说",
                "server": hosts.length > 0 ? hosts[0] : "",
                "source": "番茄",  // 默认来源为"番茄"，而不是书源名称
                "source_type": "男频",
            };
            const finalArgs = { ...defaults, ...args };
            
            if (key === 'server') {
                console.log(`[getArguments] 返回 server = "${finalArgs[key]}" (来自: ${args.server ? '用户配置' : '默认值'})`);
            }
            
            return key ? finalArgs[key] : finalArgs;
        },
        // 添加 Date 对象和其他全局变量（明确指定属性名）
        Date: Date,
        String: String,
        Number: Number,
        JSON: JSON,
        Math: Math,
        Object: Object,
        Array: Array,
    };
    
    // 加载jsLib中的函数到sandbox - 需要在同一个VM实例中
    if(source?.jsLib) {
        // console.log(`[createSandbox] 加载jsLib，长度: ${source.jsLib.length}`);
        try {
            // 创建VM并运行jsLib
            const libVm = new VM({ sandbox, eval: true });
            libVm.run(source.jsLib);
            
            // VM运行后，函数会被定义到sandbox中
            // 检查常用函数是否加载成功
            const commonFuncs = ['decrypt', 'cleanHTML', 'getComments', 'getArguments'];
            let loadedCount = 0;
            const sandboxAny = sandbox as any;
            commonFuncs.forEach(funcName => {
                if (typeof sandboxAny[funcName] === 'function') {
                    // console.log(`[createSandbox] ✓ 函数 ${funcName} 已加载`);
                    loadedCount++;
                } else {
                    console.warn(`[createSandbox] ✗ 函数 ${funcName} 未找到`);
                }
            });
            // console.log(`[createSandbox] jsLib加载完成，成功加载 ${loadedCount}/${commonFuncs.length} 个常用函数`);
        } catch (e: any) {
            console.error(`[createSandbox] ❌ jsLib加载失败:`, e.message);
            console.error(`  - 错误堆栈:`, e.stack?.split('\n').slice(0, 3).join('\n'));
        }
    }
    
    // Fallback：若关键函数仍不存在，提供默认实现，避免章节JS报错
    const sx: any = sandbox as any;
    if (typeof sx.decrypt !== 'function') {
        sx.decrypt = (text: string) => String(text ?? '');
        // console.log('[createSandbox] ⚙️ 注入默认 decrypt');
    }
    if (typeof sx.cleanHTML !== 'function') {
        sx.cleanHTML = (html: string) => {
            try {
                const noHeader = String(html || '').replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
                const noTags = noHeader.replace(/<(?!\/?p\b|\/?img\b)[^>]+>/gi, '');
                return noTags.replace(/<\/?p[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();
            } catch {
                return String(html || '');
            }
        };
        // console.log('[createSandbox] ⚙️ 注入默认 cleanHTML');
    }
    if (typeof sx.getComments !== 'function') {
        sx.getComments = (content: string) => String(content ?? '');
        // console.log('[createSandbox] ⚙️ 注入默认 getComments');
    }
    
    return sandbox;
};

// 同步读取 auth（阻塞式）用于在同步的 java.ajax/cookie.getCookie 中使用
function getAuthSync(sourceId: string) {
    try {
        const fs = require('fs');
        const path = require('path');
        const isVercel = !!process.env.VERCEL;
        const dataFilePath = isVercel
          ? path.join('/tmp', 'book_source_auth.json')
          : path.join(process.cwd(), 'book_source_auth.json');
        let txt = '[]';
        try { txt = fs.readFileSync(dataFilePath, 'utf-8'); } catch {}
        let list = [] as any[];
        try { list = JSON.parse(txt); } catch { list = []; }
        return list.find((a: any) => a.sourceId === sourceId) || null;
    } catch { return null; }
}

// 根据 URL 或域名拼接 Cookie（支持自定义 tokens.key -> qttoken）
function getCookieStringForUrl(auth: any, urlOrDomain: string): string {
    try {
        if (!auth) {
            console.log(`[getCookieStringForUrl] ✗ auth为空`);
            return '';
        }
        
        let hostname = '';
        try { const u = new URL(urlOrDomain); hostname = u.origin; } catch { hostname = urlOrDomain; }
        // console.log(`[getCookieStringForUrl] 查找cookie，url="${urlOrDomain}", hostname="${hostname}"`);
        
        const cookiesMap = auth.cookies || {};
        // console.log(`[getCookieStringForUrl] cookiesMap keys:`, Object.keys(cookiesMap));
        
        let cookie = cookiesMap[hostname] || cookiesMap[(() => { try { return new URL(urlOrDomain).host; } catch { return ''; } })()] || cookiesMap[(() => { try { return new URL(urlOrDomain).hostname; } catch { return ''; } })()] || '';
        // console.log(`[getCookieStringForUrl] 从cookiesMap获取的cookie: ${cookie ? cookie.substring(0, 50) + '...' : '(空)'}`);
        
        // 合并番茄/字节系登录cookie（若目标是大灰狼API，通常需要这些）
        try {
            const isQingtianApi = /api\.langge\.cf|langge\./.test(hostname);
            if (isQingtianApi) {
                const extraDomains = [
                    'https://fanqienovel.com',
                    'fanqienovel.com',
                    'https://www.fanqienovel.com',
                    'snssdk.com',
                    'https://snssdk.com'
                ];
                const extras: string[] = [];
                for (const d of extraDomains) {
                    const c = cookiesMap[d];
                    if (c && c.trim()) extras.push(c);
                }
                if (extras.length > 0) {
                    cookie = [cookie, ...extras].filter(Boolean).join('; ');
                    // console.log(`[getCookieStringForUrl] 合并fanqie/snssdk cookie`);
                }
            }
        } catch {}

        // 保留原始 cookie（不再过滤 __next_*），以免影响第三方接口依赖的会话
        // if (cookie) { console.log(`[getCookieStringForUrl] 使用原始cookie长度: ${cookie.length}`); }
        
        // 若无 cookie，但有 tokens.key（你提供的 key），拼成 qttoken
        const tokens = auth.tokens || {};
        // console.log(`[getCookieStringForUrl] tokens.key: ${tokens.key ? tokens.key.substring(0, 20) + '...' : '(无)'}`);
        
        if ((!cookie || !/qttoken=/.test(cookie)) && tokens.key) {
            cookie = cookie ? `${cookie}; qttoken=${tokens.key}` : `qttoken=${tokens.key}`;
            // console.log(`[getCookieStringForUrl] ✓ 添加qttoken后: ${cookie.substring(0, 100)}...`);
        }
        
        return cookie;
    } catch (e: any) {
        console.error(`[getCookieStringForUrl] ✗ 错误:`, e.message);
        return '';
    }
}

export async function evaluateJs(script: string, context: { key?: string, page?: number, source?: BookSource, result?: any, cheerioElements?: any, baseUrl?: string, sharedVariables?: Record<string, any> }): Promise<string> {
    let result: string;
    const sandbox = createSandbox(context.source, context.key, context.page, context.result, context.baseUrl, context.sharedVariables);
    if (context.cheerioElements) {
        (sandbox as any).$ = context.cheerioElements;
    }
    const vm = new VM({ timeout: 15000, sandbox, eval: false, wasm: false });

    if (!script.startsWith('<js>')) {
        result = script;
    } else {
        // 正确提取 <js> 和 </js> 之间的内容
        const endTag = '</js>';
        const endIndex = script.indexOf(endTag);
        let jsCode: string;
        
        if (endIndex === -1) {
            // 没有结束标记，使用旧逻辑
            jsCode = script.substring(4, script.length - 5);
        } else {
            // 找到结束标记，只提取到结束标记为止
            jsCode = script.substring(4, endIndex);
        }
        
        // 如果JS代码最后一行是变量赋值且没有return，自动添加return
        // 例如："content_url = xxx" → 自动 return content_url
        const lastLineMatch = jsCode.match(/\n\s*(\w+)\s*=.*$/);
        if (lastLineMatch && !jsCode.includes('return ')) {
            const varName = lastLineMatch[1];
            jsCode = jsCode + `\n${varName}`;
        }
        
        console.log(`[evaluateJs] 执行JS代码，长度: ${jsCode.length}，前200字符: ${jsCode.substring(0, 200)}`);
        try {
            const vmResult = vm.run(jsCode);
            result = String(vmResult);
            console.log(`[evaluateJs] ✅ JS执行成功，结果长度: ${result.length}，前200字符: ${result.substring(0, 200)}`);
            
            // 处理 </js> 后面的规则，如 $.content
            if (endIndex !== -1 && endIndex + endTag.length < script.length) {
                const afterJs = script.substring(endIndex + endTag.length).trim();
                if (afterJs && afterJs.startsWith('$.')) {
                    console.log(`[evaluateJs] 处理JS后的规则: ${afterJs}`);
                    try {
                        // 将JS结果解析为JSON，然后应用JSON path
                        const jsResultObj = JSON.parse(result);
                        const keys = afterJs.substring(2).split('.');
                        let value: any = jsResultObj;
                        for (const k of keys) {
                            if (value && typeof value === 'object') {
                                value = value[k];
                            } else {
                                break;
                            }
                        }
                        if (value !== undefined) {
                            result = String(value);
                            console.log(`[evaluateJs] 应用规则${afterJs}后，结果长度: ${result.length}`);
                        }
        } catch (e: any) {
                        console.warn(`[evaluateJs] 无法解析JS结果或应用规则${afterJs}:`, e.message);
                    }
                }
            }
        } catch (e: any) {
            console.error("[evaluateJs] ❌ JS执行失败:", e.message);
            console.error("  - 错误堆栈:", e.stack?.split('\n').slice(0, 5).join('\n'));
            console.error("  - Script前500字符:", jsCode.substring(0, 500) + "...");
            // 不要抛出错误，返回空字符串，让解析继续
            // 这样可以容错处理复杂的多段 JS 规则
            result = '';
        }
    }

    // 占位符替换
    const currentPage = context.page || 1;
    result = result
        .replace(/\{\{key\}\}/g, context.key || '')
        .replace(/\{\{page\}\}/g, String(currentPage))
        .replace(/\{\{source\}\}/g, context.source?.name || '')
        .replace(/\{\{baseUrl\}\}/g, context.baseUrl || '');

    // 支持 {{source.xxx}} 访问书源字段
    result = result.replace(/\{\{\s*source\.(\w+)\s*\}\}/g, (_m, prop) => {
        try { return String((context.source as any)?.[prop] ?? ''); } catch { return ''; }
    });

    // 简单表达式：{{page -1}} / {{page+1}}
    result = result.replace(/\{\{\s*page\s*([+-])\s*(\d+)\s*\}\}/g, (_m, op, num) => {
        const n = parseInt(num, 10) || 0;
        const value = op === '+' ? currentPage + n : currentPage - n;
        return String(value);
    });

    // 支持调用 jsLib 中的 host(): {{host()}}
    result = result.replace(/\{\{\s*host\(\)\s*\}\}/g, () => {
        try {
            const v = vm.run('host()');
            return String(v);
        } catch {
            return '';
        }
    });

    // 🆕 支持任意JS表达式：{{(page-1)*25}}, {{page*10}}, 等等
    // 必须放在最后，避免覆盖前面的特定模板
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
        // 跳过已处理的特定格式
        if (expr.trim() === 'key' || expr.trim() === 'page' || expr.trim() === 'source' || expr.trim() === 'baseUrl' || expr.match(/^source\./)) {
            return match; // 保持原样，让前面的规则处理
        }
        
        try {
            // 执行表达式
            const value = vm.run(expr);
            return String(value);
        } catch (e) {
            console.warn(`[evaluateJs] 无法计算表达式: ${expr}`, e);
            return match; // 保持原样
        }
    });

    return result;
}


/**
 * 运行一段 JS 片段作为"变换器"。
 * 将入参作为 result 注入，执行 snippet 后返回 result 字符串。
 */
export async function runJsTransformer(snippet: string, context: { key?: string, page?: number, source?: BookSource, result?: any, baseUrl?: string }): Promise<string> {
    const wrapped = `<js>var result = ${JSON.stringify(context.result)};\n${snippet}\n;String(result)</js>`;
    return evaluateJs(wrapped, context);
}

/**
 * 如果书源配置了 coverDecodeJs，则对封面地址做解码/补全
 */
export async function decodeCoverIfNeeded(coverUrl: string | undefined, source?: BookSource): Promise<string | undefined> {
    if (!coverUrl || !source?.coverDecodeJs) return coverUrl;
    try {
        const out = await runJsTransformer(source.coverDecodeJs, { source, result: coverUrl });
        return out || coverUrl;
    } catch {
        return coverUrl;
    }
}


function parseSingleRule(data: string | object, rule: string, baseUrl: string, isList: boolean = false): any {
    if (!rule) return isList ? [] : '';

    if (typeof data === 'object') {
        // 支持 $.path 以及 简写 path（允许点号）两种对象取值方式
        const normalizePath = (raw: string) => raw.startsWith('$.') ? raw.substring(2) : raw;
        // 允许 '$.'（表示整个对象）以及 '$.path' 或 'path'
        const isPropPath = (raw: string) => /^(?:\$\.)?[A-Za-z0-9_\.]*$/.test(raw);

        if (isPropPath(rule)) {
            const path = normalizePath(rule);
            if (path === '') return data;
            let value: any = data;
            for (const key of path.split('.')) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return isList ? [] : '';
                }
            }
            return value;
        }
        return isList ? [] : '';
    }

    // From here, data is HTML string
    const $ = cheerio.load(data);

    // Rule transformation: 
    // id.xxx -> #xxx
    // class.xxx -> .xxx  
    // tag.0 -> tag:eq(0)
    const transformRule = (r: string) => {
        // 兼容 class. 多类写法："class.c_row cf" -> ".c_row.cf"
        if (r.startsWith('class.') && /\s/.test(r)) {
            const rest = r.substring(6).trim();
            const classes = rest.split(/\s+/).filter(Boolean);
            return classes.map(cls => `.${cls}`).join('');
        }
        return r
            .replace(/id\.(\w+)/g, '#$1')     // id.xxx -> #xxx
            .replace(/class\.(\w+)/g, '.$1')  // class.xxx -> .xxx
            .replace(/\.(\d+)/g, ':eq($1)')   // .0 -> :eq(0)
            .replace(/!([0-9]+)/g, ':not(:eq($1))'); // li!0 -> li:not(:eq(0))
    };

    const parts = rule.split('##');
    const regexPart = parts[1];
    
    // 处理 @ 分隔符：可能是 parent@child 或 selector@attr
        const selectorOptions = parts[0].split('||');
        // 兼容纯文本（没有任何 CSS 选择器符号且包含中文/英文/空格/符号）的情形，直接返回该文本
        if (!/[#.\[@:]/.test(parts[0]) && /[\u4e00-\u9fa5A-Za-z]/.test(parts[0])) {
            return parts[0];
        }

    let finalResult: any = isList ? [] : '';
    
    for (const selectorOption of selectorOptions) {
        // 处理多层@：parent@child@attr 或 parent@child@grandchild 等
        const atParts = selectorOption.split('@');
        let attribute: string | null = null;
        let selectorParts: string[] = [];
        
        // 最后一部分可能是属性名
        const lastPart = atParts[atParts.length - 1];
        const isAttribute = lastPart && !lastPart.match(/^(id\.|class\.|tag\.|\w+\.|\d+|\s)/);
        
        if (isAttribute && atParts.length > 1) {
            // 最后一部分是属性
            attribute = lastPart;
            selectorParts = atParts.slice(0, -1);
        } else {
            // 全部都是选择器
            selectorParts = atParts;
        }
        
        // 转换并组合选择器
        const currentSelector = selectorParts
            .map(part => transformRule(part))
            .join(' ');  // 用空格连接，形成后代选择器

        if (isList) {
            if (!currentSelector.trim()) {
                continue; // 跳过空选择器，避免 Empty sub-selector
            }
             $(currentSelector).each((_i: number, el: any) => {
                const itemHtml = $.html(el);
                 (finalResult as any[]).push(itemHtml);
            });
            if(finalResult.length > 0) break;

        } else {
            if (!currentSelector.trim()) {
                continue; // 跳过空选择器，避免 Empty sub-selector
            }
            const el = $(currentSelector).first();
            let extractedText: string = '';

            if (attribute) {
                 if (attribute === 'text') {
                    extractedText = el.text() || '';
                } else if (attribute === 'html') {
                    extractedText = el.html() || '';
                } else {
                    extractedText = el.attr(attribute) || '';
                }
            } else {
                extractedText = el.text() || '';
            }

            let result = (extractedText || '').trim();

            if (regexPart) {
                try {
                    const regex = new RegExp(regexPart);
                    const match = result.match(regex);
                    result = match ? (match[1] ?? match[0]) : '';
                } catch (e: any) {
                    console.error(`Invalid regex: ${regexPart}`, e.message);
                }
            }
            
            // 处理相对URL：只对URL属性（href、src）做转换
            // 其他文本属性（text、html）不做URL转换
            const isUrlAttribute = attribute && ['href', 'src', 'url'].includes(attribute);
            const needsUrlConversion = isUrlAttribute && 
                                       result && 
                                       !result.startsWith('http') && 
                                       !result.startsWith('data:') && 
                                       !result.startsWith('//');
            
            if (needsUrlConversion) {
                try {
                    // 使用new URL处理相对路径
                    const resolvedUrl = new URL(result, baseUrl);
                    result = resolvedUrl.href;
                } catch(e) {
                    // Not a valid URL path, return as is
                    console.warn(`[parseSingleRule] 无法解析URL: base="${baseUrl}", path="${result}"`);
                }
            }
            
            if(result) {
                finalResult = result.trim();
                break;
            }
        }
    }

    return finalResult;
}

export async function parseWithRules(data: string | object, rule: string | undefined, baseUrl: string, source?: BookSource): Promise<string> {
    if (!rule) return '';

    // 🔧 检查是否是纯 JS 规则（<js>...</js>）
    if (rule.trim().startsWith('<js>') && rule.trim().endsWith('</js>')) {
        // console.log(`[parseWithRules] 检测到纯 JS 规则，执行...`);
        try {
            const processed = await evaluateJs(rule, { 
                source: source, 
                result: data,
                baseUrl: baseUrl
            });
            return String(processed || '');
        } catch (e) {
            console.error(`[parseWithRules] JS执行失败:`, e);
            return '';
        }
    }

    // 🔧 检查是否是 @js: 规则（CSS后跟JS处理）
    if (rule.includes('@js:')) {
        const jsIndex = rule.indexOf('@js:');
        const selectorPart = rule.substring(0, jsIndex).trim();
        const jsPart = rule.substring(jsIndex + 4).trim();
        
        // console.log(`[parseWithRules] 检测到 @js: 规则`);
        
        // 如果没有选择器部分（@js: 在开头），直接用整个 data 作为 result
        // 这样 JS 代码可以直接访问对象属性（如 $.chaptername）
        const wrappedJs = `<js>\nvar baseUrl = "${baseUrl}";\n${jsPart}\nresult\n</js>`;
        
        try {
            const processed = await evaluateJs(wrappedJs, { 
                source: source, 
                result: data,  // 传入完整数据对象
                baseUrl: baseUrl
            });
            return String(processed || '');
        } catch (e) {
            console.error(`[parseWithRules] @js: 执行失败:`, e);
            return '';
        }
    }

    // 检查是否是 @JSon: 规则（用于单个字段）
    if (rule.match(/^@JSon:|^@Json:/i)) {
      //console.log(`[parseWithRules] 检测到 @JSon: 规则`);
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.warn(`[parseWithRules] 数据不是有效JSON，无法使用@JSon规则`);
                return '';
            }
        }
        const { parseJsonRule } = require('./jsonpath-parser');
        const parseResult = parseJsonRule(data, rule);
        
        // 处理JS后处理
        if (parseResult && typeof parseResult === 'object' && 'result' in parseResult && 'jsCode' in parseResult) {
            try {
                // src = 原始完整数据的JSON字符串
                // result = 提取出的值（封面URL等）
                const srcData = typeof data === 'string' ? data : JSON.stringify(data);
                const wrappedJs = `<js>\nvar src = ${JSON.stringify(srcData)};\nvar result = ${JSON.stringify(parseResult.result)};\nvar baseUrl = "${baseUrl}";\n${parseResult.jsCode}\nresult\n</js>`;
                const processed = await evaluateJs(wrappedJs, { 
                    source: undefined, 
                    result: data  // 传入完整数据，让 java.setContent 能访问
                });
                
              //console.log(`[parseWithRules] JS处理完成，结果: ${typeof processed === 'string' ? processed.substring(0, 200) : typeof processed}`);
                
                // 如果结果包含模板 {{...}}，需要二次解析
                if (typeof processed === 'string' && processed.includes('{{')) {
                  //console.log(`[parseWithRules] 检测到模板，进行二次解析: ${processed.substring(0, 200)}`);
                    // 从原始数据中解析模板
                    const finalResult = await parseWithRules(data, processed, baseUrl);
                  //console.log(`[parseWithRules] 模板解析完成，最终结果: ${finalResult.substring(0, 200)}`);
                    return finalResult;
                }
                
                return String(processed || '');
            } catch (e) {
                console.error(`[parseWithRules] JS后处理失败:`, e);
                return String(parseResult.result || '');
            }
        }
        
        return String(parseResult || '');
    }

    // 检查是否包含 @put:{} 语法（Legado用于从JSON提取值并替换到URL中）
    if (rule.includes('@put:') && typeof data === 'object') {
      //console.log(`[parseWithRules] 检测到 @put: 语法，原规则: ${rule}`);
        
        // 先处理所有 {{...}} 模板
        let extractedValues = new Map<string, string>();
        if (rule.includes('{{')) {
            const templateMatches = Array.from(rule.matchAll(/\{\{([^}]+)\}\}/g));
            for (const templateMatch of templateMatches) {
                const [fullMatch, templatePath] = templateMatch;
                try {
                    const templateValue = await parseWithRules(data, templatePath, baseUrl);
                    extractedValues.set(templatePath, templateValue);
                    rule = rule.replace(fullMatch, templateValue);
                  //console.log(`[parseWithRules] 模板 ${templatePath} = ${templateValue}`);
                } catch (e) {
                    console.warn(`[parseWithRules] 模板解析失败: ${templatePath}`);
                    rule = rule.replace(fullMatch, '');
                }
            }
        }
        
        // 再处理 @put:{}
        const putMatches = Array.from(rule.matchAll(/@put:\{([^}]+)\}/g));
        for (const putMatch of putMatches) {
            const [fullMatch, putRule] = putMatch;
            const colonIndex = putRule.indexOf(':');
            if (colonIndex === -1) continue;
            
            const putKey = putRule.substring(0, colonIndex).trim();
            const putPath = putRule.substring(colonIndex + 1).trim();
            
            // 检查是否已经提取过这个路径的值
            let value: string;
            if (extractedValues.has(putPath)) {
                value = extractedValues.get(putPath)!;
              //console.log(`[parseWithRules] @put 使用已提取的值: ${putKey}=${value}`);
                // 如果已经提取过，直接删除 @put:{}，不要重复添加值
                rule = rule.replace(fullMatch, '');
            } else {
                // 解析路径获取值
                value = await parseWithRules(data, putPath, baseUrl);
              //console.log(`[parseWithRules] @put 提取: ${putKey}=${value}`);
                // 替换 @put:{} 为提取的值
                rule = rule.replace(fullMatch, value);
            }
        }
        
      //console.log(`[parseWithRules] 最终规则: ${rule}`);
        // 🔧 @put 处理完成后，规则已经是完整的URL，直接返回
        return rule;
    }

    // 对象数据：增强支持占位模板、'||' 备选和 '&&' 取首个非空
    if (typeof data === 'object') {
        const tryEvaluateTemplate = (tpl: string): string => {
            if (!tpl.includes('{{')) return '';
          //console.log(`[tryEvaluateTemplate] 开始解析模板: ${tpl.substring(0, 200)}`);
            const result = tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
              //console.log(`[tryEvaluateTemplate] 解析表达式: ${expr}`);
                const value = parseSingleRule(data, String(expr).trim(), baseUrl, false);
              //console.log(`[tryEvaluateTemplate] 表达式 "${expr}" 的值: ${value}`);
                return String(value ?? '');
            });
          //console.log(`[tryEvaluateTemplate] 模板解析结果: ${result.substring(0, 200)}`);
            return result;
        };

        // 如果是 URL 模板或包含占位，优先做模板替换
        if (rule.includes('{{')) {
          //console.log(`[parseWithRules] 检测到模板规则: ${rule.substring(0, 200)}`);
            const replaced = tryEvaluateTemplate(rule);
            if (replaced) {
              //console.log(`[parseWithRules] 模板替换完成，返回: ${replaced.substring(0, 200)}`);
                return replaced;
            }
        }

        // 支持多备选 'alt1||alt2'，每个备选内部按 '&&' 拆分，取第一个非空值
        const alternatives = rule.split('||').map(s => s.trim()).filter(Boolean);
        for (const alt of alternatives) {
            const parts = alt.split('&&').map(s => s.trim()).filter(Boolean);
            for (const part of parts) {
                const val = String(parseSingleRule(data, part, baseUrl, false) || '').trim();
                if (val) return val;
            }
        }
        // 没有 '||' 的情况：保留原有 '&&' 语义为串联，但若其中某个子结果非空则返回拼接
        const concatenated = rule.split('&&').map(subRule => String(parseSingleRule(data, subRule, baseUrl, false) || '')).join('');
        return concatenated;
    }

    // 字符串(HTML)数据：沿用原先 '&&' 连接，'||' 在 parseSingleRule 内处理
    return rule.split('&&').map(subRule => {
        return parseSingleRule(data, subRule, baseUrl, false) as string;
    }).join('');
}


export async function parseListWithRules(data: string, listRule: string | undefined, itemRules: { [key: string]: string | undefined }, baseUrl: string, source?: BookSource): Promise<any[]> {
    if (!listRule) return [];
    
    // 🔧 优先检查规则中是否包含 JS 代码（即使数据是 HTML）
    // 这种情况下，JS 代码会先处理数据，再用后续规则提取列表
    if (listRule.includes('<js>') && listRule.includes('</js>')) {
      //console.log(`[parseListWithRules] 规则包含 JS 代码，先执行 JS 预处理`);
        try {
            // 提取第一段 JS 代码（用于数据预处理）
            const firstJsMatch = listRule.match(/<js>([\s\S]*?)<\/js>/);
            if (firstJsMatch) {
                const jsCode = firstJsMatch[1];
                // 剩余规则需要从匹配块的结尾位置开始截取，不能假定 <js> 在字符串起始
                const start = (firstJsMatch as any).index ?? listRule.indexOf(firstJsMatch[0]);
                const remainingRule = listRule.slice(start + firstJsMatch[0].length).trim();
                // 兼容大灰狼写法：在 <js> 前面写了 JSON 路径，如 "$.data\n<js>..."
                const preSelector = listRule.slice(0, start).trim();
                
              //console.log(`[parseListWithRules] 执行数据预处理 JS，长度: ${jsCode.length}`);
              //console.log(`[parseListWithRules] baseUrl: ${baseUrl}`);
                
                // 执行 JS 预处理，传递 baseUrl 覆盖默认值
                const processedData = await evaluateJs(`<js>${jsCode}</js>`, { 
                    result: data, 
                    source: source,
                    baseUrl: baseUrl  // 传递实际的 baseUrl
                });
              //console.log(`[parseListWithRules] JS 预处理完成，结果长度: ${processedData.length}`);
                
                // 如果还有剩余规则，递归处理
                if (remainingRule) {
                  //console.log(`[parseListWithRules] 使用剩余规则继续处理: ${remainingRule.substring(0, 100)}...`);
                    return await parseListWithRules(processedData, remainingRule, itemRules, baseUrl, source);
                } else {
                    // 没有剩余规则：直接解析 processedData
                    // 1) 若 <js> 前存在 JSON 路径（如 $.data），先解析 processedData 为 JSON，再取该路径
                    if (preSelector && preSelector.startsWith('$.')) {
                        try {
                            const json = JSON.parse(processedData);
                            const extracted = parseSingleRule(json, preSelector, baseUrl, true);
                            if (Array.isArray(extracted)) {
                                console.log(`[parseListWithRules] 从JS结果中提取 ${preSelector}，得到 ${extracted.length} 条`);
                                // 对提取到的数组应用 itemRules 映射
                                const results = [] as any[];
                                for (let index = 0; index < extracted.length; index++) {
                                    const item = extracted[index];
                                    const resultItem: any = {};
                                    for (const key in itemRules) {
                                        const rule = itemRules[key];
                                        if (rule) {
                                            resultItem[key] = await parseWithRules(item, rule, baseUrl, source);
                                        }
                                    }
                                    results.push(resultItem);
                                }
                                return results;
                        }
                    } catch (e) {
                            // fallthrough
                        }
                    }
                    // 2) 否则尝试 processedData 直接为数组
                    try {
                        const resultArr = JSON.parse(processedData);
                        if (Array.isArray(resultArr) || (resultArr && Array.isArray(resultArr.data))) {
                            const arr = Array.isArray(resultArr) ? resultArr : resultArr.data;
                            const results = [] as any[];
                            for (let index = 0; index < arr.length; index++) {
                                const item = arr[index];
                                const resultItem: any = {};
                                for (const key in itemRules) {
                                    const rule = itemRules[key];
                                    if (rule) {
                                        resultItem[key] = await parseWithRules(item, rule, baseUrl, source);
                                    }
                                }
                                resultItem.__raw = item;
                                results.push(resultItem);
                            }
                            return results;
                        }
                    } catch (e) {
                        // 不是数组，继续走通用逻辑
                    }
                }
            }
        } catch (e) {
            console.warn(`[parseListWithRules] JS 预处理失败，跳过并继续:`, e);
            // 不要阻止后续处理，继续使用原始数据
        }
    }
    
    let jsonData: any = null;
    let isJson = false;
    try {
        jsonData = JSON.parse(data);
        isJson = true;
      //console.log(`[parseListWithRules] ✅ 数据是JSON格式`);
    } catch (e) {
      //console.log(`[parseListWithRules] 数据是HTML格式`);
    }

    if (isJson) {
        // 检查是否使用 @JSon: 前缀（Legado标准格式）
        if (listRule.match(/^@JSon:|^@Json:/i)) {
          //console.log(`[parseListWithRules] 检测到 @JSon: 规则，使用增强的JSONPath解析`);
            const { parseJsonRule } = require('./jsonpath-parser');
            
            let parseResult = parseJsonRule(jsonData, listRule);
            let dataList: any[] = [];
            let jsCode = '';
            
            // 检查是否有JS后处理
            if (parseResult && typeof parseResult === 'object' && 'result' in parseResult && 'jsCode' in parseResult) {
                dataList = Array.isArray(parseResult.result) ? parseResult.result : [parseResult.result];
                jsCode = parseResult.jsCode;
            } else {
                dataList = Array.isArray(parseResult) ? parseResult : (parseResult ? [parseResult] : []);
            }
            
          //console.log(`[parseListWithRules] @JSon解析得到 ${dataList.length} 条记录`);
            
            // 如果有JS后处理代码，执行它
            if (jsCode) {
              //console.log(`[parseListWithRules] 执行JS后处理...`);
                try {
                    // 使用evaluateJs执行JS代码
                    const wrappedJs = `<js>\nvar src = result;\nvar result = src;\nvar baseUrl = "${baseUrl}";\n${jsCode}\nresult\n</js>`;
                    const processedData = await evaluateJs(wrappedJs, { 
                        source: undefined, 
                        result: JSON.stringify(dataList)
                    });
                    try {
                        dataList = JSON.parse(processedData as string);
                      //console.log(`[parseListWithRules] JS后处理完成，得到 ${dataList.length} 条记录`);
                    } catch (e) {
                        console.warn(`[parseListWithRules] JS后处理结果不是有效JSON:`, e);
                    }
                } catch (e) {
                    console.error(`[parseListWithRules] JS后处理失败:`, e);
                }
            }
            
            if (!Array.isArray(dataList)) {
              //console.log(`[parseListWithRules] ⚠️ 解析结果不是数组:`, typeof dataList);
                return [];
            }
            
            const results = [];
            for (let index = 0; index < dataList.length; index++) {
                const item = dataList[index];
                const resultItem: any = {};
                for (const key in itemRules) {
                    const rule = itemRules[key];
                    if (rule) {
                       resultItem[key] = await parseWithRules(item, rule, baseUrl);
                    }
                }
                if (index < 3) {
                  //console.log(`[parseListWithRules] 第 ${index + 1} 条记录解析结果:`, JSON.stringify(resultItem, null, 2).substring(0, 200));
                }
                            resultItem.__raw = item;
                            results.push(resultItem);
            }
            return results;
        }
        
        // 原有的简单JSON路径解析逻辑（兼容旧书源）
        // 支持 'alt1||alt2' 以及 'a&&b&&$.path' 混合写法：优先选中 JSON 路径
        const alternatives = listRule.split('||').map(s => s.trim()).filter(Boolean);
        let selectedPath = '';
        for (const alt of alternatives) {
            // 从 a&&b&&$.path 里提取最后一个以 $. 开头的片段
            const parts = alt.split('&&').map(p => p.trim()).filter(Boolean);
            const lastJson = [...parts].reverse().find(p => p.startsWith('$.'));
            if (lastJson) {
                selectedPath = lastJson;
                break;
            }
            // 若整个 alt 本身就是 $.path
            if (alt.startsWith('$.')) {
                selectedPath = alt;
                break;
            }
        }
        // 回退：如果没有任何 $. 路径，且 listRule 本身就是 $. 开头则使用它
        if (!selectedPath && listRule.startsWith('$.')) {
            selectedPath = listRule;
        }

        if (!selectedPath) {
            // 兼容 '$.' 作为整个对象（数组）
            if (listRule.trim() === '$.' && Array.isArray(jsonData)) {
                selectedPath = '$.';
            } else if (jsonData && Array.isArray((jsonData as any).chapterlist)) {
                // 晋江：JS 预处理后常返回 { chapterlist: [...] }
              //console.log(`[parseListWithRules] 未显式指定路径，自动采用 $.chapterlist[*]`);
                selectedPath = '$.chapterlist[*]';
            } else {
              //console.log(`[parseListWithRules] ⚠️ 未找到可用的 JSON 路径，返回空列表。listRule=${listRule}`);
                return [];
            }
        }

        let dataList: any[] = selectedPath === '$.' ? jsonData : parseSingleRule(jsonData, selectedPath, baseUrl, true);
      //console.log(`[parseListWithRules] JSON解析: selectedPath="${selectedPath}" 找到 ${Array.isArray(dataList) ? dataList.length : 0} 条记录`);

        // 兜底：如果规则选择为 $.[*] 但结果为空，而 jsonData.chapterlist 存在
        if ((!Array.isArray(dataList) || dataList.length === 0) && jsonData && Array.isArray((jsonData as any).chapterlist)) {
          //console.log(`[parseListWithRules] 兜底采用 chapterlist 数组`);
            dataList = (jsonData as any).chapterlist;
        }
        
        if(!Array.isArray(dataList)) {
          //console.log(`[parseListWithRules] ⚠️ 解析结果不是数组:`, typeof dataList);
            return [];
        }

        const results = [];
        for (let index = 0; index < dataList.length; index++) {
            const item = dataList[index];
            const resultItem: any = {};
            for (const key in itemRules) {
                const rule = itemRules[key];
                if (rule) {
                   resultItem[key] = await parseWithRules(item, rule, baseUrl, source);
                }
            }
            if (index < 3) {
              //console.log(`[parseListWithRules] 第 ${index + 1} 条记录解析结果:`, JSON.stringify(resultItem, null, 2).substring(0, 200));
            }
            resultItem.__raw = item;
                resultItem.__raw = item;
                results.push(resultItem);
        }
        return results;

    } else {
        const elementsHtml: string[] = parseSingleRule(data, listRule, baseUrl, true);
      //console.log(`[parseListWithRules] HTML解析: listRule="${listRule}" 找到 ${elementsHtml?.length || 0} 个元素`);
        
        const results = [];
        for (let index = 0; index < elementsHtml.length; index++) {
            const elementHtml = elementsHtml[index];
            const item: any = {};
            for (const key in itemRules) {
                const rule = itemRules[key];
                if (rule) {
                    item[key] = await parseWithRules(elementHtml, rule, baseUrl, source);
                }
            }
            if (index < 3) {
              //console.log(`[parseListWithRules] 第 ${index + 1} 个元素解析结果:`, JSON.stringify(item, null, 2).substring(0, 200));
            }
            item.__raw = { _html: elementHtml };
            results.push(item);
        }
        return results;
    }
}
