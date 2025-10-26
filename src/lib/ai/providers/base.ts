/**
 * @fileOverview 统一AI提供商接口定义
 * 定义了所有AI提供商必须实现的统一接口，支持多种AI服务商
 */

/**
 * AI模型信息
 */
export interface AIModel {
  /** 模型唯一标识符 */
  id: string;
  /** 模型名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 模型描述 */
  description?: string;
  /** 最大token数 */
  maxTokens?: number;
  /** 是否支持流式响应 */
  supportStreaming?: boolean;
  /** 是否支持系统指令 */
  supportSystemInstruction?: boolean;
}

/**
 * 生成选项
 */
export interface GenerateOptions {
  /** 温度参数，控制随机性 (0-1) */
  temperature?: number;
  /** 最大输出token数 */
  maxOutputTokens?: number;
  /** 系统指令 */
  systemInstruction?: string;
  /** Top-p 采样参数 */
  topP?: number;
  /** Top-k 采样参数 */
  topK?: number;
  /** 自定义请求头 */
  customHeaders?: Record<string, string>;
  /** 思考预算（仅Gemini 2.5系列支持，-1为动态思考，0为禁用，>0为固定token数） */
  thinkingBudget?: number;
}

/**
 * 高级生成配置
 */
export interface AdvancedGenerationConfig {
  /** 默认温度参数 (0-1) */
  defaultTemperature?: number;
  /** 默认Top-p参数 (0-1) */
  defaultTopP?: number;
  /** 默认Top-k参数 */
  defaultTopK?: number;
  /** 是否启用动态思考（仅Gemini 2.5系列） */
  enableDynamicThinking?: boolean;
  /** 思考预算token数（仅Gemini 2.5系列，-1为动态，0为禁用） */
  thinkingBudget?: number;
  /** 请求超时时间（毫秒），用于提升网络抖动容忍度 */
  requestTimeoutMs?: number;
  /** 请求重试次数（0-3），针对超时/网络错误与5xx重试 */
  retries?: number;
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  /** 是否连接成功 */
  valid: boolean;
  /** 错误信息 */
  error?: string;
  /** 响应时间(毫秒) */
  responseTime?: number;
  /** 额外信息 */
  details?: Record<string, any>;
}

/**
 * AI提供商统一接口
 */
export interface AIProvider {
  /** 提供商唯一标识符 */
  readonly id: string;
  /** 提供商名称 */
  readonly name: string;
  /** 显示名称 */
  readonly displayName: string;
  /** 提供商类型 */
  readonly type: 'openai' | 'gemini' | 'claude' | 'custom';
  /** API地址 */
  readonly apiUrl: string;
  /** API密钥 */
  readonly apiKey: string;
  /** 是否启用 */
  readonly enabled: boolean;
  /** 默认模型ID */
  readonly defaultModel?: string;
  /** 自定义请求头 */
  readonly customHeaders?: Record<string, string>;

  /**
   * 生成内容
   * @param modelId 模型ID
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 生成的内容
   */
  generateContent(
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<string>;

  /**
   * 流式生成内容
   * @param modelId 模型ID
   * @param prompt 提示词
   * @param options 生成选项
   * @returns 内容流
   */
  generateContentStream(
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): AsyncGenerator<string, void, unknown>;

  /**
   * 获取可用模型列表
   * @returns 模型列表
   */
  listModels(): Promise<AIModel[]>;

  /**
   * 测试连接
   * @returns 测试结果
   */
  testConnection(): Promise<ConnectionTestResult>;

  /**
   * 验证模型ID是否有效
   * @param modelId 模型ID
   * @returns 是否有效
   */
  isValidModel(modelId: string): Promise<boolean>;

  /**
   * 获取模型信息
   * @param modelId 模型ID
   * @returns 模型信息
   */
  getModelInfo(modelId: string): Promise<AIModel | null>;
}

/**
 * AI提供商配置
 */
export interface AIProviderConfig {
  /** 提供商唯一标识符 */
  id: string;
  /** 提供商名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 提供商类型 */
  type: 'openai' | 'gemini' | 'claude' | 'custom';
  /** API地址 */
  apiUrl: string;
  /** API密钥 */
  apiKey: string;
  /** 是否启用 */
  enabled: boolean;
  /** 默认模型ID */
  defaultModel?: string;
  /** 自定义请求头 */
  customHeaders?: Record<string, string>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 高级生成配置 */
  advancedConfig?: AdvancedGenerationConfig;
  /** 额外配置 */
  extra?: Record<string, any>;
}

/**
 * AI模型配置
 */
export interface AIModelConfig {
  /** 提供商ID */
  providerId: string;
  /** 模型ID */
  modelId: string;
  /** 显示名称 */
  displayName: string;
  /** 最大token数 */
  maxTokens?: number;
  /** 默认温度 */
  defaultTemperature?: number;
  /** 是否支持流式响应 */
  supportStreaming?: boolean;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 提供商错误类型
 */
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly providerId: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

/**
 * 模型不存在错误
 */
export class ModelNotFoundError extends AIProviderError {
  constructor(modelId: string, providerId: string) {
    super(
      `Model '${modelId}' not found in provider '${providerId}'`,
      'MODEL_NOT_FOUND',
      providerId,
      { modelId }
    );
    this.name = 'ModelNotFoundError';
  }
}

/**
 * API密钥无效错误
 */
export class InvalidAPIKeyError extends AIProviderError {
  constructor(providerId: string) {
    super(
      `Invalid API key for provider '${providerId}'`,
      'INVALID_API_KEY',
      providerId
    );
    this.name = 'InvalidAPIKeyError';
  }
}

/**
 * 配额超限错误
 */
export class QuotaExceededError extends AIProviderError {
  constructor(providerId: string, details?: any) {
    super(
      `Quota exceeded for provider '${providerId}'`,
      'QUOTA_EXCEEDED',
      providerId,
      details
    );
    this.name = 'QuotaExceededError';
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AIProviderError {
  constructor(providerId: string, details?: any) {
    super(
      `Network error for provider '${providerId}'`,
      'NETWORK_ERROR',
      providerId,
      details
    );
    this.name = 'NetworkError';
  }
}