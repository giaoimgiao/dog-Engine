/**
 * 解析Legado格式的URL和请求配置
 * 格式：URL,{json配置}
 * 
 * 示例：
 * - https://example.com/api,{'method':'POST','body':'data=123'}
 * - https://example.com/api,{"headers":{"token":"abc"}}
 */

export interface ParsedUrlOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * 解析Legado格式的URL字符串
 * @param urlString - 可能包含配置的URL字符串
 * @returns 解析后的URL和请求配置
 */
export function parseUrlWithOptions(urlString: string): ParsedUrlOptions {
  if (!urlString || typeof urlString !== 'string') {
    return { url: urlString };
  }

  // 检查是否包含配置（格式：URL,{...}）
  // 使用正则匹配逗号后面的JSON配置
  const match = urlString.match(/^([^,]+),\s*(\{.+\})$/);
  
  if (!match) {
    // 没有配置，直接返回原URL
    return { url: urlString };
  }

  const url = match[1].trim();
  const optionsStr = match[2].trim();

  // 先尝试直接按标准JSON解析（多数情况已是合法JSON）
  try {
    const options = JSON.parse(optionsStr);
    return {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    };
  } catch {}

  // 回退：容忍单引号与未加引号的键名，但只补键名，不触碰字符串值（避免破坏 https://）
  try {
    let normalizedJson = optionsStr.replace(/'/g, '"');
    // 仅在对象起始或逗号后的位置为未加引号的键名补上引号
    normalizedJson = normalizedJson.replace(/([\{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');

    const options = JSON.parse(normalizedJson);
    return {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
    };
  } catch (e) {
    console.error('[parseUrlWithOptions] Failed to parse options:', e);
    console.error('[parseUrlWithOptions] Options string:', optionsStr);
    return { url: urlString };
  }
}

/**
 * 将解析的配置合并到RequestInit对象中
 * @param parsedOptions - 解析后的URL配置
 * @param baseHeaders - 基础headers
 * @returns 完整的RequestInit对象
 */
export function buildRequestInit(
  parsedOptions: ParsedUrlOptions,
  baseHeaders: Record<string, string> = {}
): RequestInit {
  const headers: Record<string, string> = {
    ...baseHeaders,
    ...(parsedOptions.headers || {}),
  };
  
  // 如果有body但没有Content-Type，自动添加
  if (parsedOptions.body && !headers['Content-Type'] && !headers['content-type']) {
    // 检测body格式
    if (typeof parsedOptions.body === 'string') {
      if (parsedOptions.body.startsWith('{') || parsedOptions.body.startsWith('[')) {
        headers['Content-Type'] = 'application/json';
      } else if (parsedOptions.body.includes('=') && parsedOptions.body.includes('&')) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
  }
  
  return {
    method: parsedOptions.method || 'GET',
    headers,
    body: parsedOptions.body,
  };
}
