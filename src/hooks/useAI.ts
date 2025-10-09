'use client';

import { useState, useCallback } from 'react';
import { useAIConfig } from './useAIConfig';
import { getUnifiedAIClient } from '@/lib/ai/unified-client';
import type { GenerateOptions } from '@/lib/ai/providers/base';

/**
 * AI调用Hook
 * 提供便捷的AI内容生成功能，支持自动选择提供商和模型
 */
export function useAI() {
    const { selectedProviderId, selectedModelId, selectedProvider } = useAIConfig();
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 生成内容
    const generateContent = useCallback(async (
        prompt: string,
        options?: {
            temperature?: number;
            maxOutputTokens?: number;
            systemInstruction?: string;
            providerId?: string;
            modelId?: string;
        }
    ): Promise<string> => {
        const providerId = options?.providerId || selectedProviderId;
        const modelId = options?.modelId || selectedModelId;

        if (!providerId || !modelId) {
            throw new Error('请先选择AI提供商和模型');
        }

        setIsGenerating(true);
        setError(null);

        try {
            const client = getUnifiedAIClient();
            const result = await client.generateContent(providerId, modelId, prompt, {
                temperature: options?.temperature,
                maxOutputTokens: options?.maxOutputTokens,
                systemInstruction: options?.systemInstruction,
            });
            return result;
        } catch (err: any) {
            const errorMessage = err.message || '生成内容失败';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    }, [selectedProviderId, selectedModelId]);

    // 流式生成内容
    const generateContentStream = useCallback(async function* (
        prompt: string,
        options?: {
            temperature?: number;
            maxOutputTokens?: number;
            systemInstruction?: string;
            providerId?: string;
            modelId?: string;
        }
    ): AsyncGenerator<string, void, unknown> {
        const providerId = options?.providerId || selectedProviderId;
        const modelId = options?.modelId || selectedModelId;

        if (!providerId || !modelId) {
            throw new Error('请先选择AI提供商和模型');
        }

        setIsGenerating(true);
        setError(null);

        try {
            const client = getUnifiedAIClient();
            const stream = client.generateContentStream(providerId, modelId, prompt, {
                temperature: options?.temperature,
                maxOutputTokens: options?.maxOutputTokens,
                systemInstruction: options?.systemInstruction,
            });

            for await (const chunk of stream) {
                yield chunk;
            }
        } catch (err: any) {
            const errorMessage = err.message || '生成内容失败';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    }, [selectedProviderId, selectedModelId]);

    // 清除错误
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // 检查是否可以生成内容
    const canGenerate = !!(selectedProviderId && selectedModelId);

    return {
        // 状态
        isGenerating,
        error,
        canGenerate,
        selectedProvider,
        selectedProviderId,
        selectedModelId,

        // 操作
        generateContent,
        generateContentStream,
        clearError,
    };
}

export default useAI;