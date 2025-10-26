/**
 * @fileOverview 前端直调Gemini API工具库
 * 用户可以使用自己的API密钥，通过自己的网络访问Gemini API
 * 完全绕过后端代理问题
 */

export interface GeminiModel {
    id: string;
    name: string;
    displayName: string;
    description?: string;
}

export interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface GeminiGenerateRequest {
    contents: GeminiMessage[];
    generationConfig?: {
        temperature?: number;
        maxOutputTokens?: number;
        topP?: number;
        topK?: number;
        thinkingConfig?: {
            thinkingBudget?: number;
        };
    };
    safetySettings?: Array<{
        category: string;
        threshold: string;
    }>;
}

export interface GeminiGenerateResponse {
    candidates: Array<{
        content: {
            parts: Array<{ text: string }>;
            role: string;
        };
        finishReason: string;
    }>;
    usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

/**
 * 是否开启Gemini调试日志（localStorage: 'gemini-debug'）
 */
function isGeminiDebugEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const v = localStorage.getItem('gemini-debug');
    return v === '1' || v === 'true' || v === 'on';
}

function getGeminiTimeoutMs(): number {
    if (typeof window === 'undefined') return 30000;
    const raw = localStorage.getItem('gemini-timeout-ms');
    const n = raw ? parseInt(raw, 10) : 30000;
    return Number.isFinite(n) && n >= 5000 ? n : 30000;
}

function getGeminiRetries(): number {
    if (typeof window === 'undefined') return 1;
    const raw = localStorage.getItem('gemini-retries');
    const n = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(n) && n >= 0 && n <= 3 ? n : 1;
}

// 用户可控的安全阈值：localStorage 设置 'gemini-safety' 为 'off' 以完全关闭
function getSafetyMode(): 'off' | 'default' {
    if (typeof window === 'undefined') return 'default';
    const v = (localStorage.getItem('gemini-safety') || '').toLowerCase();
    return v === 'off' ? 'off' : 'default';
}

function buildSafetySettings(): GeminiGenerateRequest['safetySettings'] {
    // 始终使用 BLOCK_NONE，完全禁用所有安全过滤
    // 这样可以避免内容被安全策略拦截
    const BLOCK_NONE = 'BLOCK_NONE';
    return [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: BLOCK_NONE },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: BLOCK_NONE },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: BLOCK_NONE },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: BLOCK_NONE },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: BLOCK_NONE },
    ];
}

/**
 * 从localStorage获取API密钥
 */
export function getApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('gemini-api-key');
}

/**
 * 保存API密钥到localStorage
 */
export function saveApiKey(apiKey: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('gemini-api-key', apiKey.trim());
}

/**
 * 清除API密钥
 */
export function clearApiKey(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('gemini-api-key');
}

/**
 * 检查是否已配置API密钥
 */
export function hasApiKey(): boolean {
    const key = getApiKey();
    return !!key && key.length > 0;
}

/**
 * 获取可用的Gemini模型列表
 */
export async function listGeminiModels(apiKey?: string): Promise<GeminiModel[]> {
    const key = apiKey || getApiKey();
    if (!key) {
        throw new Error('请先配置Gemini API密钥');
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`获取模型列表失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        return data.models
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => ({
                id: m.name.replace('models/', ''),
                name: m.name.replace('models/', ''),
                displayName: m.displayName,
                description: m.description,
            }))
            .sort((a: GeminiModel, b: GeminiModel) => a.displayName.localeCompare(b.displayName));
    } catch (error: any) {
        console.error('Failed to fetch models:', error);
        // 返回默认模型列表作为fallback
        return [
            { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite' },
            { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
            { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
        ];
    }
}

/**
 * 调用Gemini API生成内容
 */
export async function generateContent(
    modelId: string,
    prompt: string,
    options?: {
        temperature?: number;
        maxOutputTokens?: number;
        systemInstruction?: string;
        topP?: number;
        topK?: number;
        thinkingBudget?: number;
        apiKey?: string;
    }
): Promise<string> {
    const key = options?.apiKey || getApiKey();
    if (!key) {
        throw new Error('请先配置Gemini API密钥');
    }

    const messages: GeminiMessage[] = [];
    
    // 如果有系统指令，作为第一条用户消息
    if (options?.systemInstruction) {
        messages.push({
            role: 'user',
            parts: [{ text: options.systemInstruction }],
        });
    }
    
    // 添加用户提示
    messages.push({
        role: 'user',
        parts: [{ text: prompt }],
    });

    // 构建生成配置
    const generationConfig: any = {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
    };

    // 添加topP和topK参数（如果提供）
    if (options?.topP !== undefined) {
        generationConfig.topP = options.topP;
    }
    if (options?.topK !== undefined) {
        generationConfig.topK = options.topK;
    }

    // 添加思考配置（仅Gemini 2.5系列支持）
    if (options?.thinkingBudget !== undefined && modelId.includes('gemini-2.5')) {
        generationConfig.thinkingConfig = {
            thinkingBudget: options.thinkingBudget
        };
    }

    const requestBody: GeminiGenerateRequest = {
        contents: messages,
        generationConfig,
        safetySettings: buildSafetySettings(),
    };

    try {
        if (isGeminiDebugEnabled()) {
            try {
                const payloadPreview = messages
                    .map(m => `[${m.role}] ` + (m.parts || []).map(p => p?.text || '').join(''))
                    .join('\n');
                // 打印完整提示文本（用于排查 <br>、标签残留等问题）
                console.debug('[Gemini][request]', {
                    modelId,
                    temperature: requestBody.generationConfig?.temperature,
                    maxOutputTokens: requestBody.generationConfig?.maxOutputTokens,
                    messageCount: messages.length,
                    payload: payloadPreview,
                });
            } catch {
                // ignore
            }
        }

        const timeoutMs = getGeminiTimeoutMs();
        const retries = getGeminiRetries();
        let response: Response | null = null;
        let lastError: any = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (isGeminiDebugEnabled() && retries > 0) {
                    console.debug('[Gemini][attempt]', { attempt: attempt + 1, retries: retries + 1, timeoutMs });
                }
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                        // @ts-ignore - AbortSignal.timeout supported in modern browsers
                        signal: (AbortSignal as any)?.timeout?.(timeoutMs),
                    }
                );
                break; // success
            } catch (e: any) {
                lastError = e;
                const msg = String(e?.message || e);
                const isTimeout = msg.includes('timed out') || msg.includes('Timeout') || msg.includes('AbortError');
                const isNetwork = msg.includes('Failed to fetch') || msg.includes('Network') || e?.name === 'TypeError';
                if (attempt < retries && (isTimeout || isNetwork)) {
                    continue; // retry
                }
                throw e;
            }
        }
        // non-null assertion after loop
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nonNullResponse = response!;

        if (!nonNullResponse.ok) {
            const errorText = await nonNullResponse.text();
            console.error('Gemini API error:', errorText);
            // Debug模式：抛出原始响应文本，便于定位问题
            if (isGeminiDebugEnabled()) {
                throw new Error(`[RAW ${nonNullResponse.status}] ${errorText}`);
            }
            // 解析常见错误，给出更友好的提示
            try {
                const err = JSON.parse(errorText);
                const code = err?.error?.status || String(nonNullResponse.status);
                const reason = Array.isArray(err?.error?.details)
                    ? (err.error.details.find((d: any) => d?.reason)?.reason || '')
                    : '';
                const message = err?.error?.message || 'API调用失败';
                if (reason === 'API_KEY_INVALID' || code === 'INVALID_ARGUMENT') {
                    throw new Error('API密钥无效，请在右上角「AI设置」中重新配置并点击“测试连接”。');
                }
                if (code === 'PERMISSION_DENIED') {
                    throw new Error('没有权限访问该API，请确认使用的是 Google AI Studio 的密钥，且已开通 Generative Language API。');
                }
                if (code === 'RESOURCE_EXHAUSTED') {
                    throw new Error('已达到配额或速率限制，请稍后重试或更换模型/账号。');
                }
                if (code === 'NOT_FOUND' || message.includes('model')) {
                    throw new Error('模型不可用或名称不正确，请更换为可用模型（例如 gemini-2.5-flash）。');
                }
                throw new Error(`${message}`);
            } catch (_) {
                throw new Error(`API调用失败: ${nonNullResponse.status}`);
            }
        }

        if (isGeminiDebugEnabled()) {
            try {
                const raw = await nonNullResponse.clone().text();
                console.debug('[Gemini][rawResponse]', raw.length > 5000 ? raw.slice(0, 5000) + '...<truncated>' : raw);
            } catch {
                // ignore
            }
        }

        const data: any = await nonNullResponse.json();

        // 处理安全拦截与空候选
        const promptFeedback = data?.promptFeedback;
        if (promptFeedback?.blockReason) {
            throw new Error(`内容被安全策略拦截（${promptFeedback.blockReason}）。请调整提示词或降低敏感内容。`);
        }

        const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
        if (candidates.length === 0) {
            throw new Error('模型未返回内容，请稍后重试或更换模型。');
        }

        // 优先取第一个候选的 parts 文本；若不存在则汇总所有候选的文本
        const firstParts = candidates?.[0]?.content?.parts;
        let partsTexts: string[] = [];
        if (Array.isArray(firstParts)) {
            partsTexts = firstParts.map((p: any) => p?.text || '').filter(Boolean);
        } else {
            partsTexts = candidates
                .flatMap((c: any) => Array.isArray(c?.content?.parts) ? c.content.parts : [])
                .map((p: any) => p?.text || '')
                .filter(Boolean);
        }

        if (partsTexts.length === 0) {
            const finishReason = candidates?.[0]?.finishReason || 'UNKNOWN';
            if (isGeminiDebugEnabled()) {
                console.debug('[Gemini][finish]', {
                    finishReason,
                    usage: data?.usageMetadata,
                    candidatesCount: candidates.length,
                });
            }
            throw new Error(`模型未返回可读文本（finishReason=${finishReason}）。请稍后重试或更换为 gemini-2.5-flash。`);
        }

        const output = partsTexts.join('');
        if (isGeminiDebugEnabled()) {
            console.debug('[Gemini][text]', output.length > 2000 ? output.slice(0, 2000) + '...<truncated>' : output);
        }
        return output;
    } catch (error: any) {
        const msg = String(error?.message || error);
        // Debug模式：不改写错误，直接抛出原始错误信息
        if (isGeminiDebugEnabled()) {
            console.error('Failed to generate content (raw):', error);
            throw error;
        }
        // 追加上下文过长的友好提示（非调试模式）
        if (msg.includes('MAX_TOKENS') || msg.includes('maximum context') || msg.includes('content too long')) {
            throw new Error('模型未能返回内容：提示或输入过长（达到了上下文/输出上限）。请缩短输入、降低输出tokens，或改用更小的提示分批处理。');
        }
        console.error('Failed to generate content:', error);
        throw error;
    }
}

/**
 * 测试API密钥是否有效
 */
export async function testApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );

        if (!response.ok) {
            const errorText = await response.text();
            return {
                valid: false,
                error: `API密钥无效 (${response.status})`,
            };
        }

        return { valid: true };
    } catch (error: any) {
        return {
            valid: false,
            error: error.message || '网络请求失败',
        };
    }
}

/**
 * 默认推荐的模型配置
 */
export const DEFAULT_MODELS = {
    FAST: 'gemini-2.5-flash-lite',
    POWERFUL: 'gemini-2.5-pro',
} as const;

/**
 * 获取推荐的默认模型
 */
export function getDefaultModel(): string {
    return DEFAULT_MODELS.FAST;
}

/**
 * 流式生成内容（用于逐行输出）
 */
export async function* generateContentStream(
    modelId: string,
    prompt: string,
    options?: {
        temperature?: number;
        maxOutputTokens?: number;
        systemInstruction?: string;
        topP?: number;
        topK?: number;
        thinkingBudget?: number;
        apiKey?: string;
    }
): AsyncGenerator<string, void, unknown> {
    const key = options?.apiKey || getApiKey();
    if (!key) {
        throw new Error('请先配置Gemini API密钥');
    }

    const messages: GeminiMessage[] = [];
    
    if (options?.systemInstruction) {
        messages.push({
            role: 'user',
            parts: [{ text: options.systemInstruction }],
        });
    }
    
    messages.push({
        role: 'user',
        parts: [{ text: prompt }],
    });

    // 构建生成配置
    const generationConfig: any = {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxOutputTokens ?? 2048,
    };

    // 添加topP和topK参数（如果提供）
    if (options?.topP !== undefined) {
        generationConfig.topP = options.topP;
    }
    if (options?.topK !== undefined) {
        generationConfig.topK = options.topK;
    }

    // 添加思考配置（仅Gemini 2.5系列支持）
    if (options?.thinkingBudget !== undefined && modelId.includes('gemini-2.5')) {
        generationConfig.thinkingConfig = {
            thinkingBudget: options.thinkingBudget
        };
    }

    const requestBody: GeminiGenerateRequest = {
        contents: messages,
        generationConfig,
        safetySettings: buildSafetySettings(),
    };

    try {
        // 握手阶段：支持可配置超时与重试（与非流式一致）
        const timeoutMs = getGeminiTimeoutMs();
        const retries = getGeminiRetries();
        let response: Response | null = null;
        let lastError: any = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (isGeminiDebugEnabled() && retries > 0) {
                    console.debug('[Gemini][stream-attempt]', { attempt: attempt + 1, retries: retries + 1, timeoutMs });
                }
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${key}&alt=sse`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
                        body: JSON.stringify(requestBody),
                        // @ts-ignore - AbortSignal.timeout supported in modern browsers
                        signal: (AbortSignal as any)?.timeout?.(timeoutMs),
                    }
                );
                break; // success
            } catch (e: any) {
                lastError = e;
                const msg = String(e?.message || e);
                const isTimeout = msg.includes('timed out') || msg.includes('Timeout') || msg.includes('AbortError');
                const isNetwork = msg.includes('Failed to fetch') || msg.includes('Network') || e?.name === 'TypeError';
                if (attempt < retries && (isTimeout || isNetwork)) {
                    continue; // retry handshake
                }
                throw e;
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const nonNullResp = response!;

        if (!nonNullResp.ok) {
            const errorText = await nonNullResp.text();
            throw new Error(`API调用失败: ${nonNullResp.status}`);
        }

        const reader = nonNullResp.body?.getReader();
        if (!reader) throw new Error('无法获取响应流');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                
                try {
                    const jsonStr = trimmed.slice(6);
                    const data = JSON.parse(jsonStr);
                    
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                        ?? data?.candidates?.[0]?.text; // 兼容部分实现
                    if (text) {
                        yield text;
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
        // 结束后冲刷 decoder 与残余缓冲
        try {
            const tail = decoder.decode();
            if (tail) buffer += tail;
            if (buffer) {
                for (const line of buffer.split(/\r?\n/)) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    try {
                        const jsonStr = trimmed.slice(6);
                        if (jsonStr === '[DONE]') continue;
                        const data = JSON.parse(jsonStr);
                        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                            ?? data?.candidates?.[0]?.text;
                        if (text) {
                            yield text;
                        }
                    } catch {}
                }
            }
        } catch {}
    } catch (error: any) {
        console.error('Stream generation failed:', error);
        throw error;
    }
}

