/**
 * @fileOverview Gemini AI提供商实现
 * 将现有的gemini-client.ts功能适配到统一的AIProvider接口
 */

import {
  AIProvider,
  AIModel,
  GenerateOptions,
  ConnectionTestResult,
  AIProviderError,
  InvalidAPIKeyError,
  QuotaExceededError,
  NetworkError,
  ModelNotFoundError,
} from './base';
import {
  generateContent as geminiGenerateContent,
  generateContentStream as geminiGenerateContentStream,
  listGeminiModels,
  testApiKey,
  type GeminiModel,
} from '@/lib/gemini-client';

/**
 * Gemini AI提供商实现
 */
export class GeminiProvider implements AIProvider {
  public readonly type = 'gemini' as const;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly displayName: string,
    public readonly apiUrl: string,
    public readonly apiKey: string,
    public readonly enabled: boolean = true,
    public readonly defaultModel?: string,
    public readonly customHeaders?: Record<string, string>,
    public readonly advancedConfig?: import('./base').AdvancedGenerationConfig
  ) {}

  /**
   * 生成内容
   */
  async generateContent(
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<string> {
    try {
      // 合并高级配置和选项参数
      const mergedOptions = this.mergeGenerationOptions(options);
      
      const result = await geminiGenerateContent(modelId, prompt, {
        temperature: mergedOptions.temperature,
        maxOutputTokens: mergedOptions.maxOutputTokens,
        systemInstruction: mergedOptions.systemInstruction,
        topP: mergedOptions.topP,
        topK: mergedOptions.topK,
        thinkingBudget: mergedOptions.thinkingBudget,
        apiKey: this.apiKey,
      });
      return result;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 流式生成内容
   */
  async* generateContentStream(
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    try {
      // 合并高级配置和选项参数
      const mergedOptions = this.mergeGenerationOptions(options);
      
      const stream = geminiGenerateContentStream(modelId, prompt, {
        temperature: mergedOptions.temperature,
        maxOutputTokens: mergedOptions.maxOutputTokens,
        systemInstruction: mergedOptions.systemInstruction,
        topP: mergedOptions.topP,
        topK: mergedOptions.topK,
        thinkingBudget: mergedOptions.thinkingBudget,
        apiKey: this.apiKey,
      });

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<AIModel[]> {
    try {
      const geminiModels = await listGeminiModels(this.apiKey);
      return geminiModels.map((model) => this.convertGeminiModel(model));
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const result = await testApiKey(this.apiKey);
      const responseTime = Date.now() - startTime;
      
      return {
        valid: result.valid,
        error: result.error,
        responseTime,
        details: {
          provider: 'gemini',
          apiUrl: this.apiUrl,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        valid: false,
        error: error.message || '连接测试失败',
        responseTime,
        details: {
          provider: 'gemini',
          apiUrl: this.apiUrl,
          error: error,
        },
      };
    }
  }

  /**
   * 验证模型ID是否有效
   */
  async isValidModel(modelId: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.id === modelId);
    } catch {
      return false;
    }
  }

  /**
   * 获取模型信息
   */
  async getModelInfo(modelId: string): Promise<AIModel | null> {
    try {
      const models = await this.listModels();
      return models.find(model => model.id === modelId) || null;
    } catch {
      return null;
    }
  }

  /**
   * 转换Gemini模型格式到统一格式
   */
  private convertGeminiModel(geminiModel: GeminiModel): AIModel {
    return {
      id: geminiModel.id,
      name: geminiModel.name,
      displayName: geminiModel.displayName,
      description: geminiModel.description,
      maxTokens: this.getModelMaxTokens(geminiModel.id),
      supportStreaming: true,
      supportSystemInstruction: true,
    };
  }

  /**
   * 获取模型的最大token数
   */
  private getModelMaxTokens(modelId: string): number {
    // 根据模型ID返回对应的最大token数
    if (modelId.includes('gemini-2.5-pro')) {
      return 2097152; // 2M tokens
    } else if (modelId.includes('gemini-2.5-flash')) {
      return 1048576; // 1M tokens
    } else if (modelId.includes('gemini-1.5-pro')) {
      return 2097152; // 2M tokens
    } else if (modelId.includes('gemini-1.5-flash')) {
      return 1048576; // 1M tokens
    }
    return 32768; // 默认值
  }

  /**
   * 合并生成选项和高级配置
   */
  private mergeGenerationOptions(options?: GenerateOptions): GenerateOptions {
    const advancedConfig = this.advancedConfig || {};
    
    return {
      temperature: options?.temperature ?? advancedConfig.defaultTemperature,
      maxOutputTokens: options?.maxOutputTokens,
      systemInstruction: options?.systemInstruction,
      topP: options?.topP ?? advancedConfig.defaultTopP,
      topK: options?.topK ?? advancedConfig.defaultTopK,
      thinkingBudget: options?.thinkingBudget ?? (
        advancedConfig.enableDynamicThinking
          ? -1
          : advancedConfig.thinkingBudget
      ),
      customHeaders: options?.customHeaders,
    };
  }

  /**
   * 检查模型是否支持思考功能
   */
  private supportsThinking(modelId: string): boolean {
    return modelId.includes('gemini-2.5');
  }

  /**
   * 处理错误并转换为统一的错误类型
   */
  private handleError(error: any): AIProviderError {
    const message = error.message || '未知错误';
    
    // API密钥相关错误
    if (message.includes('API密钥无效') || 
        message.includes('INVALID_ARGUMENT') ||
        message.includes('API_KEY_INVALID')) {
      return new InvalidAPIKeyError(this.id);
    }
    
    // 权限相关错误
    if (message.includes('PERMISSION_DENIED') ||
        message.includes('没有权限访问')) {
      return new InvalidAPIKeyError(this.id);
    }
    
    // 配额相关错误
    if (message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('配额') ||
        message.includes('速率限制')) {
      return new QuotaExceededError(this.id, { originalError: error });
    }
    
    // 模型不存在错误
    if (message.includes('NOT_FOUND') ||
        message.includes('模型不可用') ||
        message.includes('model')) {
      return new ModelNotFoundError('unknown', this.id);
    }
    
    // 网络相关错误
    if (message.includes('Failed to fetch') ||
        message.includes('Network') ||
        message.includes('timed out') ||
        message.includes('Timeout')) {
      return new NetworkError(this.id, { originalError: error });
    }
    
    // 其他错误
    return new AIProviderError(
      message,
      'UNKNOWN_ERROR',
      this.id,
      { originalError: error }
    );
  }

  /**
   * 创建Gemini提供商实例的工厂方法
   */
  static create(config: {
    id: string;
    name: string;
    displayName: string;
    apiKey: string;
    enabled?: boolean;
    defaultModel?: string;
    advancedConfig?: import('./base').AdvancedGenerationConfig;
  }): GeminiProvider {
    return new GeminiProvider(
      config.id,
      config.name,
      config.displayName,
      'https://generativelanguage.googleapis.com/v1beta',
      config.apiKey,
      config.enabled ?? true,
      config.defaultModel || 'gemini-2.5-flash',
      undefined,
      config.advancedConfig
    );
  }

  /**
   * 从现有配置创建Gemini提供商
   */
  static fromLegacyConfig(apiKey: string): GeminiProvider {
    return GeminiProvider.create({
      id: 'gemini-legacy',
      name: 'gemini-legacy',
      displayName: 'Gemini (Legacy)',
      apiKey,
      enabled: true,
      defaultModel: 'gemini-2.5-flash',
    });
  }
}

/**
 * 默认的Gemini提供商配置
 */
export const DEFAULT_GEMINI_CONFIG = {
  id: 'gemini-default',
  name: 'gemini-default',
  displayName: 'Google Gemini',
  type: 'gemini' as const,
  apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
  enabled: true,
  defaultModel: 'gemini-2.5-flash',
};

/**
 * 预定义的 Gemini 提供商配置模板
 */
export const GEMINI_PROVIDER_TEMPLATES = {
  GOOGLE_GEMINI: {
    id: 'google-gemini',
    name: 'google-gemini',
    displayName: 'Google Gemini',
    type: 'gemini' as const,
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    enabled: true,
    defaultModel: 'gemini-2.5-flash',
    description: 'Google 官方 Gemini AI 服务',
  },
} as const;

/**
 * Google Gemini 提供商模板配置（向后兼容）
 */
export const GOOGLE_GEMINI_TEMPLATE = GEMINI_PROVIDER_TEMPLATES.GOOGLE_GEMINI;

/**
 * 常用的Gemini模型配置
 */
export const GEMINI_MODELS = {
  FLASH_LITE: 'gemini-2.5-flash-lite',
  FLASH: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
  FLASH_1_5: 'gemini-1.5-flash',
  PRO_1_5: 'gemini-1.5-pro',
} as const;