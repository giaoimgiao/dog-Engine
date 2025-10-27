
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { 
    Settings2, 
    Bot, 
    Loader2, 
    CheckCircle2, 
    XCircle, 
    Plus, 
    Edit, 
    Trash2, 
    Download, 
    Upload,
    TestTube,
    Eye,
    EyeOff,
    Copy,
    Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AIConfigManager } from '@/lib/ai/config-manager';
import { getUnifiedAIClient } from '@/lib/ai/unified-client';
import type { AIProviderConfig, ConnectionTestResult } from '@/lib/ai/providers/base';
import { OPENAI_COMPATIBLE_CONFIGS } from '@/lib/ai/providers/openai-compatible';
import { GEMINI_PROVIDER_TEMPLATES } from '@/lib/ai/providers/gemini';

interface AIProviderSettingsProps {
    /** 自定义触发按钮 */
    trigger?: React.ReactNode;
    /** 按钮变体 */
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    /** 是否显示状态图标 */
    showStatus?: boolean;
}

interface ProviderFormData {
    id: string;
    name: string;
    displayName: string;
    type: 'openai' | 'gemini' | 'claude' | 'custom';
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
    defaultModel?: string;
    customHeaders?: string; // JSON字符串
    // 高级设置
    defaultTemperature?: number;
    defaultTopP?: number;
    defaultTopK?: number;
    enableDynamicThinking?: boolean;
    thinkingBudget?: number;
    requestTimeoutMs?: number;
    retries?: number;
}

function ProviderForm({ 
    provider, 
    onSave, 
    onCancel 
}: { 
    provider?: AIProviderConfig | null; 
    onSave: (data: ProviderFormData) => void; 
    onCancel: () => void; 
}) {
    const [formData, setFormData] = useState<ProviderFormData>({
        id: provider?.id || '',
        name: provider?.name || '',
        displayName: provider?.displayName || '',
        type: provider?.type || 'openai',
        apiUrl: provider?.apiUrl || '',
        apiKey: provider?.apiKey || '',
        enabled: provider?.enabled ?? true,
        defaultModel: provider?.defaultModel || '',
        customHeaders: provider?.customHeaders ? JSON.stringify(provider.customHeaders, null, 2) : '',
        // 高级设置
        defaultTemperature: provider?.advancedConfig?.defaultTemperature,
        defaultTopP: provider?.advancedConfig?.defaultTopP,
        defaultTopK: provider?.advancedConfig?.defaultTopK,
        enableDynamicThinking: provider?.advancedConfig?.enableDynamicThinking ?? false,
        thinkingBudget: provider?.advancedConfig?.thinkingBudget,
        requestTimeoutMs: provider?.advancedConfig?.requestTimeoutMs,
        retries: provider?.advancedConfig?.retries,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // 生成ID（如果是新建）
        if (!formData.id) {
            formData.id = `${formData.type}-${Date.now()}`;
        }
        
        onSave(formData);
    };

    const handlePresetSelect = (presetKey: string) => {
        // 检查是否是 Gemini 模板
        if (presetKey.startsWith('GEMINI_')) {
            const geminiKey = presetKey.replace('GEMINI_', '') as keyof typeof GEMINI_PROVIDER_TEMPLATES;
            const preset = GEMINI_PROVIDER_TEMPLATES[geminiKey];
            if (preset) {
                setFormData(prev => ({
                    ...prev,
                    name: preset.name,
                    displayName: preset.displayName,
                    type: 'gemini',
                    apiUrl: preset.apiUrl,
                    defaultModel: preset.defaultModel,
                    customHeaders: '',
                }));
            }
        } else {
            // OpenAI 兼容模板
            const preset = OPENAI_COMPATIBLE_CONFIGS[presetKey as keyof typeof OPENAI_COMPATIBLE_CONFIGS];
            if (preset) {
                // 安全地访问可选的 customHeaders 属性
                const customHeadersStr = ('customHeaders' in preset && preset.customHeaders) 
                    ? JSON.stringify(preset.customHeaders, null, 2) 
                    : '';
                
                setFormData(prev => ({
                    ...prev,
                    name: preset.name,
                    displayName: preset.displayName,
                    type: 'openai',
                    apiUrl: preset.apiUrl,
                    defaultModel: preset.defaultModel,
                    customHeaders: customHeadersStr,
                }));
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* 预设模板选择 */}
            {!provider && (
                <div className="space-y-2">
                    <Label>快速配置</Label>
                    <Select onValueChange={handlePresetSelect}>
                        <SelectTrigger>
                            <SelectValue placeholder="选择预设模板（可选）" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="GEMINI_GOOGLE_GEMINI">Google Gemini</SelectItem>
                            <SelectItem value="OPENAI">OpenAI</SelectItem>
                            <SelectItem value="CLAUDE">Anthropic Claude</SelectItem>
                            <SelectItem value="DEEPSEEK">DeepSeek</SelectItem>
                            <SelectItem value="MOONSHOT">Moonshot AI</SelectItem>
                            <SelectItem value="ZHIPU">智谱AI</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="displayName">显示名称 *</Label>
                    <Input
                        id="displayName"
                        value={formData.displayName}
                        onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                        placeholder="例如：OpenAI GPT"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="type">提供商类型 *</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="openai">OpenAI 兼容</SelectItem>
                            <SelectItem value="gemini">Google Gemini</SelectItem>
                            <SelectItem value="claude">Anthropic Claude</SelectItem>
                            <SelectItem value="custom">自定义</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="apiUrl">API 地址 *</Label>
                <Input
                    id="apiUrl"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiUrl: e.target.value }))}
                    placeholder={formData.type === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://api.openai.com/v1'}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="apiKey">API 密钥 *</Label>
                <Input
                    id="apiKey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="输入您的API密钥"
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="defaultModel">默认模型</Label>
                <Input
                    id="defaultModel"
                    value={formData.defaultModel}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
                    placeholder={formData.type === 'gemini' ? '例如：gemini-2.5-flash' : '例如：gpt-3.5-turbo'}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="customHeaders">自定义请求头（JSON格式）</Label>
                <Textarea
                    id="customHeaders"
                    value={formData.customHeaders}
                    onChange={(e) => setFormData(prev => ({ ...prev, customHeaders: e.target.value }))}
                    placeholder='{"Authorization": "Bearer token", "Custom-Header": "value"}'
                    rows={3}
                    className="font-mono text-sm"
                />
            </div>

            <div className="flex items-center space-x-2">
                <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
                />
                <Label htmlFor="enabled">启用此提供商</Label>
            </div>

            {/* 高级设置 */}
            <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">高级设置</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="defaultTemperature">默认温度 (0-1)</Label>
                        <Input
                            id="defaultTemperature"
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={formData.defaultTemperature || ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                defaultTemperature: e.target.value ? parseFloat(e.target.value) : undefined
                            }))}
                            placeholder="例如：0.7"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="defaultTopP">默认Top-P (0-1)</Label>
                        <Input
                            id="defaultTopP"
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={formData.defaultTopP || ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                defaultTopP: e.target.value ? parseFloat(e.target.value) : undefined
                            }))}
                            placeholder="例如：0.9"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="defaultTopK">默认Top-K</Label>
                    <Input
                        id="defaultTopK"
                        type="number"
                        min="1"
                        step="1"
                        value={formData.defaultTopK || ''}
                        onChange={(e) => setFormData(prev => ({
                            ...prev,
                            defaultTopK: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                        placeholder="例如：40"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="requestTimeoutMs">请求超时（毫秒）</Label>
                        <Input
                            id="requestTimeoutMs"
                            type="number"
                            min="5000"
                            step="1000"
                            value={formData.requestTimeoutMs || ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                requestTimeoutMs: e.target.value ? parseInt(e.target.value) : undefined
                            }))}
                            placeholder="默认：30000"
                        />
                        <p className="text-xs text-muted-foreground">
                            SSE流式输出超时时间，慢速模型建议设为60000-120000（1-2分钟）
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="retries">重试次数 (0-3)</Label>
                        <Input
                            id="retries"
                            type="number"
                            min="0"
                            max="3"
                            step="1"
                            value={formData.retries !== undefined ? formData.retries : ''}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                retries: e.target.value ? parseInt(e.target.value) : undefined
                            }))}
                            placeholder="默认：1"
                        />
                        <p className="text-xs text-muted-foreground">
                            超时或5xx错误时的自动重试次数
                        </p>
                    </div>
                </div>

                {/* Gemini 2.5 系列特有设置 */}
                {formData.type === 'gemini' && (
                    <div className="space-y-4 border-t pt-4">
                        <h4 className="font-medium text-blue-600">Gemini 2.5 系列专用设置</h4>
                        
                        <div className="flex items-center space-x-2">
                            <Switch
                                id="enableDynamicThinking"
                                checked={formData.enableDynamicThinking}
                                onCheckedChange={(checked) => setFormData(prev => ({
                                    ...prev,
                                    enableDynamicThinking: checked,
                                    thinkingBudget: checked ? -1 : prev.thinkingBudget
                                }))}
                            />
                            <Label htmlFor="enableDynamicThinking">启用动态思考</Label>
                        </div>
                        
                        {!formData.enableDynamicThinking && (
                            <div className="space-y-2">
                                <Label htmlFor="thinkingBudget">思考预算 (Token数)</Label>
                                <Input
                                    id="thinkingBudget"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.thinkingBudget || ''}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        thinkingBudget: e.target.value ? parseInt(e.target.value) : undefined
                                    }))}
                                    placeholder="例如：1024 (0为禁用思考)"
                                />
                                <p className="text-xs text-muted-foreground">
                                    设置为0禁用思考，设置为-1启用动态思考，或指定固定的token数量
                                </p>
                            </div>
                        )}
                        
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                💡 思考功能仅在 Gemini 2.5 Flash、2.5 Pro 和 2.5 Flash-Lite 中受支持。
                                动态思考会根据请求复杂程度自动调整预算。
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <DialogFooter>
                <Button type="button" variant="secondary" onClick={onCancel}>
                    取消
                </Button>
                <Button type="submit">
                    <Save className="w-4 h-4 mr-1" />
                    保存
                </Button>
            </DialogFooter>
        </form>
    );
}

export function AIProviderSettings({ 
    trigger, 
    variant = 'outline',
    showStatus = true,
}: AIProviderSettingsProps) {
    const [open, setOpen] = useState(false);
    const [providers, setProviders] = useState<AIProviderConfig[]>([]);
    const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
    const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
    const { toast } = useToast();

    // 加载提供商配置
    useEffect(() => {
        if (open) {
            loadProviders();
        }
    }, [open]);

    const loadProviders = () => {
        try {
            const configs = AIConfigManager.getProviders();
            setProviders(configs);
        } catch (error: any) {
            toast({
                title: '加载配置失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleSaveProvider = async (formData: ProviderFormData) => {
        try {
            let customHeaders: Record<string, string> | undefined;
            
            // 解析自定义请求头
            if (formData.customHeaders?.trim()) {
                try {
                    customHeaders = JSON.parse(formData.customHeaders);
                } catch {
                    throw new Error('自定义请求头格式无效，请使用有效的JSON格式');
                }
            }

            // 构建高级配置
            const advancedConfig: import('@/lib/ai/providers/base').AdvancedGenerationConfig = {};
            
            if (formData.defaultTemperature !== undefined) {
                advancedConfig.defaultTemperature = formData.defaultTemperature;
            }
            if (formData.defaultTopP !== undefined) {
                advancedConfig.defaultTopP = formData.defaultTopP;
            }
            if (formData.defaultTopK !== undefined) {
                advancedConfig.defaultTopK = formData.defaultTopK;
            }
            if (formData.type === 'gemini') {
                advancedConfig.enableDynamicThinking = formData.enableDynamicThinking;
                if (formData.thinkingBudget !== undefined) {
                    advancedConfig.thinkingBudget = formData.thinkingBudget;
                }
            }
            if (formData.requestTimeoutMs !== undefined) {
                advancedConfig.requestTimeoutMs = formData.requestTimeoutMs;
            }
            if (formData.retries !== undefined) {
                advancedConfig.retries = formData.retries;
            }

            const providerConfig: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'> = {
                id: formData.id,
                name: formData.name || formData.id,
                displayName: formData.displayName,
                type: formData.type,
                apiUrl: formData.apiUrl,
                apiKey: formData.apiKey,
                enabled: formData.enabled,
                defaultModel: formData.defaultModel,
                customHeaders,
                advancedConfig: Object.keys(advancedConfig).length > 0 ? advancedConfig : undefined,
            };

            if (editingProvider) {
                // 更新现有提供商
                AIConfigManager.updateProvider(editingProvider.id, providerConfig);
                toast({
                    title: '✅ 提供商已更新',
                    description: `${formData.displayName} 配置已保存`,
                });
            } else {
                // 添加新提供商
                AIConfigManager.addProvider(providerConfig);
                toast({
                    title: '✅ 提供商已添加',
                    description: `${formData.displayName} 配置已保存`,
                });
            }

            loadProviders();
            setIsFormOpen(false);
            setEditingProvider(null);
        } catch (error: any) {
            toast({
                title: '保存失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleDeleteProvider = (providerId: string) => {
        try {
            AIConfigManager.removeProvider(providerId);
            loadProviders();
            toast({
                title: '提供商已删除',
                variant: 'destructive',
            });
        } catch (error: any) {
            toast({
                title: '删除失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleToggleProvider = (providerId: string, enabled: boolean) => {
        try {
            AIConfigManager.updateProvider(providerId, { enabled });
            loadProviders();
        } catch (error: any) {
            toast({
                title: '更新失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleTestConnection = async (providerId: string) => {
        setIsTestingConnection(providerId);
        try {
            const client = getUnifiedAIClient();
            const result = await client.testConnection(providerId);
            setTestResults(prev => ({ ...prev, [providerId]: result }));
            
            if (result.valid) {
                toast({
                    title: '✅ 连接测试成功',
                    description: `响应时间: ${result.responseTime}ms`,
                });
            } else {
                toast({
                    title: '❌ 连接测试失败',
                    description: result.error,
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: '测试失败',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setIsTestingConnection(null);
        }
    };

    const handleExportConfig = () => {
        try {
            const config = AIConfigManager.exportConfig();
            const blob = new Blob([config], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-providers-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast({
                title: '✅ 配置已导出',
                description: '配置文件已下载到本地',
            });
        } catch (error: any) {
            toast({
                title: '导出失败',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const configJson = e.target?.result as string;
                const result = AIConfigManager.importConfig(configJson, {
                    overwrite: false,
                    skipInvalid: true,
                });

                if (result.success) {
                    loadProviders();
                    toast({
                        title: '✅ 配置导入成功',
                        description: `导入了 ${result.imported} 个提供商，跳过 ${result.skipped} 个`,
                    });
                } else {
                    toast({
                        title: '导入失败',
                        description: result.errors.join('\n'),
                        variant: 'destructive',
                    });
                }
            } catch (error: any) {
                toast({
                    title: '导入失败',
                    description: '配置文件格式无效',
                    variant: 'destructive',
                });
            }
        };
        reader.readAsText(file);
        
        // 重置文件输入
        event.target.value = '';
    };

    const toggleApiKeyVisibility = (providerId: string) => {
        setShowApiKeys(prev => ({
            ...prev,
            [providerId]: !prev[providerId],
        }));
    };

    const copyApiKey = async (apiKey: string) => {
        try {
            // 优先使用现代 Clipboard API
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(apiKey);
                toast({
                    title: '已复制到剪贴板',
                });
            } else {
                // 降级方案：使用传统方法
                const textArea = document.createElement('textarea');
                textArea.value = apiKey;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    toast({
                        title: '已复制到剪贴板',
                    });
                } catch (err) {
                    toast({
                        title: '复制失败',
                        description: '请手动复制 API 密钥',
                        variant: 'destructive',
                    });
                }
                document.body.removeChild(textArea);
            }
        } catch (error) {
            console.error('Copy failed:', error);
            toast({
                title: '复制失败',
                description: '请手动复制 API 密钥',
                variant: 'destructive',
            });
        }
    };

    const enabledCount = providers.filter(p => p.enabled).length;
    const hasConfiguredProviders = providers.length > 0;

    const defaultTrigger = (
        <Button variant={variant} size="sm" className="gap-2">
            {showStatus && hasConfiguredProviders ? (
                <Bot className="w-4 h-4 text-green-500" />
            ) : (
                <Settings2 className="w-4 h-4" />
            )}
            AI配置
            {showStatus && enabledCount > 0 && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                    {enabledCount}
                </span>
            )}
        </Button>
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || defaultTrigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        AI 提供商配置
                    </DialogTitle>
                    <DialogDescription>
                        管理您的AI提供商配置，支持OpenAI、Gemini、Claude等多种服务。
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                    {/* 操作按钮 */}
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button
                                onClick={() => {
                                    setEditingProvider(null);
                                    setIsFormOpen(true);
                                }}
                                size="sm"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                添加提供商
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleExportConfig}
                                size="sm"
                            >
                                <Download className="w-4 h-4 mr-1" />
                                导出配置
                            </Button>
                            <label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                >
                                    <span>
                                        <Upload className="w-4 h-4 mr-1" />
                                        导入配置
                                    </span>
                                </Button>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportConfig}
                                    className="hidden"
                                />
                            </label>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {providers.length} 个提供商，{enabledCount} 个已启用
                        </div>
                    </div>

                    {/* 提供商列表 */}
                    <div className="space-y-3">
                        {providers.length > 0 ? (
                            providers.map(provider => {
                                const testResult = testResults[provider.id];
                                const isVisible = showApiKeys[provider.id];
                                
                                return (
                                    <Card key={provider.id} className={!provider.enabled ? 'opacity-60' : ''}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${
                                                        provider.enabled 
                                                            ? testResult?.valid 
                                                                ? 'bg-green-500' 
                                                                : testResult?.valid === false 
                                                                    ? 'bg-red-500' 
                                                                    : 'bg-yellow-500'
                                                            : 'bg-gray-400'
                                                    }`} />
                                                    <div>
                                                        <CardTitle className="text-base">{provider.displayName}</CardTitle>
                                                        <CardDescription className="text-sm">
                                                            {provider.type.toUpperCase()} • {provider.apiUrl}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={provider.enabled}
                                                        onCheckedChange={(checked) => handleToggleProvider(provider.id, checked)}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleTestConnection(provider.id)}
                                                        disabled={isTestingConnection === provider.id || !provider.enabled}
                                                    >
                                                        {isTestingConnection === provider.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <TestTube className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setEditingProvider(provider);
                                                            setIsFormOpen(true);
                                                        }}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteProvider(provider.id)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-muted-foreground">API密钥:</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-xs">
                                                            {isVisible ? provider.apiKey : '••••••••••••••••'}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => toggleApiKeyVisibility(provider.id)}
                                                        >
                                                            {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyApiKey(provider.apiKey)}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {provider.defaultModel && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">默认模型:</span>
                                                        <span className="font-mono text-xs">{provider.defaultModel}</span>
                                                    </div>
                                                )}
                                                {testResult && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">连接状态:</span>
                                                        <div className="flex items-center gap-1">
                                                            {testResult.valid ? (
                                                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                            ) : (
                                                                <XCircle className="w-3 h-3 text-red-500" />
                                                            )}
                                                            <span className="text-xs">
                                                                {testResult.valid ? '正常' : '失败'}
                                                                {testResult.responseTime && ` (${testResult.responseTime}ms)`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">暂无AI提供商</h3>
                                <p className="text-muted-foreground mb-4">
                                    添加您的第一个AI提供商来开始使用AI功能
                                </p>
                                <Button
                                    onClick={() => {
                                        setEditingProvider(null);
                                        setIsFormOpen(true);
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    添加提供商
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-shrink-0 mt-4">
                    <DialogClose asChild>
                        <Button variant="secondary">关闭</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>

            {/* 提供商表单对话框 */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingProvider ? '编辑提供商' : '添加提供商'}
                        </DialogTitle>
                        <DialogDescription>
                            配置AI提供商的连接信息和认证凭据。
                        </DialogDescription>
                    </DialogHeader>
                    <ProviderForm
                        provider={editingProvider}
                        onSave={handleSaveProvider}
                        onCancel={() => {
                            setIsFormOpen(false);
                            setEditingProvider(null);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}
                