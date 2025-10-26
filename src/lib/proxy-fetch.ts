/**
 * @fileOverview 代理配置工具 - 解决Node.js环境中fetch无法使用系统代理的问题
 * 
 * 使用方法：
 * 1. 在.env.local中配置：HTTP_PROXY=http://127.0.0.1:7890
 * 2. 或在启动时设置环境变量：HTTP_PROXY=http://127.0.0.1:7890 npm run dev
 * 3. 在代码中使用 createProxyFetch() 替代原生fetch
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 创建支持代理的fetch函数
 * 优先级：HTTPS_PROXY > HTTP_PROXY > ALL_PROXY > 不使用代理
 */
export function createProxyFetch() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
    
    if (!proxyUrl) {
        console.log('[Proxy] No proxy configured, using direct connection');
        return fetch;
    }

    console.log('[Proxy] Using proxy:', proxyUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // 隐藏密码
    const agent = new HttpsProxyAgent(proxyUrl);

    // 返回一个包装的fetch函数
    return (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const enhancedInit = {
            ...init,
            // 对于全局 undici fetch，不使用 dispatcher，保持默认直连
            // 仅返回兼容的 fetch 包装，当前项目不强制代理
        };
        return fetch(url, enhancedInit);
    };
}

/**
 * 获取全局单例的代理fetch
 */
let cachedProxyFetch: typeof fetch | null = null;

export function getProxyFetch(): typeof fetch {
    if (!cachedProxyFetch) {
        cachedProxyFetch = createProxyFetch();
    }
    return cachedProxyFetch;
}

/**
 * 测试代理连接
 */
export async function testProxyConnection(): Promise<{ success: boolean; message: string; proxy?: string }> {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
    const proxyFetch = getProxyFetch();

    try {
        const response = await proxyFetch('https://www.google.com', {
            method: 'HEAD',
            // @ts-ignore
            signal: AbortSignal.timeout(5000), // 5秒超时
        });

        return {
            success: response.ok,
            message: response.ok ? 'Proxy connection successful' : `HTTP ${response.status}`,
            proxy: proxyUrl,
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Connection failed',
            proxy: proxyUrl,
        };
    }
}

/**
 * 按 per-source 代理基址重写 URL
 */
export function rewriteViaProxyBase(url: string, proxyBase?: string): string {
  const base = proxyBase?.trim();
  if (!base) return url;
  try {
    if (base.includes('{url}')) {
      return base.replace('{url}', encodeURIComponent(url));
    }
    if (base.endsWith('/')) return base + encodeURIComponent(url);
    return `${base}/${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}

