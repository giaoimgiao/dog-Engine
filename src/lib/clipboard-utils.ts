/**
 * 跨浏览器的剪贴板工具函数
 * 支持现代 Clipboard API 和传统降级方案
 */

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<boolean> 是否成功复制
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        // 优先使用现代 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        
        // 降级方案：使用传统 document.execCommand 方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 将元素移出视野
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (err) {
            console.error('execCommand copy failed:', err);
        }
        
        document.body.removeChild(textArea);
        return success;
    } catch (error) {
        console.error('Copy to clipboard failed:', error);
        return false;
    }
}

/**
 * 检查剪贴板 API 是否可用
 */
export function isClipboardSupported(): boolean {
    // 检查现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return true;
    }
    
    // 检查传统方法
    try {
        return document.queryCommandSupported('copy');
    } catch {
        return false;
    }
}

