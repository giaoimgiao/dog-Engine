/**
 * 简化的JSONPath解析器，支持Legado书源常用的JSONPath语法
 * 
 * 支持的语法：
 * - $.property - 直接属性访问
 * - $.property.nested - 嵌套属性
 * - $..property - 递归搜索（深度优先）
 * - $..[?(@.property)] - 递归搜索包含指定属性的对象
 * - $..[?(@.property=='value')] - 递归搜索属性值匹配的对象
 * - $[*] - 数组所有元素
 * - $[0] - 数组索引
 */

export function parseJsonPath(data: any, path: string): any {
  console.log(`[parseJsonPath] Parsing path: ${path}`);
  
  if (!path || !path.startsWith('$')) {
    console.warn(`[parseJsonPath] Invalid path: ${path}`);
    return null;
  }

  // 特殊情况：$. 表示整个对象
  if (path === '$.' || path === '$') {
    return data;
  }

  // 递归搜索模式：$..[?(@.property)] 或 $..[?(@.property=='value')]
  const recursiveFilterMatch = path.match(/^\$\.\.(\[.*?\]|\w+)$/);
  if (recursiveFilterMatch) {
    const filterPart = recursiveFilterMatch[1];
    
    // 处理过滤器：[?(@.property)] 或 [?(@.property=='value')]
    const filterMatch = filterPart.match(/\[\?\(@\.(\w+)(?:==?['"]([^'"]+)['"])?\)\]/);
    if (filterMatch) {
      const propertyName = filterMatch[1];
      const expectedValue = filterMatch[2];
      console.log(`[parseJsonPath] Recursive filter search for property: ${propertyName}${expectedValue ? ` == ${expectedValue}` : ''}`);
      
      const results: any[] = [];
      recursiveSearch(data, (obj) => {
        if (obj && typeof obj === 'object' && propertyName in obj) {
          // 如果指定了值，检查值是否匹配
          if (expectedValue !== undefined) {
            if (obj[propertyName] == expectedValue) {
              results.push(obj);
            }
          } else {
            // 只要包含该属性就添加
            results.push(obj);
          }
        }
      });
      
      console.log(`[parseJsonPath] Found ${results.length} matching objects`);
      return results;
    }
    
    // 简单的递归属性搜索：$..property
    const propertyName = filterPart;
    console.log(`[parseJsonPath] Recursive property search: ${propertyName}`);
    const results: any[] = [];
    recursiveSearch(data, (obj) => {
      if (obj && typeof obj === 'object' && propertyName in obj) {
        const value = obj[propertyName];
        // 如果值是对象，返回整个对象；否则返回值本身
        results.push(typeof value === 'object' ? obj : value);
      }
    });
    console.log(`[parseJsonPath] Found ${results.length} results`);
    return results;
  }

  // 普通路径解析：$.property.nested 或 $.property[0]
  let current = data;
  const pathParts = path.substring(2).split(/\.|\[/).filter(Boolean);
  
  for (let i = 0; i < pathParts.length; i++) {
    let part = pathParts[i];
    
    // 处理数组索引：property] -> property
    if (part.endsWith(']')) {
      part = part.substring(0, part.length - 1);
    }
    
    // 处理通配符 *
    if (part === '*') {
      if (Array.isArray(current)) {
        return current;
      }
      continue;
    }
    
    // 处理数组索引
    if (/^\d+$/.test(part)) {
      const index = parseInt(part);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        console.warn(`[parseJsonPath] Trying to access array index on non-array`);
        return null;
      }
      continue;
    }
    
    // 普通属性访问
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      console.warn(`[parseJsonPath] Property "${part}" not found`);
      return null;
    }
  }
  
  return current;
}

/**
 * 递归搜索对象树，对每个对象调用回调函数
 */
function recursiveSearch(obj: any, callback: (obj: any) => void): void {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  
  // 调用回调处理当前对象
  callback(obj);
  
  // 递归处理子对象
  if (Array.isArray(obj)) {
    for (const item of obj) {
      recursiveSearch(item, callback);
    }
  } else {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        recursiveSearch(obj[key], callback);
      }
    }
  }
}

/**
 * 解析 @JSon: 规则
 * 格式：@JSon:path1&&path2&&path3 或 @JSon:path1||path2||path3
 * && 表示尝试第一个成功的路径（备选）
 * || 也表示备选路径（与&&相同）
 */
export function parseJsonRule(data: any, rule: string): any {
  console.log(`[parseJsonRule] Parsing rule: ${rule.substring(0, 100)}...`);
  
  // 移除 @JSon: 或 @Json: 前缀
  let cleanRule = rule.replace(/^@JSon:|^@Json:/i, '').trim();
  
  // 检查是否有后续的 <js> 处理
  let jsCode = '';
  const jsMatch = cleanRule.match(/(.*?)\s*<js>([\s\S]*?)<\/js>/);
  if (jsMatch) {
    cleanRule = jsMatch[1].trim();
    jsCode = jsMatch[2].trim();
    console.log(`[parseJsonRule] Found JS post-processing, length: ${jsCode.length}`);
  }
  
  // 支持 && 和 || 分隔的多个路径（尝试第一个成功的）
  // 先按 && 分隔，再按 || 分隔
  let paths: string[] = [];
  if (cleanRule.includes('&&')) {
    paths = cleanRule.split('&&').map(p => p.trim()).filter(Boolean);
  } else if (cleanRule.includes('||')) {
    paths = cleanRule.split('||').map(p => p.trim()).filter(Boolean);
  } else {
    paths = [cleanRule];
  }
  
  console.log(`[parseJsonRule] Trying ${paths.length} alternative paths`);
  
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    console.log(`[parseJsonRule] Trying path ${i + 1}: ${path}`);
    
    try {
      const result = parseJsonPath(data, path);
      
      if (result !== null && result !== undefined) {
        // 检查结果是否有效（非空数组或有效值）
        if (Array.isArray(result) && result.length === 0) {
          console.log(`[parseJsonRule] Path ${i + 1} returned empty array, trying next...`);
          continue;
        }
        
        console.log(`[parseJsonRule] ✅ Path ${i + 1} succeeded, got ${Array.isArray(result) ? result.length + ' items' : typeof result}`);
        
        // 如果有JS后处理，执行它
        if (jsCode) {
          console.log(`[parseJsonRule] Applying JS post-processing...`);
          return { result, jsCode };
        }
        
        return result;
      }
    } catch (e) {
      console.warn(`[parseJsonRule] Path ${i + 1} failed:`, e);
      continue;
    }
  }
  
  console.warn(`[parseJsonRule] All paths failed, returning empty array`);
  return [];
}
