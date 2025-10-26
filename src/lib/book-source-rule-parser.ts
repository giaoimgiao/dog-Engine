/**
 * 处理书源中的特殊规则格式
 * @css: + @js: 混合规则
 */

import * as cheerio from 'cheerio';
import { VM } from 'vm2';
import type { BookSource } from './types';

/**
 * 处理 @css: 和 @js: 混合规则
 * 格式：
 * @css:
 * .selector
 * @js:
 * JavaScript代码
 */
export async function parseRuleWithCssJs(
    html: string,
    rule: string,
    baseUrl: string,
    source?: BookSource
): Promise<any> {
    
    // 检查是否包含 @css: 或 @js:
    if (!rule.includes('@css:') && !rule.includes('@js:')) {
        return null; // 不是混合规则，返回null让调用者用其他方式处理
    }
    
    const $ = cheerio.load(html);
    let cssResult: any = null;
    let jsResult: any = null;
    
    // 分离 @css: 和 @js: 部分
    const cssMatch = rule.match(/@css:\s*([\s\S]*?)(?=@js:|$)/);
    const jsMatch = rule.match(/@js:\s*([\s\S]*?)$/);
    
    // 执行CSS选择
    if (cssMatch && cssMatch[1]) {
        let cssSelector = cssMatch[1].trim();
        // 支持一行内多个选择器（以逗号或换行分隔），并清理每行末尾多余逗号，避免出现",,"空子选择器
        cssSelector = cssSelector
            .split(/\n+/)
            .map(s => s.trim().replace(/,\s*$/g, ''))
            .filter(Boolean)
            .join(',');
        // 合并重复逗号，去除首尾逗号
        cssSelector = cssSelector.replace(/,\s*,+/g, ',').replace(/^,+|,+$/g, '');
        // 支持 li!0 语法
        cssSelector = cssSelector.replace(/!([0-9]+)/g, ':not(:eq($1))');
        console.log(`[parseRuleWithCssJs] CSS选择器: ${cssSelector.substring(0, 100)}`);
        
        // 使用cheerio选择元素
        cssResult = $(cssSelector);
        console.log(`[parseRuleWithCssJs] CSS选择到 ${cssResult.length} 个元素`);
    }
    
    // 执行JS处理
    if (jsMatch && jsMatch[1]) {
        const jsCode = jsMatch[1].trim();
        console.log(`[parseRuleWithCssJs] 执行JS代码，长度: ${jsCode.length}`);
        
        // 将cheerio结果转换为数组，每个元素带.select()方法
        const cheerioArray: any = [];
        if (cssResult && cssResult.length > 0) {
            cssResult.each((_i: number, elem: any) => {
                const wrapped: any = $(elem);
                // 添加.select()方法（别名为.find()），并为返回集合提供 forEach 垫片
                wrapped.select = (selector: string) => {
                    let collection: any = wrapped.find(selector);
                    try {
                        // 如果自身匹配选择器，则将自身也包含进结果，兼容 li.select('li') 的写法
                        if (typeof (wrapped as any).is === 'function' && (wrapped as any).is(selector)) {
                            collection = (wrapped as any).add(collection);
                        }
                    } catch (_) {}
                    if (typeof collection.forEach !== 'function') {
                        collection.forEach = (cb: (el: any, index: number) => void) => {
                            collection.each((idx: number, el: any) => {
                                const child: any = $(el);
                                // 递归补充 select 支持链式调用
                                child.select = (sel: string) => {
                                    let sub: any = child.find(sel);
                                    try {
                                        if (typeof child.is === 'function' && child.is(sel)) {
                                            sub = child.add(sub);
                                        }
                                    } catch (_) {}
                                    if (typeof sub.forEach !== 'function') {
                                        sub.forEach = (cb2: (el2: any, index2: number) => void) => {
                                            sub.each((idx2: number, el2: any) => {
                                                const subChild: any = $(el2);
                                                subChild.select = (sel2: string) => subChild.find(sel2);
                                                cb2(subChild, idx2);
                                            });
                                        };
                                    }
                                    return sub;
                                };
                                cb(child, idx);
                            });
                        };
                    }
                    return collection;
                };
                cheerioArray.push(wrapped);
            });
        }
        
        const sandbox: any = {
            result: cheerioArray.length > 0 ? cheerioArray : (cssResult || html),  // 优先使用包装后的元素数组
            $: cheerioArray.length > 0 ? cheerioArray : $,  // cheerio元素数组或完整的$
            baseUrl,
            source,
            list: [],
            text: '',
            href: '',
            info: '',
            // Mock java methods
            java: {
                toast: (msg: string) => console.log(`[Mock] toast: ${msg}`),
            }
        };
        
        const vm = new VM({
            timeout: 15000,
            sandbox,
            eval: false,
            wasm: false,
        });
        
        try {
            jsResult = vm.run(jsCode);
            console.log(`[parseRuleWithCssJs] JS执行成功，结果类型: ${Array.isArray(jsResult) ? `数组(${jsResult.length})` : typeof jsResult}`);
        } catch (e: any) {
            console.error(`[parseRuleWithCssJs] JS执行失败:`, e.message);
            throw new Error(`JS execution failed: ${e.message}`);
        }
    }
    
    // 返回JS结果，如果没有JS则返回CSS结果
    return jsResult !== null ? jsResult : cssResult;
}

