import type { NextApiRequest, NextApiResponse } from 'next';
import { parseUrlWithOptions, buildRequestInit } from '@/lib/parse-url-with-options';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).send('Missing url');
    }

    // 解析 Legado 风格的 URL,{options}
    const parsed = parseUrlWithOptions(url);
    let targetUrl = parsed.url;
    // 防止重复代理导致无限循环
    if (targetUrl.startsWith('/api/proxy-image')) {
      return res.status(400).send('Invalid url');
    }

    const origin = (() => {
      try { return new URL(targetUrl).origin; } catch { return undefined; }
    })();

    const baseHeaders: Record<string, string> = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      // 常见防盗链：设置 Referer 为图片域名
      ...(origin ? { referer: origin } : {}),
      // 某些站点需要 Accept
      'accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
    };

    // 合并自 URL options 的自定义头
    const requestInit = buildRequestInit(parsed, baseHeaders);

    const response = await fetch(targetUrl, requestInit);
    if (!response.ok) {
      return res.status(response.status).send('Upstream error');
    }

    // 透传 content-type 与缓存
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/*');
    const cacheControl = response.headers.get('cache-control') || 'public, max-age=3600';
    res.setHeader('Cache-Control', cacheControl);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.status(200).send(buffer);
  } catch (e: any) {
    res.status(500).send(e?.message || 'Proxy failed');
  }
}


