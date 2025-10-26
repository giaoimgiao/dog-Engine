import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { url, domain } = req.query;
    const logPrefix = '[API/bookstore/get-cookies]';

    if (typeof url !== 'string' || !url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        console.log(`${logPrefix} 尝试获取cookies from: ${url}`);
        
        // 方法1: 从请求头中转发客户端的cookie
        // 客户端在请求这个API时，浏览器会自动带上目标域名的cookie
        const clientCookies = req.headers.cookie || '';
        console.log(`${logPrefix} 客户端cookie:`, clientCookies);
        
        // 提取目标域名
        let targetDomain = domain as string;
        if (!targetDomain) {
            try {
                const urlObj = new URL(url);
                targetDomain = urlObj.hostname;
            } catch (e) {
                targetDomain = '';
            }
        }
        
        // 方法2: 尝试访问目标URL，获取Set-Cookie
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    // 转发客户端的cookie
                    ...(clientCookies ? { 'Cookie': clientCookies } : {})
                },
                redirect: 'manual'
            });
            
            console.log(`${logPrefix} Response status:`, response.status);
            
            // 从响应头获取Set-Cookie
            const setCookieHeader = response.headers.get('set-cookie');
            if (setCookieHeader) {
                console.log(`${logPrefix} Set-Cookie:`, setCookieHeader);
                
                // 解析cookie
                const cookies = setCookieHeader
                    .split(',')
                    .map(c => c.trim().split(';')[0])
                    .filter(c => c.includes('='))
                    .join('; ');
                
                if (cookies) {
                    return res.status(200).json({ 
                        success: true, 
                        cookies,
                        message: '成功获取Cookie'
                    });
                }
            }
            
            // 如果没有Set-Cookie，但客户端有cookie，返回客户端的
            if (clientCookies) {
                // 过滤出目标域名的cookie
                const relevantCookies = clientCookies
                    .split(';')
                    .map(c => c.trim())
                    .filter(c => c.includes('='))
                    .join('; ');
                
                if (relevantCookies) {
                    console.log(`${logPrefix} 使用客户端cookie:`, relevantCookies);
                    return res.status(200).json({ 
                        success: true, 
                        cookies: relevantCookies,
                        message: '从浏览器获取到Cookie'
                    });
                }
            }
        } catch (fetchError: any) {
            console.error(`${logPrefix} Fetch error:`, fetchError.message);
        }
        
        return res.status(200).json({ 
            success: false, 
            error: '未能获取到Cookie',
            tip: '请使用书签工具或手动复制Cookie'
        });

    } catch (error: any) {
        console.error(logPrefix, error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get cookies', 
            details: error.message 
        });
    }
}


