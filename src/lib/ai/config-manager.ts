
/**
 * @fileOverview AI配置管理系统
 * 负责AI提供商配置的CRUD操作、本地存储管理、配置导入导出等功能
 */

import { AIProviderConfig, AIModelConfig } from './providers/base';
import { DEFAULT_GEMINI_CONFIG, GEMINI_PROVIDER_TEMPLATES } from './providers/gemini';
import { OPENAI_COMPATIBLE_CONFIGS } from './providers/openai-compatible';

/**
 * 配置存储键名
 */
const STORAGE_KEYS = {
  PROVIDERS: 'ai-providers-config',
  MODELS: 'ai-models-config',
  SELECTED_PROVIDER: 'ai-selected-provider',
  SELECTED_MODEL: 'ai-selected-model',
  CONFIG_VERSION: 'ai-config-version',
} as const;

/**
 * 当前配置版本
 */
const CONFIG_VERSION = '1.0.0';

/**
 * 配置导出格式
 */
export interface ConfigExport {
  version: string;
  exportedAt: string;
  providers: AIProviderConfig[];
  models: AIModelConfig[];
  selectedProvider?: string;
  selectedModel?: string;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * AI配置管理器
 */
export class AIConfigManager {
  /**
   * 获取所有提供商配置
   */
  static getProviders(): AIProviderConfig[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROVIDERS);
      if (!stored) {
        // 首次使用，返回默认配置
        return this.getDefaultProviders();
      }
      
      const providers: AIProviderConfig[] = JSON.parse(stored);
      return providers.filter(p => p && p.id); // 过滤无效配置
    } catch (error) {
      console.error('Failed to load providers config:', error);
      return this.getDefaultProviders();
    }
  }

  /**
   * 保存所有提供商配置
   */
  static saveProviders(providers: AIProviderConfig[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      // 验证配置
      const validProviders = providers.filter(p => this.validateProvider(p).valid);
      
      localStorage.setItem(STORAGE_KEYS.PROVIDERS, JSON.stringify(validProviders));
      localStorage.setItem(STORAGE_KEYS.CONFIG_VERSION, CONFIG_VERSION);
      
      // 触发配置变更事件
      this.dispatchConfigChangeEvent('providers', validProviders);
    } catch (error) {
      console.error('Failed to save providers config:', error);
      throw new Error('保存提供商配置失败');
    }
  }

  /**
   * 添加提供商配置
   */
  static addProvider(provider: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'>): AIProviderConfig {
    const now = new Date().toISOString();
    const newProvider: AIProviderConfig = {
      ...provider,
      createdAt: now,
      updatedAt: now,
    };

    // 验证配置
    const validation = this.validateProvider(newProvider);
    if (!validation.valid) {
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
    }

    const providers = this.getProviders();
    
    // 检查ID是否已存在
    if (providers.some(p => p.id === newProvider.id)) {
      throw new Error(`提供商ID "${newProvider.id}" 已存在`);
    }

    providers.push(newProvider);
    this.saveProviders(providers);
    
    return newProvider;
  }

  /**
   * 更新提供商配置
   */
  static updateProvider(providerId: string, updates: Partial<AIProviderConfig>): AIProviderConfig {
    const providers = this.getProviders();
    const index = providers.findIndex(p => p.id === providerId);
    
    if (index === -1) {
      throw new Error(`提供商 "${providerId}" 不存在`);
    }

    const updatedProvider: AIProviderConfig = {
      ...providers[index],
      ...updates,
      id: providerId, // 确保ID不被修改
      updatedAt: new Date().toISOString(),
    };

    // 验证更新后的配置
    const validation = this.validateProvider(updatedProvider);
    if (!validation.valid) {
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
    }

    providers[index] = updatedProvider;
    this.saveProviders(providers);
    
    return updatedProvider;
  }

  /**
   * 删除提供商配置
   */
  static removeProvider(providerId: string): void {
    const providers = this.getProviders();
    const filteredProviders = providers.filter(p => p.id !== providerId);
    
    if (filteredProviders.length === providers.length) {
      throw new Error(`提供商 "${providerId}" 不存在`);
    }

    this.saveProviders(filteredProviders);

    // 如果删除的是当前选中的提供商，清除选择
    if (this.getSelectedProvider() === providerId) {
      this.setSelectedProvider('');
    }
  }

  /**
   * 获取单个提供商配置
   */
  static getProvider(providerId: string): AIProviderConfig | null {
    const providers = this.getProviders();
    return providers.find(p => p.id === providerId) || null;
  }

  /**
   * 获取启用的提供商配置
   */
  static getEnabledProviders(): AIProviderConfig[] {
    return this.getProviders().filter(p => p.enabled);
  }

  /**
   * 获取模型配置
   */
  static getModels(): AIModelConfig[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MODELS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load models config:', error);
      return [];
    }
  }

  /**
   * 保存模型配置
   */
  static saveModels(models: AIModelConfig[]): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEYS.MODELS, JSON.stringify(models));
      this.dispatchConfigChangeEvent('models', models);
    } catch (error) {
      console.error('Failed to save models config:', error);
      throw new Error('保存模型配置失败');
    }
  }

  /**
   * 获取当前选中的提供商ID
   */
  static getSelectedProvider(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEYS.SELECTED_PROVIDER) || '';
  }

  /**
   * 设置当前选中的提供商
   */
  static setSelectedProvider(providerId: string): void {
    if (typeof window === 'undefined') return;
    
    if (providerId) {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw new Error(`提供商 "${providerId}" 不存在`);
      }
      if (!provider.enabled) {
        throw new Error(`提供商 "${providerId}" 已禁用`);
      }
    }

    localStorage.setItem(STORAGE_KEYS.SELECTED_PROVIDER, providerId);
    this.dispatchConfigChangeEvent('selectedProvider', providerId);
  }

  /**
   * 获取当前选中的模型ID
   */
  static getSelectedModel(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) || '';
  }

  /**
   * 设置当前选中的模型
   */
  static setSelectedModel(modelId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId);
    this.dispatchConfigChangeEvent('selectedModel', modelId);
  }

  /**
   * 导出配置
   */
  static exportConfig(): string {
    const config: ConfigExport = {
      version: CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      providers: this.getProviders(),
      models: this.getModels(),
      selectedProvider: this.getSelectedProvider(),
      selectedModel: this.getSelectedModel(),
    };

    return JSON.stringify(config, null, 2);
  }

  /**
   * 导入配置
   */
  static importConfig(configJson: string, options: {
    overwrite?: boolean;
    skipInvalid?: boolean;
  } = {}): {
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  } {
    const { overwrite = false, skipInvalid = true } = options;
    const result = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    try {
      const config: ConfigExport = JSON.parse(configJson);
      
      // 验证配置格式
      if (!config.version || !config.providers) {
        throw new Error('无效的配置文件格式');
      }

      // 版本兼容性检查
      if (config.version !== CONFIG_VERSION) {
        result.errors.push(`配置版本不匹配 (期望: ${CONFIG_VERSION}, 实际: ${config.version})`);
        if (!skipInvalid) {
          return result;
        }
      }

      const existingProviders = overwrite ? [] : this.getProviders();
      const existingIds = new Set(existingProviders.map(p => p.id));

      // 导入提供商配置
      for (const provider of config.providers) {
        try {
          // 跳过已存在的配置（除非覆盖模式）
          if (existingIds.has(provider.id) && !overwrite) {
            result.skipped++;
            continue;
          }

          // 验证配置
          const validation = this.validateProvider(provider);
          if (!validation.valid) {
            if (skipInvalid) {
              result.errors.push(`跳过无效配置 ${provider.id}: ${validation.errors.join(', ')}`);
              result.skipped++;
              continue;
            } else {
              throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
            }
          }

          // 添加或更新配置
          if (existingIds.has(provider.id)) {
            const index = existingProviders.findIndex(p => p.id === provider.id);
            existingProviders[index] = {
              ...provider,
              updatedAt: new Date().toISOString(),
            };
          } else {
            existingProviders.push(provider);
            existingIds.add(provider.id);
          }

          result.imported++;
        } catch (error: any) {
          result.errors.push(`导入 ${provider.id} 失败: ${error.message}`);
          if (!skipInvalid) {
            return result;
          }
          result.skipped++;
        }
      }

      // 保存配置
      this.saveProviders(existingProviders);

      // 导入模型配置
      if (config.models) {
        this.saveModels(config.models);
      }

      // 导入选择状态
      if (config.selectedProvider) {
        try {
          this.setSelectedProvider(config.selectedProvider);
        } catch {
          // 忽略无效的选择
        }
      }

      if (config.selectedModel) {
        this.setSelectedModel(config.selectedModel);
      }

      result.success = true;
      return result;
    } catch (error: any) {
      result.errors.push(error.message || '导入配置失败');
      return result;
    }
  }

  /**
   * 重置为默认配置
   */
  static resetToDefaults(): void {
    if (typeof window === 'undefined') return;
    
    const defaultProviders = this.getDefaultProviders();
    this.saveProviders(defaultProviders);
    this.saveModels([]);
    this.setSelectedProvider('');
    this.setSelectedModel('');
  }

  /**
   * 清除所有配置
   */
  static clearAll(): void {
    if (typeof window === 'undefined') return;
    
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });

    this.dispatchConfigChangeEvent('clear', null);
  }

  /**
   * 验证提供商配置
   */
  static validateProvider(provider: AIProviderConfig): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必填字段验证
    if (!provider.id?.trim()) {
      errors.push('提供商ID不能为空');
    }
    if (!provider.name?.trim()) {
      errors.push('提供商名称不能为空');
    }
    if (!provider.displayName?.trim()) {
      errors.push('显示名称不能为空');
    }
    if (!provider.apiUrl?.trim()) {
      errors.push('API地址不能为空');
    }
    if (!provider.apiKey?.trim()) {
      errors.push('API密钥不能为空');
    }

    // 类型验证
    const validTypes = ['openai', 'gemini', 'claude', 'custom'];
    if (!validTypes.includes(provider.type)) {
      errors.push(`无效的提供商类型: ${provider.type}`);
    }

    // URL格式验证
    if (provider.apiUrl) {
      try {
        new URL(provider.apiUrl);
      } catch {
        errors.push('API地址格式无效');
      }
    }

    // ID格式验证
    if (provider.id && !/^[a-zA-Z0-9_-]+$/.test(provider.id)) {
      errors.push('提供商ID只能包含字母、数字、下划线和连字符');
    }

    // 警告检查
    if (provider.apiKey && provider.apiKey.length < 10) {
      warnings.push('API密钥长度可能过短');
    }

    // 高级配置验证
    if (provider.advancedConfig) {
      const config = provider.advancedConfig;
      
      if (config.defaultTemperature !== undefined) {
        if (config.defaultTemperature < 0 || config.defaultTemperature > 1) {
          errors.push('默认温度必须在0-1之间');
        }
      }
      
      if (config.defaultTopP !== undefined) {
        if (config.defaultTopP < 0 || config.defaultTopP > 1) {
          errors.push('默认Top-P必须在0-1之间');
        }
      }
      
      if (config.defaultTopK !== undefined) {
        if (config.defaultTopK < 1 || !Number.isInteger(config.defaultTopK)) {
          errors.push('默认Top-K必须是大于0的整数');
        }
      }
      
      if (provider.type === 'gemini' && config.thinkingBudget !== undefined) {
        if (config.thinkingBudget < -1 || !Number.isInteger(config.thinkingBudget)) {
          errors.push('思考预算必须是-1（动态）、0（禁用）或正整数');
        }
      }
      
      if (provider.type !== 'gemini' && (config.enableDynamicThinking || config.thinkingBudget !== undefined)) {
        warnings.push('思考功能仅在Gemini提供商中支持');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 获取所有可用的提供商模板
   */
  static getProviderTemplates(): Record<string, any> {
    return {
      gemini: GEMINI_PROVIDER_TEMPLATES,
      openai: OPENAI_COMPATIBLE_CONFIGS,
    };
  }

  /**
   * 根据模板创建提供商配置
   */
  static createProviderFromTemplate(
    templateType: 'gemini' | 'openai',
    templateKey: string,
    config: {
      id: string;
      apiKey: string;
      enabled?: boolean;
      customDisplayName?: string;
    }
  ): Omit<AIProviderConfig, 'createdAt' | 'updatedAt'> {
    const templates = this.getProviderTemplates();
    const template = templates[templateType]?.[templateKey];
    
    if (!template) {
      throw new Error(`模板 ${templateType}.${templateKey} 不存在`);
    }

    const now = new Date().toISOString();
    
    return {
      ...template,
      id: config.id,
      apiKey: config.apiKey,
      enabled: config.enabled ?? true,
      displayName: config.customDisplayName || template.displayName,
    };
  }

  /**
   * 获取默认提供商配置
   */
  private static getDefaultProviders(): AIProviderConfig[] {
    const now = new Date().toISOString();
    
    return [
      {
        ...DEFAULT_GEMINI_CONFIG,
        apiKey: '', // 需要用户配置
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  /**
   * 触发配置变更事件
   */
  private static dispatchConfigChangeEvent(type: string, data: any): void {
    if (typeof window === 'undefined') return;
    
    const event = new CustomEvent('ai-config-change', {
      detail: { type, data, timestamp: Date.now() },
    });
    window.dispatchEvent(event);
  }

  /**
   * 监听配置变更事件
   */
  static onConfigChange(callback: (event: CustomEvent) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    
    window.addEventListener('ai-config-change', callback);
    
    // 返回取消监听的函数
    return () => {
      window.removeEventListener('ai-config-change', callback);
    };
  }

  /**
   * 获取配置统计信息
   */
  static getStats(): {
    totalProviders: number;
    enabledProviders: number;
    totalModels: number;
    configVersion: string;
    lastUpdated?: string;
  } {
    const providers = this.getProviders();
    const models = this.getModels();
    
    return {
      totalProviders: providers.length,
      enabledProviders: providers.filter(p => p.enabled).length,
      totalModels: models.length,
      configVersion: CONFIG_VERSION,
      lastUpdated: providers.length > 0
        ? Math.max(...providers.map(p => new Date(p.updatedAt).getTime())).toString()
        : undefined,
    };
  }

  /**
   * 迁移旧版本配置
   */
  static migrateFromLegacy(): {
    migrated: boolean;
    providersAdded: number;
    errors: string[];
  } {
    const result = {
      migrated: false,
      providersAdded: 0,
      errors: [] as string[],
    };

    if (typeof window === 'undefined') return result;

    try {
      // 检查是否已有新配置
      const existingProviders = this.getProviders();
      if (existingProviders.length > 0) {
        return result; // 已有配置，无需迁移
      }

      // 尝试从旧的gemini-client配置迁移
      const legacyApiKey = localStorage.getItem('gemini-api-key');
      if (legacyApiKey && legacyApiKey.trim()) {
        try {
          const now = new Date().toISOString();
          const geminiProvider: AIProviderConfig = {
            id: 'gemini-migrated',
            name: 'gemini-migrated',
            displayName: 'Gemini (已迁移)',
            type: 'gemini',
            apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: legacyApiKey.trim(),
            enabled: true,
            defaultModel: 'gemini-2.5-flash',
            createdAt: now,
            updatedAt: now,
          };

          this.addProvider(geminiProvider);
          this.setSelectedProvider('gemini-migrated');
          
          result.migrated = true;
          result.providersAdded = 1;
        } catch (error: any) {
          result.errors.push(`迁移Gemini配置失败: ${error.message}`);
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`配置迁移失败: ${error.message}`);
      return result;
    }
  }

  /**
   * 检查配置健康状态
   */
  static checkHealth(): {
    healthy: boolean;
    issues: Array<{
      type: 'error' | 'warning';
      message: string;
      providerId?: string;
    }>;
  } {
    const issues: Array<{
      type: 'error' | 'warning';
      message: string;
      providerId?: string;
    }> = [];

    const providers = this.getProviders();
    const enabledProviders = providers.filter(p => p.enabled);

    // 检查是否有可用的提供商
    if (enabledProviders.length === 0) {
      issues.push({
        type: 'error',
        message: '没有启用的AI提供商',
      });
    }

    // 检查每个提供商的配置
    for (const provider of providers) {
      const validation = this.validateProvider(provider);
      
      if (!validation.valid) {
        issues.push({
          type: 'error',
          message: `提供商配置无效: ${validation.errors.join(', ')}`,
          providerId: provider.id,
        });
      }

      if (validation.warnings.length > 0) {
        issues.push({
          type: 'warning',
          message: `提供商配置警告: ${validation.warnings.join(', ')}`,
          providerId: provider.id,
        });
      }

      // 检查API密钥
      if (!provider.apiKey || provider.apiKey.trim().length === 0) {
        issues.push({
          type: 'error',
          message: 'API密钥未配置',
          providerId: provider.id,
        });
      }
    }

    // 检查选中的提供商是否有效
    const selectedProviderId = this.getSelectedProvider();
    if (selectedProviderId) {
      const selectedProvider = this.getProvider(selectedProviderId);
      if (!selectedProvider) {
        issues.push({
          type: 'error',
          message: '选中的提供商不存在',
        });
      } else if (!selectedProvider.enabled) {
        issues.push({
          type: 'warning',
          message: '选中的提供商已禁用',
          providerId: selectedProviderId,
        });
      }
    }

    return {
      healthy: issues.filter(i => i.type === 'error').length === 0,
      issues,
    };
  }
}

/**
 * 配置变更事件类型
 */
export type ConfigChangeEvent = CustomEvent<{
  type: 'providers' | 'models' | 'selectedProvider' | 'selectedModel' | 'clear';
  data: any;
  timestamp: number;
}>;

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  VERSION: CONFIG_VERSION,
  STORAGE_KEYS,
} as const;