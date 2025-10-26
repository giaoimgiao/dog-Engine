import type { NextApiRequest, NextApiResponse } from 'next';
import { getBookSources } from '@/lib/book-source-utils';
import { VM } from 'vm2';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { sourceId } = req.query;
    const logPrefix = '[API/bookstore/get-login-ui]';

    if (typeof sourceId !== 'string' || !sourceId) {
        return res.status(400).json({ success: false, error: 'sourceId is required' });
    }

    try {
        const sources = await getBookSources();
        const source = sources.find(s => s.id === sourceId);

        if (!source) {
            return res.status(404).json({ success: false, error: 'Book source not found' });
        }

        if (!source.loginUi) {
            return res.status(200).json({ success: true, items: [] });
        }

        console.log(`${logPrefix} Parsing loginUi for source: ${source.name}`);
        console.log(`${logPrefix} loginUi length: ${source.loginUi.length}`);

        // 使用VM2在服务端安全地解析loginUi（因为它可能包含JavaScript表达式）
        try {
            // 方法1: 直接尝试JSON.parse
            const items = JSON.parse(source.loginUi.trim());
            console.log(`${logPrefix} Successfully parsed loginUi as JSON, ${items.length} items`);
            return res.status(200).json({ success: true, items });
        } catch (e) {
            console.log(`${logPrefix} Direct JSON.parse failed, trying VM evaluation...`);
        }

        // 方法2: 使用VM2执行（处理包含JavaScript表达式的情况）
        try {
            const vm = new VM({
                timeout: 5000,
                sandbox: {
                    // 提供必要的全局对象
                }
            });
            
            // 包装成可执行的JS代码
            const code = `module.exports = ${source.loginUi.trim()};`;
            const items = vm.run(code);
            
            if (Array.isArray(items)) {
                console.log(`${logPrefix} Successfully evaluated loginUi with VM, ${items.length} items`);
                return res.status(200).json({ success: true, items });
            } else {
                throw new Error('loginUi evaluation did not return an array');
            }
        } catch (e: any) {
            console.error(`${logPrefix} VM evaluation failed:`, e.message);
        }

        // 方法3: 尝试修复常见的JSON格式问题
        try {
            let fixedJson = source.loginUi
                .trim()
                .replace(/^\n+/, '')
                // 移除注释
                .replace(/\/\/[^\n]*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '');
            
            // 尝试使用eval在隔离环境中执行
            const vm = new VM({ timeout: 5000 });
            const items = vm.run(`(${fixedJson})`);
            
            if (Array.isArray(items)) {
                console.log(`${logPrefix} Successfully parsed with eval, ${items.length} items`);
                return res.status(200).json({ success: true, items });
            }
        } catch (e: any) {
            console.error(`${logPrefix} Eval parsing failed:`, e.message);
        }

        // 所有方法都失败了
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to parse loginUi',
            details: 'loginUi格式无法识别，请检查书源配置'
        });

    } catch (error: any) {
        console.error(logPrefix, error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get login UI', 
            details: error.message 
        });
    }
}

