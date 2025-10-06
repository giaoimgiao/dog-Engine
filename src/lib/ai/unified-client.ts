
/**
 * @fileOverview 统一AI客户端
 * 管理所有AI提供商，提供统一的调用接口，支持自动路由和错误处理
 */

import {
  AIProvider,
  AIModel,
  GenerateOptions,
  ConnectionTestResult,
  AIProviderError,
  ModelNotFoundError,
} from './providers/base';
import { GeminiProvider } from './providers/gemini';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { AIConfigManager, type ConfigChangeEvent } from './config-manager';

/**
 * 统一AI客户端选项
 */
export interface UnifiedAIClientOptions {
  /** 是否自动加载配置 */
  autoLoadConfig?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 默认超时时间(毫秒) */
  defaultTimeout?: number;
}

/**
 * 生成统计信息
 */
export interface GenerationStats {
  /** 提供商ID */
  providerId: string;
  /** 模型ID */
  modelId: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 输入token数（估算） */
  inputTokens?: number;
  /** 输出token数（估算） */
  outputTokens?: number;
}

/**
 * 统一AI客户端
 */
export class UnifiedAIClient {
  private providers = new Map<string, AIProvider>();
  private stats: GenerationStats[] = [];
  private configChangeUnsubscribe?: () => void;
  private options: Required<UnifiedAIClientOptions>;

  constructor(options: UnifiedAIClientOptions = {}) {
    this.options = {
      autoLoadConfig: true,
      debug: false,
      defaultTimeout: 30000,
      ...options,
    };

    if (this.options.autoLoadConfig) {
      this.loadProvidersFromConfig();
      this.setupConfigListener();
    }
  }

  /**
   * 添加提供商
   */
  addProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.log(`Added provider: ${provider.id} (${provider.type})`);
  }

  /**
   * 移除提供商
   */
  removeProvider(providerId: string): void {
    const removed = this.providers.delete(providerId);
    if (removed) {
      this.log(`Removed provider: ${providerId}`);
    }
  }

  /**
   * 获取提供商
   */
  getProvider(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * 获取所有提供商
   */
  listProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取启用的提供商
   */
  getEnabledProviders(): AIProvider[] {
    return this.listProviders().filter(p => p.enabled);
  }

  /**
   * 生成内容
   */
  async generateContent(
    providerId: string,
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<string> {
    const startTime = Date.now();
    const stats: GenerationStats = {
      providerId,
      modelId,
      startTime,
      success: false,
    };

    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw new AIProviderError(
          `Provider '${providerId}' not found`,
          'PROVIDER_NOT_FOUND',
          providerId
        );
      }

      if (!provider.enabled) {
        throw new AIProviderError(
          `Provider '${providerId}' is disabled`,
          'PROVIDER_DISABLED',
          providerId
        );
      }

      this.log(`Generating content with ${providerId}/${modelId}`);

      const result = await provider.generateContent(modelId, prompt, options);
      
      stats.endTime = Date.now();
      stats.success = true;
      stats.inputTokens = this.estimateTokens(prompt + (options?.systemInstruction || ''));
      stats.outputTokens = this.estimateTokens(result);

      this.log(`Generated ${stats.outputTokens} tokens in ${stats.endTime - stats.startTime}ms`);
      
      return result;
    } catch (error: any) {
      stats.endTime = Date.now();
      stats.error = error.message;
      this.log(`Generation failed: ${error.message}`);
      throw error;
    } finally {
      this.stats.push(stats);
      this.trimStats();
    }
  }

  /**
   * 流式生成内容
   */
  async* generateContentStream(
    providerId: string,
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    const stats: GenerationStats = {
      providerId,
      modelId,
      startTime,
      success: false,
    };

    try {
      const provider = this.getProvider(providerId);
      if (!provider) {
        throw new AIProviderError(
          `Provider '${providerId}' not found`,
          'PROVIDER_NOT_FOUND',
          providerId
        );
      }

      if (!provider.enabled) {
        throw new AIProviderError(
          `Provider '${providerId}' is disabled`,
          'PROVIDER_DISABLED',
          providerId
        );
      }

      this.log(`Streaming content with ${providerId}/${modelId}`);

      let outputText = '';
      const stream = provider.generateContentStream(modelId, prompt, options);

      for await (const chunk of stream) {
        outputText += chunk;
        yield chunk;
      }

      stats.endTime = Date.now();
      stats.success = true;
      stats.inputTokens = this.estimateTokens(prompt + (options?.systemInstruction || ''));
      stats.outputTokens = this.estimateTokens(outputText);

      this.log(`Streamed ${stats.outputTokens} tokens in ${stats.endTime - stats.startTime}ms`);
    } catch (error: any) {
      stats.endTime = Date.now();
      stats.error = error.message;
      this.log(`Streaming failed: ${error.message}`);
      throw error;
    } finally {
      this.stats.push(stats);
      this.trimStats();
    }
  }

  /**
   * 获取模型列表
   */
  async listModels(providerId: string): Promise<AIModel[]> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new AIProviderError(
        `Provider '${providerId}' not found`,
        'PROVIDER_NOT_FOUND',
        providerId
      );
    }

    return provider.listModels();
  }

  /**
   * 获取所有提供商的模型列表
   */
  async listAllModels(): Promise<Array<{ providerId: string; models: AIModel[] }>> {
    const results: Array<{ providerId: string; models: AIModel[] }> = [];
    
    for (const provider of this.getEnabledProviders()) {
      try {
        const models = await provider.listModels();
        results.push({ providerId: provider.id, models });
      } catch (error) {
        this.log(`Failed to list models for ${provider.id}: ${error}`);
        // 继续处理其他提供商
      }
    }

    return results;
  }

  /**
   * 测试提供商连接
   */
  async testConnection(providerId: string): Promise<ConnectionTestResult> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return {
        valid: false,
        error: `Provider '${providerId}' not found`,
      };
    }

    return provider.testConnection();
  }

  /**
   * 测试所有提供商连接
   */
  async testAllConnections(): Promise<Array<{ providerId: string; result: ConnectionTestResult }>> {
    const results: Array<{ providerId: string; result: ConnectionTestResult }> = [];
    
    for (const provider of this.listProviders()) {
      try {
        const result = await provider.testConnection();
        results.push({ providerId: provider.id, result });
      } catch (error: any) {
        results.push({
          providerId: provider.id,
          result: {
            valid: false,
            error: error.message || '测试失败',
          },
        });
      }
    }

    return results;
  }

  /**
   * 验证模型是否存在
   */
  async isValidModel(providerId: string, modelId: string): Promise<boolean> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return false;
    }

    return provider.isValidModel(modelId);
  }

  /**
   * 获取模型信息
   */
  async getModelInfo(providerId: string, modelId: string): Promise<AIModel | null> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      return null;
    }

    return provider.getModelInfo(modelId);
  }

  /**
   * 自动选择最佳提供商
   */
  async selectBestProvider(requirements?: {
    supportStreaming?: boolean;
    maxTokens?: number;
    preferredTypes?: string[];
  }): Promise<{ providerId: string; modelId: string } | null> {
    const enabledProviders = this.getEnabledProviders();
    
    if (enabledProviders.length === 0) {
      return null;
    }

    // 简单的选择策略：优先选择Gemini，然后是OpenAI
    const preferredOrder = ['gemini', 'openai', 'claude', 'custom'];
    
    for (const type of preferredOrder) {
      const provider = enabledProviders.find(p => p.type === type);
      if (provider && provider.defaultModel) {
        return {
          providerId: provider.id,
          modelId: provider.defaultModel,
        };
      }
    }

    // 如果没有找到首选类型，返回第一个可用的
    const firstProvider = enabledProviders[0];
    if (firstProvider && firstProvider.defaultModel) {
      return {
        providerId: firstProvider.id,
        modelId: firstProvider.defaultModel,
      };
    }

    return null;
  }

  /**
   * 获取生成统计信息
   */
  getStats(): GenerationStats[] {
    return [...this.stats];
  }

  /**
   * 清除统计信息
   */
  clearStats(): void {
    this.stats = [];
  }

  /**
   * 获取统计摘要
   */
  getStatsSummary(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalTokens: number;
    averageResponseTime: number;
    providerUsage: Record<string, number>;
  } {
    const total = this.stats.length;
    const successful = this.stats.filter(s => s.success).length;
    const failed = total - successful;
    const totalTokens = this.stats.reduce((sum, s) => sum + (s.outputTokens || 0), 0);
    const totalTime = this.stats
      .filter(s => s.endTime)
      .reduce((sum, s) => sum + (s.endTime! - s.startTime), 0);
    const averageResponseTime = total > 0 ? totalTime / total : 0;

    const providerUsage: Record<string, number> = {};
    for (const stat of this.stats) {
      providerUsage[stat.providerId] = (providerUsage[stat.providerId] || 0) + 1;
    }

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      totalTokens,
      averageResponseTime,
      providerUsage,
    };
  }

  /**
   * 销毁客户端
   */
  destroy(): void {
    if (this.configChangeUnsubscribe) {
      this.configChangeUnsubscribe();
    }
    this.providers.clear();
    this.stats = [];
  }

  /**
   * 从配置加载提供商
   */
  private loadProvidersFromConfig(): void {
    try {
      const configs = AIConfigManager.getEnabledProviders();
      
      for (const config of configs) {
        try {
          const provider = this.createProviderFromConfig(config);
          this.addProvider(provider);
        } catch (error: any) {
          this.log(`Failed to create provider ${config.id}: ${error.message}`);
        }
      }

      this.log(`Loaded ${this.providers.size} providers from config`);
    } catch (error: any) {
      this.log(`Failed to load providers from config: ${error.message}`);
    }
  }

  /**
   * 从配置创建提供商实例
   */
  private createProviderFromConfig(config: any): AIProvider {
    switch (config.type) {
      case 'gemini':
        return new GeminiProvider(
          config.id,
          config.name,
          config.displayName,
          config.apiUrl,
          config.apiKey,
          config.enabled,
          config.defaultModel,
          config.customHeaders
        );
      
      case 'openai':
      case 'claude':
      case 'custom':
        return new OpenAICompatibleProvider(
          config.id,
          config.name,
          config.displayName,
          config.apiUrl,
          config.apiKey,
          config.enabled,
          config.defaultModel,
          config.customHeaders
        );
      
      default:
        throw new Error(`Unsupported provider type: ${config.type}`);
    }
  }

  /**
   * 设置配置变更监听
   */
  private setupConfigListener(): void {
    this.configChangeUnsubscribe = AIConfigManager.onConfigChange((event: ConfigChangeEvent) => {
      const { type } = event.detail;
      
      if (type === 'providers' || type === 'clear') {
        this.log('Config changed, reloading providers');
        this.providers.clear();
        this.loadProvidersFromConfig();
      }
    });
  }

  /**
   * 估算token数量
   */
  private estimateTokens(text: string): number {
    // 简单的token估算：中文字符按1个token，英文单词按0.75个token计算
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return Math.ceil(chineseChars + englishWords * 0.75);
  }

  /**
   * 限制统计数据大小
   */
  private trimStats(): void {
    const maxStats = 1000; // 最多保留1000条记录
    if (this.stats.length > maxStats) {
      this.stats = this.stats.slice(-maxStats);
    }
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.log(`[UnifiedAIClient] ${message}`);
    }
  }
}

/**
 * 全局统一AI客户端实例
 */
let globalClient: UnifiedAIClient | null = null;

/**
 * 获取全局统一AI客户端实例
 */
export function getUnifiedAIClient(options?: UnifiedAIClientOptions): UnifiedAIClient {
  if (!globalClient) {
    globalClient = new UnifiedAIClient(options);
  }
  return globalClient;
}

/**
 * 重置全局统一AI客户端实例
 */
export function resetUnifiedAIClient(): void {
  if (globalClient) {
    globalClient.destroy();
    globalClient = null;
  }
}

/**
 * 便捷的生成内容函数
 */
export async function generateContent(
  providerId: string,
  modelId: string,
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  const client = getUnifiedAIClient();
  return client.generateContent(providerId, modelId, prompt, options);
}

/**
 * 便捷的流式生成内容函数
 */
export async function* generateContentStream(
  providerId: string,
  modelId: string,
  prompt: string,
  options?: GenerateOptions
): AsyncGenerator<string, void, unknown> {
  const client = getUnifiedAIClient();
  yield* client.generateContentStream(providerId, modelId, prompt, options);
}

/**
 * 便捷的模型列表获取函数
 */
export async function listModels(providerId: string): Promise<AIModel[]> {
  const client = getUnifiedAIClient();
  return client.listModels(providerId);
}

/**
 * 便捷的连接测试函数
 */
export async function testConnection(providerId: string): Promise<ConnectionTestResult> {
  const client = getUnifiedAIClient();
  return client.testConnection(providerId);
}

/**
 * 自动选择并生成内容
 */
export async function autoGenerateContent(
  prompt: string,
  options?: GenerateOptions & {
    requirements?: {
      supportStreaming?: boolean;
      maxTokens?: number;
      preferredTypes?: string[];
    };
  }
): Promise<string> {
  const client = getUnifiedAIClient();
  const selection = await client.selectBestProvider(options?.requirements);
  
  if (!selection) {
    throw new AIProviderError(
      'No available providers found',
      'NO_PROVIDERS',
      'auto'
    );
  }

  return client.generateContent(selection.providerId, selection.modelId, prompt, options);
}

/**
 * 自动选择并流式生成内容
 */
export async function* autoGenerateContentStream(
  prompt: string,
  options?: GenerateOptions & {
    requirements?: {
      supportStreaming?: boolean;
      maxTokens?: number;
      preferredTypes?: string[];
    };
  }
): AsyncGenerator<string, void, unknown> {
  const client = getUnifiedAIClient();
  const selection = await client.selectBestProvider(options?.requirements);
  
  if (!selection) {
    throw new AIProviderError(
      'No available providers found',
      'NO_PROVIDERS',
      'auto'
    );
  }

  yield* client.generateContentStream(selection.providerId, selection.modelId, prompt, options);
}

/**
 * 导出相关类型
 */
export type {
  UnifiedAIClientOptions,
  GenerationStats,
};