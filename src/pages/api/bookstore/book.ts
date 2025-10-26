
import type { NextApiRequest, NextApiResponse } from 'next';
import type { BookstoreBookDetail } from '@/lib/types';
import { decodeCoverIfNeeded } from '@/lib/book-source-utils';
import { getCookieForUrl } from '@/lib/book-source-auth';
import { rewriteViaProxyBase } from '@/lib/proxy-fetch';
import { parseUrlWithOptions, buildRequestInit } from '@/lib/parse-url-with-options';
import * as cheerio from 'cheerio';
import { getBookSources, parseWithRules, parseListWithRules, evaluateJs, parseRuleWithCssJs, runJsTransformer } from '@/lib/book-source-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, sourceId } = req.query;
    const logPrefix = '[API/bookstore/book]';

    console.log(`${logPrefix} Received book detail request: url=${url}, sourceId=${sourceId}`);

    if (typeof url !== 'string' || !url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }
    if (typeof sourceId !== 'string' || !sourceId) {
        return res.status(400).json({ success: false, error: 'sourceId is required' });
    }

    try {
        const sources = await getBookSources();
        const source = sources.find(s => s.id === sourceId);

        if (!source || !source.enabled) {
            console.error(`${logPrefix} Source not found or disabled for ID: ${sourceId}`);
            return res.status(404).json({ success: false, error: `Book source with ID ${sourceId} not found or is disabled.` });
        }
        
        console.log(`${logPrefix} Using source: ${source.name}`);
        
        const bookInfoRule = source.rules?.bookInfo;
        const tocRule = source.rules?.toc;

        if (!bookInfoRule || !tocRule) {
            console.error(`${logPrefix} Source '${source.name}' is missing bookInfo or toc rules.`);
            return res.status(501).json({ success: false, error: `Book source '${source.name}' is missing parsing rules for book details or table of contents.` });
        }
        
        // 🔧 先检查是否是相对路径，如果是则先补全，再解析options
        let fullUrl = url;
        
        // 提取URL部分（可能包含,{options}）
        const urlMatch = url.match(/^([^,]+)/);
        const urlPart = urlMatch ? urlMatch[1].trim() : url;
        
        if (!urlPart.startsWith('http://') && !urlPart.startsWith('https://')) {
            // 从 loginUrl 或 jsLib 中提取服务器列表
            const getHostsFromComment = (comment: string = '', jsLib: string = '', loginUrl: string = ''): string[] => {
                const combinedScript = `${comment}\n${jsLib}\n${loginUrl}`;
                
                // 方法1: 查找 const host = [...]
                let match = combinedScript.match(/const\s+host\s*=\s*(\[[\s\S]*?\])/);
                if (match && match[1]) {
                    try {
                        const { VM } = require('vm2');
                        const vm = new VM();
                        return vm.run(`module.exports = ${match[1]};`);
                    } catch (e) {
                        // ignore
                    }
                }
                
                // 方法2: 查找 encodedEndpoints（大灰狼书源格式）
                match = combinedScript.match(/const\s+encodedEndpoints\s*=\s*\[([\s\S]*?)\];/);
                if (match && match[1]) {
                    try {
                        const base64Strings = match[1].match(/'([^']+)'/g) || [];
                        const decodedHosts = base64Strings
                            .map(s => s.replace(/'/g, '').trim())
                            .filter(s => s.length > 0)
                            .map(b64 => {
                                try {
                                    return Buffer.from(b64, 'base64').toString('utf-8');
                                } catch (e) {
                                    return null;
                                }
                            })
                            .filter(h => h && (h.startsWith('http://') || h.startsWith('https://')));
                        
                        if (decodedHosts.length > 0) {
                            return decodedHosts as string[];
                        }
                    } catch (e) {
                        // ignore
                    }
                }
                
                return [];
            };
            
            const hosts = getHostsFromComment(source.comment, source.jsLib, source.loginUrl);
            if (hosts.length > 0) {
                const baseUrl = hosts[0];
                // 替换URL部分，保留options部分
                fullUrl = baseUrl + urlPart + url.substring(urlPart.length);
                console.log(`${logPrefix} 补全相对路径URL: ${fullUrl}`);
            } else {
                console.error(`${logPrefix} 无法补全相对路径URL，未找到服务器地址`);
                return res.status(400).json({ success: false, error: `书源配置错误：URL是相对路径（${urlPart}），但未找到服务器地址` });
            }
        }
        
        // 现在解析完整的URL和请求配置
        const parsedUrl = parseUrlWithOptions(fullUrl);
        let detailUrl = parsedUrl.url;
        console.log(`${logPrefix} Parsed request options:`, { method: parsedUrl.method, hasBody: !!parsedUrl.body, extraHeaders: Object.keys(parsedUrl.headers || {}) });
        
        let baseHeaders: Record<string, string> = {};
        if (source.header) {
            try {
                baseHeaders = JSON.parse(source.header);
            } catch (e) {
                console.warn(`${logPrefix} Failed to parse source.header`);
            }
        }
        
        // Inject cookies if available for this source and URL
        const cookieHeader = await getCookieForUrl(source.id, detailUrl);
        const mergedHeaders: Record<string, string> = {
            ...baseHeaders,
            ...(parsedUrl.headers || {}), // URL中指定的headers优先级更高
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
        };
        // 兼容大灰狼服务端要求
        try { if (new URL(detailUrl).hostname.includes('langge')) (mergedHeaders as any)['versiontype'] = (mergedHeaders as any)['versiontype'] || 'reading'; } catch {}
        
        // 构建完整的请求配置
        const requestOptions = buildRequestInit(parsedUrl, mergedHeaders);
        console.log(`${logPrefix} Final request config:`, { method: requestOptions.method, headers: Object.keys(requestOptions.headers as any), hasBody: !!requestOptions.body });
        
        const response = await fetch(rewriteViaProxyBase(detailUrl, source.proxyBase), { ...requestOptions, signal: AbortSignal.timeout(700000) });
        console.log(`${logPrefix} Fetched with status: ${response.status}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch book detail from ${detailUrl}. Status: ${response.status}`);
        }
        const html = await response.text();
        
        let initResult: any;
        try {
            initResult = JSON.parse(html);
        } catch (e) {
            initResult = html;
        }

        // 检查API是否返回错误
        if (typeof initResult === 'object' && initResult && 'code' in initResult && initResult.code !== 0) {
            const errorMsg = initResult.msg || initResult.message || '未知错误';
            console.error(`${logPrefix} API返回错误: code=${initResult.code}, msg=${errorMsg}`);
            return res.status(400).json({ 
                success: false, 
                error: `书源API返回错误: ${errorMsg}`,
                details: `请检查书源配置或服务器状态。完整响应: ${JSON.stringify(initResult).substring(0, 500)}`
            });
        }
        
        if (bookInfoRule.init?.startsWith('$.')) {
            const keys = bookInfoRule.init.substring(2).split('.');
            let value = initResult;
            for(const key of keys) {
                if(value && typeof value === 'object' && key in value) value = value[key];
                else { value = undefined; break; }
            }
            initResult = value;
            console.log(`${logPrefix} Ran init rule "${bookInfoRule.init}", result is now:`, typeof initResult, initResult ? JSON.stringify(initResult).substring(0, 200) : 'null/undefined');
            
            // 如果init规则执行后结果为null/undefined，说明数据结构不对
            if (!initResult) {
                console.error(`${logPrefix} init规则执行后结果为空，原始数据:`, JSON.stringify(JSON.parse(html)).substring(0, 500));
                return res.status(400).json({
                    success: false,
                    error: '书源数据解析失败',
                    details: `init规则"${bookInfoRule.init}"执行后结果为空，请检查API返回的数据结构`
                });
            }
        }
        
        // 创建一个共享的变量存储，用于 java.put/get
        const sharedVariables: Record<string, any> = {};
        
        const tocUrlRaw = bookInfoRule.tocUrl || '';
        // tocUrl可能包含@js:，需要先提取CSS选择器部分
        let tocUrlToEvaluate = tocUrlRaw;
        if (tocUrlRaw.includes('\n@js:') || tocUrlRaw.includes('@js:')) {
            // 分离CSS选择器和JS代码
            const jsIndex = tocUrlRaw.indexOf('@js:');
            if (jsIndex > -1) {
                // 先提取CSS选择器部分的值
                const selectorPart = tocUrlRaw.substring(0, jsIndex).trim();
                const extractedUrl = await parseWithRules(html, selectorPart, detailUrl);
                
                // 然后用JS代码处理，注意：JS中的baseUrl指的是当前页面URL
                const jsPart = '<js>\nvar baseUrl = "' + detailUrl + '";\n' + tocUrlRaw.substring(jsIndex + 4) + '\n</js>';
                tocUrlToEvaluate = await evaluateJs(jsPart, { source, result: extractedUrl, key: url });
                console.log(`${logPrefix} ToC URL (CSS+JS处理): ${tocUrlToEvaluate}`);
            }
        } else {
            // 创建增强的context，包含共享变量存储
            const contextWithShared = { 
                source, 
                result: initResult, 
                key: url,
                sharedVariables  // 传递共享变量
            };
            tocUrlToEvaluate = await evaluateJs(tocUrlRaw, contextWithShared);
        }
        
        // 解析 @get:{path} 占位（从 initResult 对象取值）
        const resolveGetPlaceholder = (input: string): string => {
            if (!input || typeof input !== 'string') return input;
            return input.replace(/@get:\{([^}]+)\}/g, (_m, path) => {
                try {
                    const parts = String(path).split('.');
                    let v: any = initResult;
                    for (const p of parts) {
                        if (v && typeof v === 'object' && p in v) v = v[p]; else { v = undefined; break; }
                    }
                    return v != null ? String(v) : '';
                } catch { return ''; }
            });
        };
        const evaluatedTocUrl = resolveGetPlaceholder(tocUrlToEvaluate);
        console.log(`${logPrefix} Final ToC URL: ${evaluatedTocUrl}`);
        
        let tocHtml = html;
        let tocResponseUrl = detailUrl;

        if (evaluatedTocUrl && evaluatedTocUrl !== detailUrl) {
            // 处理 source.header（可能包含JS代码）
            let tocHeaders: Record<string, string> = {};
            if (source.header) {
                try {
                    if (source.header.includes('<js>')) {
                        console.log(`${logPrefix} Header contains JavaScript code, evaluating...`);
                        const headerResult = await evaluateJs(source.header, { source });
                        tocHeaders = JSON.parse(headerResult);
                        console.log(`${logPrefix} Successfully evaluated header JS:`, tocHeaders);
                    } else {
                        tocHeaders = JSON.parse(source.header);
                    }
                } catch (e) {
                    console.warn(`${logPrefix} Failed to parse header:`, e);
                }
            }
            
            let tocRequestOptions: RequestInit = { headers: tocHeaders };
            let finalTocUrl = evaluatedTocUrl;

            // 处理URL,options格式（大灰狼书源用）
            if (evaluatedTocUrl.includes(',{')) {
                const commaIndex = evaluatedTocUrl.indexOf(',{');
                finalTocUrl = evaluatedTocUrl.substring(0, commaIndex);
                try {
                    const options = JSON.parse(evaluatedTocUrl.substring(commaIndex + 1));
                    tocRequestOptions = {
                        method: options.method || 'GET',
                        headers: { ...tocRequestOptions.headers, ...options.headers },
                        body: options.body
                    }
                    // 若为POST且body为urlencoded字符串，自动补上Content-Type
                    if ((tocRequestOptions.method || 'GET').toString().toUpperCase() === 'POST') {
                        const hasCT = Object.keys((tocRequestOptions.headers || {})).some(k => k.toLowerCase() === 'content-type');
                        if (!hasCT && typeof tocRequestOptions.body === 'string') {
                            (tocRequestOptions.headers as any) = { ...(tocRequestOptions.headers as any), 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
                        }
                    }
                } catch (e) {
                    console.warn(`${logPrefix} 无法解析ToC请求选项，使用默认配置`);
                }
            }
            
            tocResponseUrl = finalTocUrl;
            console.log(`${logPrefix} Fetching ToC from URL: ${finalTocUrl}`);
            try {
                const tocCookie = await getCookieForUrl(source.id, finalTocUrl);
                const tocMergedHeaders: Record<string, string> = {
                    ...(tocRequestOptions.headers as any),
                    ...(tocCookie ? { cookie: tocCookie } : {}),
                };
                try { if (new URL(finalTocUrl).hostname.includes('langge')) (tocMergedHeaders as any)['versiontype'] = (tocMergedHeaders as any)['versiontype'] || 'reading'; } catch {}
                const tocResponse = await fetch(rewriteViaProxyBase(finalTocUrl, source.proxyBase), { ...tocRequestOptions, headers: tocMergedHeaders });
                console.log(`${logPrefix} Fetched ToC with status: ${tocResponse.status}`);
                if (tocResponse.ok) {
                    tocHtml = await tocResponse.text();
                }
            } catch (e) {
                console.warn(`${logPrefix} ToC fetch failed, continue without ToC:`, (e as any)?.message || e);
            }
        }
        
        let tocResult: any;
        try {
            tocResult = JSON.parse(tocHtml);
        } catch (e) {
            tocResult = tocHtml;
        }
        
        // 处理chapterList规则（可能包含@css:和@js:）
        let chapters: any[] = [];
        // preUpdateJs: 在目录解析前执行，允许站点对 tocHtml 做改写
        const preUpdateJs = source.rules?.toc?.preUpdateJs;
        if (preUpdateJs && preUpdateJs.startsWith('<js>')) {
            try {
                const modified = await evaluateJs(preUpdateJs, { source, result: tocHtml, sharedVariables });
                if (typeof modified === 'string' && modified.length > 0) {
                    tocHtml = modified;
                }
            } catch (e) {
                console.warn(`${logPrefix} preUpdateJs 执行失败，继续使用原始HTML`);
            }
        }
        if (tocRule.chapterList && (tocRule.chapterList.includes('@css:') || tocRule.chapterList.includes('@js:'))) {
            // 使用专门的@css:+@js:解析器
            console.log(`${logPrefix} ChapterList包含@css/@js规则，使用特殊解析器`);
            const chapterListResult = await parseRuleWithCssJs(tocHtml, tocRule.chapterList, tocResponseUrl, source);
            
            if (Array.isArray(chapterListResult)) {
                // JS返回的已经是处理好的数组
                chapters = chapterListResult.map((item: any) => ({
                    title: item[tocRule.chapterName || 'text'] || item.text,
                    url: item[tocRule.chapterUrl || 'href'] || item.href,
                    intro: item.chapterintro || item.intro || item.desc || ''
                }));
            } else {
                console.warn(`${logPrefix} @css/@js解析器未返回数组`);
            }
        } else {
            // 使用常规解析器，先获取原始数据
            const rawChapters = await parseListWithRules(tocHtml, tocRule.chapterList, {
                title: tocRule.chapterName,
                url: tocRule.chapterUrl,
                intro: '$.chapterintro||$.intro||$.desc',
                _rawData: '$.' // 保留原始章节对象
            }, tocResponseUrl, source);
            
            // 处理章节数据，确保简介被提取
            chapters = rawChapters.map((ch: any, idx: number) => {
                const intro = ch.intro || (ch._rawData?.chapterintro) || (ch._rawData?.intro) || '';
                if (idx < 3) {
                    console.log(`${logPrefix} 章节 ${idx + 1} 简介提取:`, intro ? intro.substring(0, 50) : '(无)');
                }
                return {
                    title: ch.title,
                    url: ch.url,
                    intro: intro
                };
            });
        }
        
        chapters = await Promise.all(chapters.map(async (chapter, idx) => {
            if (chapter.url && chapter.url.startsWith('<js>')) {
                chapter.url = await evaluateJs(chapter.url, { source, result: chapter, key: chapter.title, sharedVariables: {} });
            }
            return chapter;
        }));

        // Fallback: 若解析后全部被过滤为空，但接口 JSON 存在 data 数组，则直接基于 JSON 构建章节
        try {
            const asObj = typeof tocHtml === 'string' ? JSON.parse(tocHtml) : tocHtml;
            if (Array.isArray(asObj?.data) && asObj.data.length > 0) {
                const before = chapters.length;
                if (before === 0) {
                    console.log(`${logPrefix} Chapters empty after first-pass. Using JSON fallback to build chapters...`);
                    const built = await Promise.all(asObj.data.map(async (item: any) => {
                        let url = '';
                        try {
                            url = await evaluateJs(tocRule.chapterUrl || '', { source, result: item, key: item?.title || '' });
                        } catch {}
                        return {
                            title: String(item?.title || ''),
                            url,
                            intro: String(item?.chapterintro || item?.intro || ''),
                        };
                    }));
                    chapters = built.filter(ch => typeof ch.url === 'string' && ch.url.trim() && typeof ch.title === 'string' && ch.title.trim());
                }
            }
        } catch {}

        // 过滤无效章节（没有有效URL或标题的，如卷分隔项）并去重
        const seen = new Set<string>();
        chapters = chapters.filter((ch) => {
            const hasUrl = typeof ch?.url === 'string' && ch.url.trim().length > 0;
            const hasTitle = typeof ch?.title === 'string' && ch.title.trim().length > 0;
            if (!hasUrl || !hasTitle) return false;
            const key = ch.url.trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // formatJs: 目录解析完成后的格式化
        const formatJs = source.rules?.toc?.formatJs;
        if (formatJs && formatJs.startsWith('<js>')) {
            try {
                const formatted = await evaluateJs(formatJs, { source, result: JSON.stringify(chapters) });
                try {
                    const arr = JSON.parse(formatted);
                    if (Array.isArray(arr)) chapters = arr;
                } catch {
                    // 如果返回的不是JSON数组则忽略
                }
            } catch (e) {
                console.warn(`${logPrefix} formatJs 执行失败，忽略`);
            }
        }

        console.log(`${logPrefix} Found ${chapters.length} chapters.`);
        
        // 优先使用已解析到的 JSON 数据作为容器（如番茄等接口直接返回JSON），否则回退到HTML
        const bookDataContainer = (initResult && typeof initResult === 'object') ? initResult : (bookInfoRule.init?.startsWith('$.') ? initResult : html);

        // 生成并清洗简介（支持HTML，去掉危险标签与属性）
        let rawDescription = '';
        
        try {
            if (bookInfoRule.intro?.startsWith('<js>')) {
                rawDescription = await evaluateJs(bookInfoRule.intro, { source, result: initResult, baseUrl: detailUrl });
            } else {
                rawDescription = await parseWithRules(bookDataContainer, bookInfoRule.intro, detailUrl, source);
            }
        } catch (e: any) {
            console.warn(`${logPrefix} intro规则执行失败:`, e?.message || e);
        }
        
        // Fallback: 如果intro规则失败或为空，尝试从JSON直接提取
        if (!rawDescription || rawDescription.trim().length === 0) {
            console.log(`${logPrefix} intro为空，尝试从JSON fallback...`);
            try {
                const jsonData = typeof initResult === 'object' ? initResult : JSON.parse(html);
                // 尝试多种常见的简介字段名
                rawDescription = (
                    jsonData?.novelIntro || 
                    jsonData?.novelIntroShort || 
                    jsonData?.intro || 
                    jsonData?.abstract || 
                    jsonData?.description || 
                    jsonData?.des || 
                    jsonData?.summary || 
                    ''
                );
                if (rawDescription) {
                    console.log(`${logPrefix} JSON fallback成功，简介长度: ${rawDescription.length}`);
                }
            } catch (e: any) {
                console.warn(`${logPrefix} JSON fallback失败:`, e?.message);
            }
        }

        const sanitizeIntroHtml = (input: string): string => {
            if (!input || typeof input !== 'string') return '';
            try {
                const $ = cheerio.load(input, { decodeEntities: false });
                // remove dangerous nodes
                $('script, style, noscript, iframe, object, embed').remove();
                const allowed = new Set(['p','br','strong','em','b','i','ul','ol','li','span','div','a']);
                $('*').each((_i, el) => {
                    const tag = (el as any).tagName ? String((el as any).tagName).toLowerCase() : '';
                    if (!allowed.has(tag)) {
                        $(el).replaceWith($(el).text());
                        return;
                    }
                    // keep only safe attributes
                    const attribs = (el as any).attribs || {};
                    for (const attr of Object.keys(attribs)) {
                        if (!(tag === 'a' && attr === 'href')) {
                            $(el).removeAttr(attr);
                        }
                    }
                });
                // unwrap empty divs
                $('div').each((_i, el) => {
                    if (!$(el).children().length && $(el).text().trim().length === 0) {
                        $(el).remove();
                    }
                });
                return $.root().html() || '';
            } catch {
                return input;
            }
        };

        // 书名主解析
        let parsedTitle = await parseWithRules(bookDataContainer, bookInfoRule.name, detailUrl);
        if (!parsedTitle || parsedTitle.trim().length === 0) {
            try {
                // 回退1：尝试从 <title> 提取（去站点名等杂项）
                const $ = cheerio.load(typeof html === 'string' ? html : '');
                const rawTitle = ($('title').first().text() || '').trim();
                parsedTitle = rawTitle.replace(/[《》\-_|｜]|(最新章节.*$)/g, '').trim();
            } catch {}
        }
        if (!parsedTitle || parsedTitle.trim().length === 0) {
            // 回退2：使用URL末段（去掉扩展名和参数）
            try {
                const u = new URL(detailUrl);
                const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
                parsedTitle = last.replace(/\.(html?|php|aspx)$/i, '').replace(/[-_]/g, ' ').trim();
            } catch {}
        }

        // 通用字段解析，支持 '@js:' 后处理
        const parseField = async (rule?: string): Promise<string> => {
            if (!rule) return '';
            if (rule.startsWith('<js>')) {
                try { return await evaluateJs(rule, { source, result: bookDataContainer, baseUrl: detailUrl }); } catch { return ''; }
            }
            const jsIndex = rule.indexOf('@js:');
            if (jsIndex > -1) {
                const selectorPart = rule.substring(0, jsIndex).trim();
                const jsSnippet = rule.substring(jsIndex + 4);
                const baseValue = selectorPart ? await parseWithRules(bookDataContainer, selectorPart, detailUrl) : '';
                try {
                    return await runJsTransformer(jsSnippet, { source, result: baseValue, baseUrl: detailUrl as any });
                } catch {
                    return String(baseValue || '');
                }
            }
            return await parseWithRules(bookDataContainer, rule, detailUrl);
        };

        const resolvedAuthor = await parseField(bookInfoRule.author);
        const resolvedCover = await decodeCoverIfNeeded(await parseField(bookInfoRule.coverUrl), source) || await parseField(bookInfoRule.coverUrl);
        const resolvedKind = await parseField(bookInfoRule.kind);
        const resolvedLastChapter = await parseField(bookInfoRule.lastChapter);

        // 提取额外信息：从initResult中自动提取所有有用的字段
        const extraInfo: Record<string, string> = {};
        if (typeof initResult === 'object' && initResult) {
            // 定义可能有用的字段及其显示名称
            const extraFieldMappings: Record<string, string> = {
                'novelreview': '评分',
                'pv': '评分',
                'score': '评分',
                'ranking': '排行',
                'nutrition_novel': '营养值',
                'comment_count': '评论数',
                'novelStyle': '风格',
                'novelTags': '标签',
                'tags': '标签',
                'protagonist': '主角',
                'costar': '配角',
                'other': '其他',
                'mainview': '视角',
                'novelbefavoritedcount': '收藏数',
                'read_count': '阅读数',
                'word_number': '字数',
                'novelSize': '字数',
                'novelSizeformat': '字数',
                'leave': '请假条',
                'leaveContent': '请假信息'
            };
            
            for (const [fieldKey, displayName] of Object.entries(extraFieldMappings)) {
                const value = (initResult as any)[fieldKey];
                if (value && String(value).trim().length > 0 && String(value) !== 'undefined') {
                    extraInfo[displayName] = String(value);
                }
            }
            
            // console.log(`${logPrefix} 提取到 ${Object.keys(extraInfo).length} 个额外字段:`, Object.keys(extraInfo).join(', '));
        }

        const bookDetail: BookstoreBookDetail = {
            title: parsedTitle || '',
            author: resolvedAuthor,
            cover: resolvedCover,
            description: sanitizeIntroHtml(rawDescription),
            category: resolvedKind,
            latestChapter: resolvedLastChapter,
            detailUrl: detailUrl,
            // 对于无目录源（如番茄等），允许 chapters 为空数组
            chapters: chapters || [],
            extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
        };
        
        // console.log(`${logPrefix} Successfully parsed book detail: ${bookDetail.title}`);
        res.status(200).json({ success: true, book: bookDetail });

    } catch (error: any) {
        console.error(logPrefix, error);
        res.status(500).json({ success: false, error: 'Failed to fetch book details', details: error.message });
    }
}
