
import type { NextApiRequest, NextApiResponse } from 'next';
import type { BookstoreBook, BookstoreCategory } from '@/lib/types';
import { getBookSources, parseListWithRules, evaluateJs, decodeCoverIfNeeded } from '@/lib/book-source-utils';
import { getCookieForUrl } from '@/lib/book-source-auth';
import { rewriteViaProxyBase } from '@/lib/proxy-fetch';
import { parseUrlWithOptions, buildRequestInit } from '@/lib/parse-url-with-options';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, sourceId, exploreUrl, page = '1', mode } = req.query;
    const logPrefix = '[API/bookstore/category]';

    console.log(`${logPrefix} Received category request: url=${url}, exploreUrl=${exploreUrl}, mode=${mode}, sourceId=${sourceId}`);

    if (typeof sourceId !== 'string' || !sourceId) {
        return res.status(400).json({ success: false, error: 'sourceId is required' });
    }
    
    // When mode is provided, server will derive URLs from source config and not require client to send long URLs
    if (!mode && !url && !exploreUrl) {
         return res.status(400).json({ success: false, error: 'url or exploreUrl is required' });
    }

    try {
        const sources = await getBookSources();
        const source = sources.find(s => s.id === sourceId);

        if (!source || !source.enabled) {
            console.error(`${logPrefix} Source not found or disabled for ID: ${sourceId}`);
            return res.status(404).json({ success: false, error: `Book source with ID ${sourceId} not found or is disabled.` });
        }
        
        console.log(`${logPrefix} Using source: ${source.name}`);

        // Determine fetch target/or data based on mode or provided params
        let fetchUrlOrJsonData = '' as string;
        if (typeof mode === 'string' && mode) {
            const normalizedMode = mode.toLowerCase();
            if (normalizedMode === 'explore') {
                if (!source.exploreUrl) {
                    console.error(`${logPrefix} Source '${source.name}' has no exploreUrl configured.`);
                    return res.status(501).json({ success: false, error: `Book source '${source.name}' has no exploreUrl configured.` });
                }
                fetchUrlOrJsonData = source.exploreUrl;
            } else if (normalizedMode === 'find') {
                const findRule = source.rules?.find;
                if (!findRule?.url) {
                    console.error(`${logPrefix} Source '${source.name}' is missing find.url.`);
                    return res.status(501).json({ success: false, error: `Book source '${source.name}' is missing 'find.url' configuration.` });
                }
                fetchUrlOrJsonData = findRule.url;
            } else {
                return res.status(400).json({ success: false, error: `Unsupported mode '${mode}'.` });
            }
        } else {
            fetchUrlOrJsonData = (exploreUrl || url) as string;
        }

        let data;
        let baseUrl = source.url;

        // If the result is a URL, fetch it. If not, it's probably already JSON data.
        if (fetchUrlOrJsonData.startsWith('http')) {
            // 处理模板占位（如 {{page-1}}、{{(page-1)*25}}、{{host()}}, {{source.xxx}} 等）
            let realUrl = await evaluateJs(fetchUrlOrJsonData, { source, page: parseInt(page as string) });
            
            // 解析Legado格式的URL和请求配置 (URL,{options})
            const parsedUrl = parseUrlWithOptions(realUrl);
            realUrl = parsedUrl.url;
            realUrl = rewriteViaProxyBase(realUrl, source.proxyBase);
            baseUrl = realUrl;
            console.log(`${logPrefix} Fetching URL: ${baseUrl}`);
            console.log(`${logPrefix} Parsed request options:`, { method: parsedUrl.method, hasBody: !!parsedUrl.body, extraHeaders: Object.keys(parsedUrl.headers || {}) });
            
            const cookieHeader = await getCookieForUrl(source.id, realUrl);
            let parsedHeaders: Record<string, string> = {};
            if (source.header) {
                try {
                    parsedHeaders = JSON.parse(source.header);
                } catch (e) {
                    console.warn(`${logPrefix} Failed to parse source.header as JSON, checking for JS code...`);
                    
                    // 检查是否是JavaScript代码
                    if (source.header.trim().startsWith('<js>') && source.header.trim().endsWith('</js>')) {
                        console.log(`${logPrefix} Header contains JavaScript code, evaluating...`);
                        try {
                            const headerResult = await evaluateJs(source.header, { source });
                            parsedHeaders = JSON.parse(headerResult);
                            console.log(`${logPrefix} Successfully evaluated header JS:`, parsedHeaders);
                        } catch (jsError) {
                            console.error(`${logPrefix} Failed to evaluate header JS:`, jsError);
                            // 使用默认headers
                            parsedHeaders = {};
                        }
                    } else {
                        // 尝试解析为 "key:value\nkey:value" 格式
                        const lines = source.header.split('\n');
                        for (const line of lines) {
                            const [key, ...valueParts] = line.split(':');
                            if (key && valueParts.length > 0) {
                                parsedHeaders[key.trim()] = valueParts.join(':').trim();
                            }
                        }
                    }
                }
            }
            const realUrlOrigin = (() => { try { return new URL(realUrl).origin; } catch { return undefined; } })();
            const mergedHeaders: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                ...(realUrlOrigin ? { Referer: realUrlOrigin } : {}),
                ...parsedHeaders,
                ...(parsedUrl.headers || {}), // URL中指定的headers优先级更高
                ...(cookieHeader ? { cookie: cookieHeader } : {}),
            };
            
            // 构建完整的请求配置
            const requestInit = buildRequestInit(parsedUrl, mergedHeaders);
            // console.log(`${logPrefix} Final request config:`, { method: requestInit.method, headers: Object.keys(requestInit.headers as any), hasBody: !!requestInit.body });
            
            // 增强请求头，模拟真实浏览器
            const enhancedInit: RequestInit = {
                ...requestInit,
                headers: {
                    ...(requestInit.headers as any),
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Upgrade-Insecure-Requests': '1',
                }
            };
            
            try {
                // 首选直连（100s超时），失败则尝试 http->https 域切换一次
                const tryFetch = async (u: string) => {
                    const resp = await fetch(u, { ...enhancedInit, signal: AbortSignal.timeout(700000) });
                    if (!resp.ok) throw new Error(`Status ${resp.status}`);
                    const ct = resp.headers.get('content-type') || '';
                    if (ct.includes('application/json')) { data = JSON.stringify(await resp.json()); }
                    else { data = await resp.text(); }
                };
                await tryFetch(realUrl);
            } catch (e: any) {
                console.warn(`${logPrefix} Direct fetch failed (${e?.code || e?.message}), fallback to alt domain if possible`);
                try {
                    // 域名兜底：api.langge.cf <-> https://api.langge.cf <-> http://api.langge.cf
                    const urlObj = new URL(realUrl);
                    if (!/^https?:$/.test(urlObj.protocol)) urlObj.protocol = 'https:';
                    const altCandidates = new Set<string>();
                    altCandidates.add(`https://${urlObj.host}${urlObj.pathname}${urlObj.search}`);
                    altCandidates.add(`http://${urlObj.host}${urlObj.pathname}${urlObj.search}`);
                    for (const alt of altCandidates) {
                        try {
                            await (async () => {
                                const resp = await fetch(alt, { ...enhancedInit, signal: AbortSignal.timeout(70000) });
                                if (!resp.ok) throw new Error(`Status ${resp.status}`);
                                const ct = resp.headers.get('content-type') || '';
                                if (ct.includes('application/json')) { data = JSON.stringify(await resp.json()); }
                                else { data = await resp.text(); }
                            })();
                            console.log(`${logPrefix} Fallback fetched from: ${alt}`);
                            break;
                        } catch {}
                    }
                    if (!data) throw e;
                } catch (e2) {
                    console.error(`${logPrefix} Fallbacks exhausted.`);
                    throw e;
                }
            }
        } else {
            console.log(`${logPrefix} Processing as direct JSON/JS data.`);
            if (fetchUrlOrJsonData.trim().startsWith('<js>')) {
                data = await evaluateJs(fetchUrlOrJsonData, { source });
            } else {
                const raw = fetchUrlOrJsonData.trim();
                if (raw.startsWith('[') || raw.startsWith('{')) {
                    data = raw;
                } else {
                    // 支持按行 “标题::URL” 配置
                    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                    const categories: BookstoreCategory[] = lines.map(line => {
                        const [title, link] = line.split('::');
                        return { title: (title || '').trim(), url: (link || '').trim(), sourceId };
                    }).filter(c => c.title && c.url);
                    if (categories.length > 0) {
                        console.log(`${logPrefix} Parsed ${categories.length} categories from plain text exploreUrl.`);
                        return res.status(200).json({ success: true, categories });
                    }
                    data = raw;
                }
            }
        }

        if ((typeof mode === 'string' && mode.toLowerCase() === 'explore') || (!!exploreUrl && !mode)) {
            console.log(`${logPrefix} 解析exploreUrl返回的数据，前500字符:`, data.substring(0, 500));
            
            // 如果data是JSON字符串，先解析它
            let parsedData: any;
            try {
                parsedData = JSON.parse(data);
                console.log(`${logPrefix} 成功解析JSON，类型: ${Array.isArray(parsedData) ? 'Array' : typeof parsedData}`);
                if (Array.isArray(parsedData)) {
                    console.log(`${logPrefix} 数组长度: ${parsedData.length}，第一个元素:`, parsedData[0]);
                }
            } catch (e) {
                console.log(`${logPrefix} 不是JSON格式，作为HTML处理`);
                parsedData = data;
            }
            
            // 如果是数组，直接使用；否则使用parseListWithRules
            let categoriesRaw: any[];
            if (Array.isArray(parsedData)) {
                // 直接使用数组，但要过滤掉无效项
                categoriesRaw = parsedData.filter(item => 
                    item && typeof item === 'object' && 
                    item.title && item.title.trim() && 
                    item.url !== undefined  // url可以为空字符串
                );
                console.log(`${logPrefix} 过滤后的分类数量: ${categoriesRaw.length}`);
            } else {
                // 使用原来的解析规则
                categoriesRaw = await parseListWithRules(data, '$[*]', {
                    title: '$.title',
                    url: '$.url',
                }, baseUrl);
            }
            
            let categories: BookstoreCategory[] = categoriesRaw.map(cat => ({...cat, sourceId}));
            
            console.log(`${logPrefix} Found ${categories.length} categories from exploreUrl.`);
            res.status(200).json({ success: true, categories });
        } 
        else {
            const findRule = source.rules?.find;
            if(!findRule){
                console.error(`${logPrefix} Source '${source.name}' is missing 'find' rules.`);
                return res.status(501).json({ success: false, error: `Book source '${source.name}' is missing parsing rules for 'find'.` });
            }
            
            // 强兼容HTML数据处理
            let processedData = data;
            if (data.trim().startsWith('<')) {
                console.log(`${logPrefix} 检测到HTML格式数据，进行强兼容处理`);
                
                // 方法1: 尝试从HTML中提取JSON数据
                const jsonMatches = [
                    // 匹配各种可能的JSON数据格式（全部使用全局标志以便与 matchAll 配合）
                    /<script[^>]*>([\s\S]*?)<\/script>/g,
                    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/g,
                    /window\.__DATA__\s*=\s*({[\s\S]*?});/g,
                    /var\s+data\s*=\s*({[\s\S]*?});/g,
                    /const\s+data\s*=\s*({[\s\S]*?});/g,
                    /"data"\s*:\s*({[\s\S]*?})/g,
                ];
                
                let jsonExtracted = false;
                for (const regex of jsonMatches) {
                    const matches = data.matchAll(regex);
                    for (const match of matches) {
                        if (match[1]) {
                            try {
                                const jsonStr = match[1].trim();
                                // 尝试解析为JSON
                                if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
                                    JSON.parse(jsonStr); // 验证是否为有效JSON
                                    processedData = jsonStr;
                                    console.log(`${logPrefix} ✅ 成功从HTML中提取JSON数据，长度: ${jsonStr.length}`);
                                    jsonExtracted = true;
                                    break;
                                }
                            } catch (e) {
                                // 继续尝试下一个匹配
                                continue;
                            }
                        }
                    }
                    if (jsonExtracted) break;
                }
                
                // 方法2: 如果没有找到JSON，尝试执行JavaScript代码获取数据
                if (!jsonExtracted) {
                    console.log(`${logPrefix} 未找到直接的JSON数据，尝试执行JavaScript获取数据`);
                    const scriptMatches = data.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
                    for (const scriptMatch of scriptMatches) {
                        const jsCode = scriptMatch[1];
                        if (jsCode && (jsCode.includes('data') || jsCode.includes('list') || jsCode.includes('books') || jsCode.includes('result'))) {
                            try {
                                console.log(`${logPrefix} 尝试执行JavaScript代码获取数据...`);
                                const wrappedJs = `<js>\n${jsCode}\n// 尝试返回可能的数据变量\nif (typeof data !== 'undefined') { JSON.stringify(data); }\nelse if (typeof list !== 'undefined') { JSON.stringify(list); }\nelse if (typeof books !== 'undefined') { JSON.stringify(books); }\nelse if (typeof result !== 'undefined') { JSON.stringify(result); }\nelse { '[]'; }\n</js>`;
                                const jsResult = await evaluateJs(wrappedJs, { source });
                                if (jsResult && jsResult !== '[]' && jsResult !== 'undefined') {
                                    processedData = jsResult;
                                    console.log(`${logPrefix} ✅ 通过JavaScript执行获取到数据，长度: ${jsResult.length}`);
                                    jsonExtracted = true;
                                    break;
                                }
                            } catch (e) {
                                console.warn(`${logPrefix} JavaScript执行失败:`, e);
                                continue;
                            }
                        }
                    }
                }
                
                // 方法3: 如果仍然没有数据，保持HTML格式用于CSS选择器解析
                if (!jsonExtracted) {
                    console.log(`${logPrefix} 保持HTML格式，将使用CSS选择器进行解析`);
                    // processedData 保持为原始HTML
                }
            }

            console.log(`${logPrefix} 使用解析规则解析数据，bookList规则: ${findRule.bookList}`);
            console.log(`${logPrefix} 数据预览: ${processedData.substring(0, 500)}...`);
            
            let booksRaw: any[] = [];
            try {
                booksRaw = await parseListWithRules(processedData, findRule.bookList, {
                    title: findRule.name,
                    author: findRule.author,
                    cover: findRule.coverUrl,
                    detailUrl: findRule.bookUrl,
                    category: findRule.kind,
                    latestChapter: findRule.lastChapter,
                }, baseUrl);
                
                console.log(`${logPrefix} ✅ 解析得到 ${booksRaw.length} 本书的原始数据`);
                
                // 如果解析结果为空且数据是HTML，尝试更灵活的解析方式
                if (booksRaw.length === 0 && processedData.includes('<')) {
                    console.log(`${logPrefix} 初次解析结果为空，尝试更灵活的HTML解析...`);
                    
                    // 尝试常见的HTML结构模式
                    const commonPatterns = [
                        'div.book-item',
                        'li.book',
                        '.book-list li',
                        '.book-item',
                        'tr',
                        '.item',
                        '.list-item',
                        'article',
                        '.card'
                    ];
                    
                    for (const pattern of commonPatterns) {
                        try {
                            console.log(`${logPrefix} 尝试使用模式: ${pattern}`);
                            const testResult = await parseListWithRules(processedData, pattern, {
                                title: findRule.name || 'text',
                                author: findRule.author || 'text',
                                cover: findRule.coverUrl || 'img@src',
                                detailUrl: findRule.bookUrl || 'a@href',
                                category: findRule.kind || 'text',
                                latestChapter: findRule.lastChapter || 'text',
                            }, baseUrl);
                            
                            if (testResult.length > 0) {
                                console.log(`${logPrefix} ✅ 使用模式 ${pattern} 成功解析到 ${testResult.length} 本书`);
                                booksRaw = testResult;
                                break;
                            }
                        } catch (e) {
                            console.warn(`${logPrefix} 模式 ${pattern} 解析失败:`, e);
                            continue;
                        }
                    }
                }
            } catch (parseError) {
                console.error(`${logPrefix} 数据解析失败:`, parseError);
                console.log(`${logPrefix} 尝试使用备用解析方法...`);
                
                // 备用解析：尝试提取所有链接作为书籍
                try {
                    booksRaw = (await parseListWithRules(processedData, 'a', {
                        title: 'text',
                        detailUrl: '@href'
                    }, baseUrl)).filter(book => book.title && book.title.length > 2);
                    console.log(`${logPrefix} 备用解析得到 ${booksRaw.length} 个链接`);
                } catch (e) {
                    console.error(`${logPrefix} 备用解析也失败:`, e);
                    booksRaw = [];
                }
            }
            const books: BookstoreBook[] = await Promise.all(booksRaw.map(async (book) => ({
                ...book,
                cover: await decodeCoverIfNeeded(book.cover, source),
                sourceId
            })));

            console.log(`${logPrefix} Found ${books.length} books from category URL.`);
            if (books.length > 0) {
                console.log(`${logPrefix} 前3本书的数据示例:`, JSON.stringify(books.slice(0, 3).map(b => ({
                    title: b.title,
                    author: b.author,
                    detailUrl: b.detailUrl,
                    cover: b.cover?.substring(0, 50)
                })), null, 2));
            }
            res.status(200).json({ success: true, books });
        }

    } catch (error: any) {
        console.error(logPrefix, error);
        res.status(500).json({ success: false, error: 'Failed to fetch category books.', details: error.message });
    }
}
