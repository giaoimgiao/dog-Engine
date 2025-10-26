
import type { NextApiRequest, NextApiResponse } from 'next';
import type { BookstoreChapterContent } from '@/lib/types';
import { getBookSources, parseWithRules, evaluateJs } from '@/lib/book-source-utils';
import { getCookieForUrl } from '@/lib/book-source-auth';
import { parseUrlWithOptions, buildRequestInit } from '@/lib/parse-url-with-options';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, sourceId } = req.query;
    const logPrefix = '[API/bookstore/chapter]';

    console.log(`${logPrefix} Received chapter request: url=${url}, sourceId=${sourceId}`);

    if (typeof url !== 'string' || !url) {
        return res.status(400).json({ success: false, error: 'Chapter URL is required' });
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
        
        const contentRule = source.rules?.content;
        if(!contentRule){
             console.error(`${logPrefix} Source '${source.name}' is missing content rules.`);
             return res.status(501).json({ success: false, error: `Book source '${source.name}' is missing parsing rules for chapter content.` });
        }

        let chapterUrl = url;
        let requestHeaders: Record<string, string> = {};
        if (source.header) {
            try {
                requestHeaders = JSON.parse(source.header);
            } catch (e) {
                console.warn(`${logPrefix} Failed to parse source.header as JSON, checking for JS code...`);
                if (source.header.trim().startsWith('<js>') && source.header.trim().endsWith('</js>')) {
                    try {
                        const headerResult = await evaluateJs(source.header, { source });
                        requestHeaders = JSON.parse(headerResult);
                    } catch (jsError) {
                        console.error(`${logPrefix} Failed to evaluate header JS:`, jsError);
                        requestHeaders = {};
                    }
                }
            }
        }
        let requestOptions: RequestInit = { headers: requestHeaders };
        let jsContextResult: any = {};
        
        if (url.startsWith('data:')) {
            // data:;base64,<b64>,{json}
            const firstComma = url.indexOf(',');
            const rest = firstComma >= 0 ? url.substring(firstComma + 1) : '';
            const jsonStartIdx = rest.indexOf(',{');
            const encoded = jsonStartIdx >= 0 ? rest.substring(0, jsonStartIdx) : rest;
            const jsonPart = jsonStartIdx >= 0 ? rest.substring(jsonStartIdx + 1) : '';
            try { if (jsonPart.trim().startsWith('{')) jsContextResult = JSON.parse(jsonPart); } catch {}
            // 保持chapterUrl为原始dataURL，交给content JS去解析
            chapterUrl = url;
            console.log(`${logPrefix} Detected data URL. b64Len=${encoded.length}, ctxKeys=${Object.keys(jsContextResult||{}).length}`);

        } else if (url.startsWith('<js>')) {
            chapterUrl = await evaluateJs(url, { source });
            console.log(`${logPrefix} Evaluated JS URL to: ${chapterUrl}`);
        }

        // 🔧 先检查是否是相对路径（data: 则跳过补全）
        let fullChapterUrl = chapterUrl;
        if (!chapterUrl.startsWith('data:')) {
            // 提取URL部分（可能包含,{options}）
            const urlMatch = chapterUrl.match(/^([^,]+)/);
            const urlPart = urlMatch ? urlMatch[1].trim() : chapterUrl;
            
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
                    fullChapterUrl = baseUrl + urlPart + chapterUrl.substring(urlPart.length);
                    console.log(`${logPrefix} 补全相对路径URL: ${fullChapterUrl}`);
                } else {
                    console.error(`${logPrefix} 无法补全相对路径URL，未找到服务器地址`);
                    return res.status(400).json({ success: false, error: `书源配置错误：URL是相对路径（${urlPart}），但未找到服务器地址` });
                }
            }
        }
        
        // 现在解析完整的URL和请求配置（data: URL 不走网络请求）
        let html = '';
        if (!chapterUrl.startsWith('data:')) {
            const parsedUrl = parseUrlWithOptions(fullChapterUrl);
            chapterUrl = parsedUrl.url;
            console.log(`${logPrefix} Parsed request options:`, { method: parsedUrl.method, hasBody: !!parsedUrl.body, extraHeaders: Object.keys(parsedUrl.headers || {}) });
            
            console.log(`${logPrefix} Fetching chapter content from: ${chapterUrl}`);
            const cookieHeader = await getCookieForUrl(source.id, chapterUrl);
            const mergedHeaders: Record<string, string> = {
                ...requestHeaders,
                ...(parsedUrl.headers || {}), // URL中指定的headers优先级更高
                ...(cookieHeader ? { cookie: cookieHeader } : {}),
            };
            
            // 构建完整的请求配置
            requestOptions = buildRequestInit(parsedUrl, mergedHeaders);
            console.log(`${logPrefix} Final request config:`, { method: requestOptions.method, headers: Object.keys(requestOptions.headers as any), hasBody: !!requestOptions.body });
            
            const response = await fetch(chapterUrl, requestOptions);
            console.log(`${logPrefix} Fetched with status: ${response.status}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch chapter content from ${chapterUrl}. Status: ${response.status}`);
            }
            html = await response.text();
        }

        let content = '';
        
        let contentContainer: any = html;
         try {
            contentContainer = JSON.parse(html);
        } catch (e) {
            // Not JSON, it's fine
        }

        // 为书源JS提供 Legado 期望的 baseUrl：base64(queryString)
        let evalBaseUrl = chapterUrl;
        try {
            const u = new URL(chapterUrl);
            const qs = u.searchParams.toString();
            if (qs) {
                evalBaseUrl = Buffer.from(qs, 'utf-8').toString('base64');
            }
        } catch {
            // data: URL 场景，baseUrl 直接使用 base64 段
            if (chapterUrl.startsWith('data:')) {
                const firstComma = chapterUrl.indexOf(',');
                const rest = firstComma >= 0 ? chapterUrl.substring(firstComma + 1) : '';
                const jsonStartIdx = rest.indexOf(',{');
                const encoded = jsonStartIdx >= 0 ? rest.substring(0, jsonStartIdx) : rest;
                evalBaseUrl = encoded;
            }
        }

        if (contentRule.content.startsWith('<js>')) {
             // console.log(`${logPrefix} Evaluating content rule with JS.`);
             // data: URL场景：result传入base64段（解码后供JS split解析）
             let jsCarrier = html;
             if (chapterUrl.startsWith('data:')) {
                 const firstComma = chapterUrl.indexOf(',');
                 const rest = firstComma >= 0 ? chapterUrl.substring(firstComma + 1) : '';
                 const jsonStartIdx = rest.indexOf(',{');
                 const encoded = jsonStartIdx >= 0 ? rest.substring(0, jsonStartIdx) : rest;
                 // 将base64解码后作为result传入JS
                 try {
                     jsCarrier = Buffer.from(encoded, 'base64').toString('utf-8');
                     console.log(`${logPrefix} data: URL解码后传入JS，长度: ${jsCarrier.length}，内容: ${jsCarrier}`);
                 } catch {}
             }
             content = await evaluateJs(contentRule.content, { source, result: jsCarrier, baseUrl: evalBaseUrl });

             // Fallback：如果 JS 没产出正文，尝试直接从接口 JSON 取 content 字段
             if (!content || content.trim().length === 0) {
                try {
                    const asJson = typeof contentContainer === 'string' ? JSON.parse(contentContainer as any) : contentContainer;
                    const direct = (asJson && (asJson.content || asJson.data?.content)) || '';
                    if (direct && typeof direct === 'string') {
                        // console.log(`${logPrefix} JS为空，使用接口JSON中的 content 字段`);
                        content = direct;
                    }
                } catch {}
             }
             try {
                // If the result of JS is a JSON string, parse it.
                const parsedContent = JSON.parse(content);
                if(parsedContent.content) {
                    content = parsedContent.content;
                }
             } catch(e) { /* Not a JSON string, use as is */ }

             // Fallback 2：当返回为空或包含登录错误时，尝试 data: JSON 中的 get_review 接口（通常无需登录）
             try {
                const needFallback = !content || /账号存在错误|请重新登录/i.test(content);
                if (needFallback && chapterUrl.startsWith('data:')) {
                    const firstComma = chapterUrl.indexOf(',');
                    const rest = firstComma >= 0 ? chapterUrl.substring(firstComma + 1) : '';
                    const jsonStartIdx = rest.indexOf(',{');
                    const jsonPart = jsonStartIdx >= 0 ? rest.substring(jsonStartIdx + 1) : '';
                    let getReviewUrl = '';
                    try {
                        const ctx = JSON.parse(jsonPart || '{}');
                        const jsExpr = String(ctx.js || '');
                        const m = jsExpr.match(/'(https?:\/\/[^']*\/get_review[^']*)'/);
                        if (m && m[1]) getReviewUrl = m[1];
                    } catch {}
                    if (getReviewUrl) {
                        console.log(`${logPrefix} 使用get_review兜底: ${getReviewUrl}`);
                        const cookieHeader = await getCookieForUrl(source.id, getReviewUrl);
                        const headers: Record<string,string> = {
                            ...requestHeaders,
                            ...(cookieHeader ? { cookie: cookieHeader } : {})
                        };
                        const resp = await fetch(getReviewUrl, { headers });
                        const txt = await resp.text();
                        try {
                            const obj = JSON.parse(txt);
                            const direct = (obj && (obj.content || obj.data?.content)) || '';
                            if (direct) content = direct;
                        } catch {
                            if (txt && txt.trim()) content = txt;
                        }
                    }
                }
             } catch {}

        } else if (contentRule.content.startsWith('$.')) {
             console.log(`${logPrefix} Evaluating content rule with JSON path: ${contentRule.content}`);
             const keys = contentRule.content.substring(2).split('.');
             let value: any = contentContainer;
             for (const key of keys) {
                 if (value && typeof value === 'object' && key in value) value = value[key];
                 else { value = undefined; break; }
             }
             content = value || '';
        } else {
            console.log(`${logPrefix} Evaluating content rule with CSS selector: ${contentRule.content}`);
            content = await parseWithRules(html, contentRule.content, chapterUrl, source);
        }

        // 替换/清洗
        const sourceRegex = contentRule.sourceRegex;
        const replaceRegex = contentRule.replaceRegex;
        if (replaceRegex && replaceRegex.startsWith('@js:')) {
            try {
                const replaced = await evaluateJs('<js>' + replaceRegex.substring(4) + '</js>', { source, result: content });
                if (typeof replaced === 'string' && replaced.length > 0) {
                    content = replaced;
                }
            } catch (e) {
                // ignore
            }
        } else if (replaceRegex) {
            try {
                const reg = new RegExp(replaceRegex, 'g');
                content = content.replace(reg, '');
            } catch {}
        } else {
            // no replaceRegex
        }

        // 额外噪声过滤：若误拿到“段评/评论页面”的CSS/JS文本，尽量剔除
        try {
            const looksLikeCssJs = (txt: string) => /:root\s*\{|document\.addEventListener|comment\-modal|comment\-type\-btn|position:\s*fixed|animation:|@keyframes|const\s+urlParams|let\s+bookId|function\s+render/.test(txt);
            if (looksLikeCssJs(content)) {
                const cssJsPatterns = [
                    /:root[\s\S]*?\}/g,
                    /@keyframes[\s\S]*?\}/g,
                    /\b(document|window)\.[\s\S]*?;\s*/g,
                    /\b(const|let|var)\s+[\s\S]*?;\s*/g,
                ];
                for (const r of cssJsPatterns) content = content.replace(r, '');
                // 行级过滤（常见CSS/JS语句）
                content = content
                    .split(/\r?\n/)
                    .filter(l => !/(^\s*[.#:\\w-]+\s*\{|\}|;\s*$|\b(background|color|border|opacity|transition|transform|cursor|display|position|padding|margin|width|height)\s*:)/.test(l))
                    .filter(l => !/^(const|let|var)\b|=>|function\b/.test(l))
                    .filter(l => !/加载中\.\.\.|^\s*$/.test(l))
                    .join('\n');
            }
            // 移除“账号错误/请重新登录”提示文字
            content = content.replace(/您当前账号存在错误！?请重新登录！?/g, '');
        } catch {}

        // 统一规范化：换行、空白、去标签
        content = content
            .replace(/&nbsp;/gi, ' ')
            .replace(/<br\s*\/?\s*>/gi, '\n')
            .replace(/<p\b[^>]*>/gi, '')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .map(line => line.replace(/\s+/g, ' ').trim())
            .filter(line => line.length > 0)
            .join('\n\n');

        if (sourceRegex) {
            try {
                const reg = new RegExp(sourceRegex, 'g');
                content = content.replace(reg, '');
            } catch {}
        }
        
        // console.log(`${logPrefix} Successfully parsed content.`);

        // 章节标题：优先从 JSON 获取，然后使用规则，最后退回 HTML <title>
        let chapterTitle = '';
        
        // 1. 优先尝试从 JSON 直接获取章节名
        try {
            const obj = typeof contentContainer === 'string' ? JSON.parse(contentContainer as any) : contentContainer;
            chapterTitle = (obj && (obj.chaptername || obj.chapterName || obj.title || obj.data?.chaptername)) || '';
            console.log(`${logPrefix} JSON chapterTitle:`, chapterTitle || '(empty)');
        } catch (e: any) {
            console.warn(`${logPrefix} JSON parse failed:`, e?.message);
        }
        
        // 2. 如果有 chapterName 规则，使用规则解析
        if (!chapterTitle && contentRule.chapterName) {
            if (contentRule.chapterName.startsWith('<js>')) {
                console.log(`${logPrefix} Evaluating chapterName JS...`);
                try {
                    chapterTitle = await evaluateJs(contentRule.chapterName, { 
                        source, 
                        result: contentContainer,
                        baseUrl: evalBaseUrl 
                    });
                } catch (e: any) {
                    console.warn(`${logPrefix} ChapterName JS failed:`, e?.message || e);
                }
            } else {
                try {
                    chapterTitle = await parseWithRules(contentContainer, contentRule.chapterName, chapterUrl, source);
                } catch {}
            }
        }
        
        // 2.5 data: URL 场景下，直接从 base64 解码串中提取章节名
        if (!chapterTitle && chapterUrl.startsWith('data:')) {
            try {
                const firstComma = chapterUrl.indexOf(',');
                const rest = firstComma >= 0 ? chapterUrl.substring(firstComma + 1) : '';
                const jsonStartIdx = rest.indexOf(',{');
                const encoded = jsonStartIdx >= 0 ? rest.substring(0, jsonStartIdx) : rest;
                const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
                const parts = decoded.split('大灰狼融合4');
                if (parts.length >= 3) {
                    const t = parts[2];
                    if (t && t.trim()) {
                        chapterTitle = t.trim();
                        console.log(`${logPrefix} 从data:串提取到章节名: ${chapterTitle}`);
                    }
                }
            } catch {}
        }

        // 3. 最后退回 HTML <title>
        if (!chapterTitle) {
            console.log(`${logPrefix} No title found, using HTML <title> fallback...`);
            chapterTitle = await parseWithRules(html, 'title', chapterUrl, source);
        }
        
        console.log(`${logPrefix} Final chapterTitle:`, chapterTitle);
        
        // 处理下一页链接：支持 JS/CSS/JSON 规则
        let nextUrl: string | undefined = undefined;
        if (contentRule.nextContentUrl) {
            if (contentRule.nextContentUrl.startsWith('<js>')) {
                let evalBaseUrl2 = chapterUrl;
                try {
                    const u2 = new URL(chapterUrl);
                    const qs2 = u2.searchParams.toString();
                    if (qs2) evalBaseUrl2 = Buffer.from(qs2, 'utf-8').toString('base64');
                } catch {}
                nextUrl = await evaluateJs(contentRule.nextContentUrl, { source, result: html, baseUrl: evalBaseUrl2 });
            } else {
                // 使用常规规则解析（支持 id./class./text.@href 等）
                nextUrl = await parseWithRules(html, contentRule.nextContentUrl, chapterUrl, source);
            }
        }

        const chapterContent: BookstoreChapterContent = {
            title: chapterTitle,
            content,
            nextChapterUrl: nextUrl,
            prevChapterUrl: undefined, // Note: prevChapterUrl is not part of the spec, would require more logic
        };
        
        // console.log(`${logPrefix} Returning chapter: ${chapterContent.title}`);
        res.status(200).json({ success: true, chapter: chapterContent });

    } catch (error: any) {
        console.error(logPrefix, error);
        res.status(500).json({ success: false, error: 'Failed to fetch chapter content.', details: error.message });
    }
}
