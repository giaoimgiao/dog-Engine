import type { NextApiRequest, NextApiResponse } from 'next';
import { getBookSources, evaluateJs } from '@/lib/book-source-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { sourceId, action, textInputs } = req.body;
    const logPrefix = '[API/bookstore/execute-action]';

    console.log(`${logPrefix} Executing action for source ${sourceId}: ${action}`);

    if (!sourceId || !action) {
        return res.status(400).json({ success: false, error: 'sourceId and action are required' });
    }

    try {
        const sources = await getBookSources();
        const source = sources.find(s => s.id === sourceId);

        if (!source) {
            return res.status(404).json({ success: false, error: 'Book source not found' });
        }

        // 构建包含用户输入的 loginInfoMap
        const loginInfoMap: Record<string, string> = textInputs || {};
        
        // 创建一个增强的sandbox，包含用户输入的值
        const wrappedAction = `<js>
// 模拟 source.getLoginInfoMap() 返回用户输入的值
const mockLoginInfoMap = ${JSON.stringify(loginInfoMap)};
const originalGetLoginInfoMap = source.getLoginInfoMap;
source.getLoginInfoMap = function() {
    return mockLoginInfoMap;
};

// 收集所有 toast 消息
let toastMessages = [];
const originalToast = java.toast;
const originalLongToast = java.longToast;
java.toast = function(msg) {
    toastMessages.push(String(msg));
    originalToast(msg);
};
java.longToast = function(msg) {
    toastMessages.push(String(msg));
    originalLongToast(msg);
};

// 执行用户的action
try {
    ${action};
} catch (e) {
    toastMessages.push('执行失败: ' + e.message);
}

// 返回收集到的消息
JSON.stringify({ messages: toastMessages });
</js>`;

        const result = await evaluateJs(wrappedAction, { source });
        
        let messages: string[] = [];
        try {
            const parsed = JSON.parse(result);
            messages = parsed.messages || [];
        } catch (e) {
            messages = [result];
        }

        console.log(`${logPrefix} Action executed, messages:`, messages);

        res.status(200).json({ 
            success: true, 
            message: messages.join('\n') || '操作完成'
        });

    } catch (error: any) {
        console.error(logPrefix, error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to execute action', 
            details: error.message 
        });
    }
}

