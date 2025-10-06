'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AIConfigManager } from '@/lib/ai/config-manager';
import { getUnifiedAIClient } from '@/lib/ai/unified-client';
import type { AIProviderConfig, AIModel } from '@/lib/ai/providers/base';

interface ModelSelectorProps {
    /** 当前选中的提供商ID */
    selectedProviderId?: string;
    /** 当前选中的模型ID */
    selectedModelId?: string;
    /** 提供商变更回调 */
    onProviderChange: (providerId: string) => void;
    /** 模型变更回调 */
    onModelChange: (modelId: string) => void;
    /** 过滤条件 */
    filterByCapability?: 'text' | 'stream' | 'both';
    /** 是否显示标签 */
    showLabels?: boolean;
    /** 是否显示模型信息 */
    showModelInfo?: boolean;
    /** 是否紧凑模式 */
    compact?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 自定义类名 */
    className?: string;
}

interface ProviderModels {
    provider: AIProviderConfig;
    models: AIModel[];
    loading: boolean;
    error?: string;
}

export function ModelSelector({
    selectedProviderId = '',
    selectedModelId = '',
    onProviderChange,
    onModelChange,
    filterByCapability = 'both',
    showLabels = true,
    showModelInfo = true,
    compact = false,
    disabled = false,
    className = '',
}: ModelSelectorProps) {
    const [providers, setProviders] = useState<AIProviderConfig[]>([]);
    const [providerModels, setProviderModels] = useState<Record<string, ProviderModels>>({});
    const [isLoadingProviders, setIsLoadingProviders] = useState(true);
    const { toast } = useToast();

    // 加载提供商列表
    useEffect(() => {
        loadProviders();
    }, []);

    // 当选中的提供商变化时，加载对应的模型列表
    useEffect(() => {
        if (selectedProviderId && !providerModels[selectedProviderId]?.models.length) {
            loadModelsForProvider(selectedProviderId);
        }
    }, [selectedProviderId]);

    const loadProviders = () => {
        try {
            setIsLoadingProviders(true);
            const configs = AIConfigManager.getEnabledProviders();
            setProviders(configs);
            
            // 如果没有选中的提供商，自动选择第一个
            if (!selectedProviderId && configs.length > 0) {
                onProviderChange(configs[0].id);
            }
        } catch (error: any) {
            toast({
                title: '加载提供商失败',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsLoadingProviders(false);
        }
    };

    const loadModelsForProvider = async (providerId: string) => {
        const provider = providers.find(p => p.id === providerId);
        if (!provider) return;

        // 设置加载状态
        setProviderModels(prev => ({
            ...prev,
            [providerId]: {
                provider,
                models: [],
                loading: true,
            },
        }));

        try {
            const client = getUnifiedAIClient();
            const models = await client.listModels(providerId);
            
            // 根据能力过滤模型
            const filteredModels = models.filter(model => {
                if (filterByCapability === 'text') return true;
                if (filterByCapability === 'stream') return model.supportStreaming;
                return true; // 'both' 不过滤
            });

            setProviderModels(prev => ({
                ...prev,
                [providerId]: {
                    provider,
                    models: filteredModels,
                    loading: false,
                },
            }));

            // 如果没有选中的模型，自动选择默认模型或第一个模型
            if (!selectedModelId && filteredModels.length > 0) {
                const defaultModel = filteredModels.find(m => m.id === provider.defaultModel) || filteredModels[0];
                onModelChange(defaultModel.id);
            }
        } catch (error: any) {
            setProviderModels(prev => ({
                ...prev,
                [providerId]: {
                    provider,
                    models: [],
                    loading: false,
                    error: error.message,
                },
            }));
            
            toast({
                title: '加载模型列表失败',
                description: `${provider.displayName}: ${error.message}`,
                variant: 'destructive',
            });
        }
    };

    const handleProviderChange = (providerId: string) => {
        onProviderChange(providerId);
        onModelChange(''); // 清空模型选择
        
        // 加载新提供商的模型列表
        if (!providerModels[providerId]?.models.length) {
            loadModelsForProvider(providerId);
        }
    };

    const handleRefreshModels = () => {
        if (selectedProviderId) {
            loadModelsForProvider(selectedProviderId);
        }
    };

    const selectedProvider = providers.find(p => p.id === selectedProviderId);
    const currentProviderModels = providerModels[selectedProviderId];
    const selectedModel = currentProviderModels?.models.find(m => m.id === selectedModelId);

    const formatModelDisplayName = (model: AIModel) => {
        let name = model.displayName || model.name;
        if (model.maxTokens) {
            name += ` (${(model.maxTokens / 1000).toFixed(0)}K)`;
        }
        return name;
    };

    const getProviderStatusIcon = (provider: AIProviderConfig) => {
        if (!provider.enabled) {
            return <AlertCircle className="w-3 h-3 text-gray-400" />;
        }
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    };

    if (compact) {
        return (
            <div className={`flex gap-2 ${className}`}>
                <Select
                    value={selectedProviderId}
                    onValueChange={handleProviderChange}
                    disabled={disabled || isLoadingProviders}
                >
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="选择提供商" />
                    </SelectTrigger>
                    <SelectContent>
                        {providers.map(provider => (
                            <SelectItem key={provider.id} value={provider.id}>
                                <div className="flex items-center gap-2">
                                    {getProviderStatusIcon(provider)}
                                    <span className="truncate">{provider.displayName}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={selectedModelId}
                    onValueChange={onModelChange}
                    disabled={disabled || !selectedProviderId || currentProviderModels?.loading}
                >
                    <SelectTrigger className="flex-1">
                        <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                        {currentProviderModels?.models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                                <div className="flex items-center justify-between w-full">
                                    <span className="truncate">{formatModelDisplayName(model)}</span>
                                    {model.supportStreaming && (
                                        <Badge variant="secondary" className="ml-2 text-xs">流式</Badge>
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {currentProviderModels?.loading && (
                    <Button variant="ghost" size="sm" disabled>
                        <Loader2 className="w-4 h-4 animate-spin" />
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* 提供商选择 */}
            <div className="space-y-2">
                {showLabels && <Label>AI 提供商</Label>}
                <div className="flex gap-2">
                    <Select
                        value={selectedProviderId}
                        onValueChange={handleProviderChange}
                        disabled={disabled || isLoadingProviders}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={isLoadingProviders ? "加载中..." : "选择AI提供商"} />
                        </SelectTrigger>
                        <SelectContent>
                            {providers.map(provider => (
                                <SelectItem key={provider.id} value={provider.id}>
                                    <div className="flex items-center gap-2">
                                        {getProviderStatusIcon(provider)}
                                        <span>{provider.displayName}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {provider.type.toUpperCase()}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    {selectedProviderId && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshModels}
                            disabled={currentProviderModels?.loading}
                        >
                            {currentProviderModels?.loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                        </Button>
                    )}
                </div>
                
                {selectedProvider && (
                    <p className="text-xs text-muted-foreground">
                        {selectedProvider.apiUrl}
                    </p>
                )}
            </div>

            {/* 模型选择 */}
            {selectedProviderId && (
                <div className="space-y-2">
                    {showLabels && <Label>模型</Label>}
                    <Select
                        value={selectedModelId}
                        onValueChange={onModelChange}
                        disabled={disabled || currentProviderModels?.loading}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={
                                currentProviderModels?.loading 
                                    ? "加载模型中..." 
                                    : currentProviderModels?.error
                                        ? "加载失败"
                                        : "选择模型"
                            } />
                        </SelectTrigger>
                        <SelectContent>
                            {currentProviderModels?.models.map(model => (
                                <SelectItem key={model.id} value={model.id}>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex flex-col items-start">
                                            <span className="font-medium">{formatModelDisplayName(model)}</span>
                                            {model.description && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {model.description}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                            {model.supportStreaming && (
                                                <Badge variant="secondary" className="text-xs">流式</Badge>
                                            )}
                                            {model.supportSystemInstruction && (
                                                <Badge variant="outline" className="text-xs">系统指令</Badge>
                                            )}
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    {currentProviderModels?.error && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {currentProviderModels.error}
                        </p>
                    )}
                </div>
            )}

            {/* 模型信息显示 */}
            {showModelInfo && selectedModel && (
                <div className="p-3 bg-muted/50 rounded-md space-y-2">
                    <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        <span className="font-medium text-sm">模型信息</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-muted-foreground">名称:</span>
                            <span className="ml-1 font-mono">{selectedModel.name}</span>
                        </div>
                        {selectedModel.maxTokens && (
                            <div>
                                <span className="text-muted-foreground">最大Token:</span>
                                <span className="ml-1 font-mono">{selectedModel.maxTokens.toLocaleString()}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-muted-foreground">流式支持:</span>
                            <span className="ml-1">{selectedModel.supportStreaming ? '✓' : '✗'}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground">系统指令:</span>
                            <span className="ml-1">{selectedModel.supportSystemInstruction ? '✓' : '✗'}</span>
                        </div>
                    </div>
                    {selectedModel.description && (
                        <p className="text-xs text-muted-foreground mt-2">
                            {selectedModel.description}
                        </p>
                    )}
                </div>
            )}

            {/* 空状态 */}
            {providers.length === 0 && !isLoadingProviders && (
                <div className="text-center py-8 text-muted-foreground">
                    <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">暂无可用的AI提供商</p>
                    <p className="text-xs">请先在设置中配置AI提供商</p>
                </div>
            )}
        </div>
    );
}

export default ModelSelector;