'use client';

import { useState, useEffect, useCallback } from 'react';
import { AIConfigManager, type ConfigChangeEvent } from '@/lib/ai/config-manager';
import { getUnifiedAIClient } from '@/lib/ai/unified-client';
import type { AIProviderConfig, AIModel, ConnectionTestResult } from '@/lib/ai/providers/base';

/**
 * AI配置管理Hook
 * 提供AI提供商和模型的状态管理、配置操作等功能
 */
export function useAIConfig() {
    const [providers, setProviders] = useState<AIProviderConfig[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState<string>('');
    const [selectedModelId, setSelectedModelId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 加载配置
    const loadConfig = useCallback(() => {
        try {
            setIsLoading(true);
            setError(null);
            
            const allProviders = AIConfigManager.getProviders();
            const enabledProviders = allProviders.filter(p => p.enabled);
            setProviders(allProviders);
            
            const currentProviderId = AIConfigManager.getSelectedProvider();
            const currentModelId = AIConfigManager.getSelectedModel();
            
            // 如果当前选中的提供商不存在或已禁用，自动选择第一个可用的
            if (!currentProviderId || !enabledProviders.find(p => p.id === currentProviderId)) {
                const firstProvider = enabledProviders[0];
                if (firstProvider) {
                    setSelectedProviderId(firstProvider.id);
                    AIConfigManager.setSelectedProvider(firstProvider.id);
                    
                    // 如果有默认模型，设置为选中
                    if (firstProvider.defaultModel) {
                        setSelectedModelId(firstProvider.defaultModel);
                        AIConfigManager.setSelectedModel(firstProvider.defaultModel);
                    } else {
                        // 清空模型选择，让ModelSelector重新加载
                        setSelectedModelId('');
                        AIConfigManager.setSelectedModel('');
                    }
                } else {
                    setSelectedProviderId('');
                    setSelectedModelId('');
                }
            } else {
                setSelectedProviderId(currentProviderId);
                setSelectedModelId(currentModelId);
            }
        } catch (err: any) {
            setError(err.message || '加载配置失败');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 初始化加载
    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    // 监听配置变更
    useEffect(() => {
        const unsubscribe = AIConfigManager.onConfigChange((event: ConfigChangeEvent) => {
            const { type } = event.detail;
            
            if (type === 'providers' || type === 'clear') {
                loadConfig();
            } else if (type === 'selectedProvider') {
                setSelectedProviderId(event.detail.data);
            } else if (type === 'selectedModel') {
                setSelectedModelId(event.detail.data);
            }
        });

        return unsubscribe;
    }, [loadConfig]);

    // 获取启用的提供商
    const enabledProviders = providers.filter(p => p.enabled);

    // 获取当前选中的提供商
    const selectedProvider = providers.find(p => p.id === selectedProviderId) || null;

    // 设置选中的提供商
    const setSelectedProvider = useCallback((providerId: string) => {
        try {
            AIConfigManager.setSelectedProvider(providerId);
            setSelectedProviderId(providerId);
            
            // 清空模型选择，让用户重新选择
            setSelectedModelId('');
            AIConfigManager.setSelectedModel('');
        } catch (err: any) {
            setError(err.message || '设置提供商失败');
        }
    }, []);

    // 设置选中的模型
    const setSelectedModel = useCallback((modelId: string) => {
        try {
            AIConfigManager.setSelectedModel(modelId);
            setSelectedModelId(modelId);
        } catch (err: any) {
            setError(err.message || '设置模型失败');
        }
    }, []);

    // 添加提供商
    const addProvider = useCallback((provider: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'>) => {
        try {
            const newProvider = AIConfigManager.addProvider(provider);
            loadConfig();
            return newProvider;
        } catch (err: any) {
            setError(err.message || '添加提供商失败');
            throw err;
        }
    }, [loadConfig]);

    // 更新提供商
    const updateProvider = useCallback((providerId: string, updates: Partial<AIProviderConfig>) => {
        try {
            const updatedProvider = AIConfigManager.updateProvider(providerId, updates);
            loadConfig();
            return updatedProvider;
        } catch (err: any) {
            setError(err.message || '更新提供商失败');
            throw err;
        }
    }, [loadConfig]);

    // 删除提供商
    const removeProvider = useCallback((providerId: string) => {
        try {
            AIConfigManager.removeProvider(providerId);
            loadConfig();
        } catch (err: any) {
            setError(err.message || '删除提供商失败');
            throw err;
        }
    }, [loadConfig]);

    // 测试连接
    const testConnection = useCallback(async (providerId: string): Promise<ConnectionTestResult> => {
        try {
            const client = getUnifiedAIClient();
            return await client.testConnection(providerId);
        } catch (err: any) {
            throw new Error(err.message || '连接测试失败');
        }
    }, []);

    // 获取模型列表
    const getModels = useCallback(async (providerId: string): Promise<AIModel[]> => {
        try {
            const client = getUnifiedAIClient();
            return await client.listModels(providerId);
        } catch (err: any) {
            throw new Error(err.message || '获取模型列表失败');
        }
    }, []);

    // 导出配置
    const exportConfig = useCallback(() => {
        try {
            return AIConfigManager.exportConfig();
        } catch (err: any) {
            setError(err.message || '导出配置失败');
            throw err;
        }
    }, []);

    // 导入配置
    const importConfig = useCallback((configJson: string, options?: {
        overwrite?: boolean;
        skipInvalid?: boolean;
    }) => {
        try {
            const result = AIConfigManager.importConfig(configJson, options);
            if (result.success) {
                loadConfig();
            }
            return result;
        } catch (err: any) {
            setError(err.message || '导入配置失败');
            throw err;
        }
    }, [loadConfig]);

    // 重置配置
    const resetConfig = useCallback(() => {
        try {
            AIConfigManager.resetToDefaults();
            loadConfig();
        } catch (err: any) {
            setError(err.message || '重置配置失败');
            throw err;
        }
    }, [loadConfig]);

    // 清除错误
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // 检查配置健康状态
    const checkHealth = useCallback(() => {
        return AIConfigManager.checkHealth();
    }, []);

    // 获取配置统计
    const getStats = useCallback(() => {
        return AIConfigManager.getStats();
    }, []);

    // 从旧版本迁移配置
    const migrateFromLegacy = useCallback(() => {
        try {
            const result = AIConfigManager.migrateFromLegacy();
            if (result.migrated) {
                loadConfig();
            }
            return result;
        } catch (err: any) {
            setError(err.message || '配置迁移失败');
            throw err;
        }
    }, [loadConfig]);

    return {
        // 状态
        providers,
        enabledProviders,
        selectedProviderId,
        selectedModelId,
        selectedProvider,
        isLoading,
        error,

        // 选择操作
        setSelectedProvider,
        setSelectedModel,

        // 提供商管理
        addProvider,
        updateProvider,
        removeProvider,

        // 功能操作
        testConnection,
        getModels,
        exportConfig,
        importConfig,
        resetConfig,
        clearError,
        checkHealth,
        getStats,
        migrateFromLegacy,

        // 手动刷新
        refresh: loadConfig,
    };
}

/**
 * AI调用Hook
 * 提供便捷的AI内容生成功能
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

    return {
        // 状态
        isGenerating,
        error,
        canGenerate: !!(selectedProviderId && selectedModelId),
        selectedProvider,

        // 操作
        generateContent,
        generateContentStream,
        clearError,
    };
}

export default useAIConfig;