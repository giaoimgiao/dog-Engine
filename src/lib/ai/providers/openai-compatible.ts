
/**
 * @fileOverview OpenAI兼容AI提供商实现
 * 支持OpenAI API格式以及其他兼容OpenAI API的服务（如Claude、本地模型等）
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

/**
 * OpenAI API消息格式
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI API请求格式
 */
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

/**
 * OpenAI API响应格式
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI流式响应格式
 */
interface OpenAIStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

/**
 * OpenAI模型列表响应
 */
interface OpenAIModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

/**
 * OpenAI兼容提供商实现
 */
export class OpenAICompatibleProvider implements AIProvider {
  public readonly type = 'openai' as const;

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly displayName: string,
    public readonly apiUrl: string,
    public readonly apiKey: string,
    public readonly enabled: boolean = true,
    public readonly defaultModel?: string,
    public readonly customHeaders?: Record<string, string>
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
      const messages: OpenAIMessage[] = [];
      
      // 添加系统指令
      if (options?.systemInstruction) {
        messages.push({
          role: 'system',
          content: options.systemInstruction,
        });
      }
      
      // 添加用户提示
      messages.push({
        role: 'user',
        content: prompt,
      });

      const requestBody: OpenAIRequest = {
        model: modelId,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 2048,
        top_p: options?.topP,
        stream: false,
      };

      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        headers: this.getHeaders(options?.customHeaders),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      const data: OpenAIResponse = await response.json();
      
      if (!data.choices || data.choices.length === 0) {
        throw new AIProviderError(
          '模型未返回内容',
          'NO_CONTENT',
          this.id,
          { response: data }
        );
      }

      return data.choices[0].message.content || '';
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
      const messages: OpenAIMessage[] = [];
      
      // 添加系统指令
      if (options?.systemInstruction) {
        messages.push({
          role: 'system',
          content: options.systemInstruction,
        });
      }
      
      // 添加用户提示
      messages.push({
        role: 'user',
        content: prompt,
      });

      const requestBody: OpenAIRequest = {
        model: modelId,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 2048,
        top_p: options?.topP,
        stream: true,
      };

      const response = await this.makeRequest('/chat/completions', {
        method: 'POST',
        headers: this.getHeaders(options?.customHeaders),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new NetworkError(this.id, { error: '无法获取响应流' });
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const data = trimmed.slice(6);
            if (data === '[DONE]') return;

            try {
              const chunk: OpenAIStreamChunk = JSON.parse(data);
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // 忽略解析错误的行
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
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
      const response = await this.makeRequest('/models', {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw await this.handleHttpError(response);
      }

      const data: OpenAIModelsResponse = await response.json();
      
      return data.data.map(model => ({
        id: model.id,
        name: model.id,
        displayName: this.formatModelDisplayName(model.id),
        description: `${model.owned_by} 提供的模型`,
        maxTokens: this.getModelMaxTokens(model.id),
        supportStreaming: true,
        supportSystemInstruction: true,
      }));
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
      const response = await this.makeRequest('/models', {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          valid: true,
          responseTime,
          details: {
            provider: 'openai-compatible',
            apiUrl: this.apiUrl,
            status: response.status,
          },
        };
      } else {
        const errorText = await response.text();
        return {
          valid: false,
          error: `HTTP ${response.status}: ${errorText}`,
          responseTime,
          details: {
            provider: 'openai-compatible',
            apiUrl: this.apiUrl,
            status: response.status,
          },
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        valid: false,
        error: error.message || '连接测试失败',
        responseTime,
        details: {
          provider: 'openai-compatible',
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
   * 发起HTTP请求
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.apiUrl.replace(/\/$/, '')}${endpoint}`;
    
    const timeoutMs = 30000; // 30秒超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 获取请求头
   */
  private getHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...this.customHeaders,
      ...customHeaders,
    };
    return headers;
  }

  /**
   * 格式化模型显示名称
   */
  private formatModelDisplayName(modelId: string): string {
    // 将模型ID转换为更友好的显示名称
    if (modelId.startsWith('gpt-')) {
      return modelId.toUpperCase().replace(/-/g, ' ');
    }
    if (modelId.startsWith('claude-')) {
      return 'Claude ' + modelId.slice(7).replace(/-/g, ' ');
    }
    return modelId;
  }

  /**
   * 获取模型的最大token数
   */
  private getModelMaxTokens(modelId: string): number {
    // 根据模型ID返回对应的最大token数
    if (modelId.includes('gpt-4')) {
      if (modelId.includes('32k')) return 32768;
      if (modelId.includes('turbo')) return 128000;
      return 8192;
    } else if (modelId.includes('gpt-3.5')) {
      if (modelId.includes('16k')) return 16384;
      return 4096;
    } else if (modelId.includes('claude')) {
      return 200000; // Claude 通常支持更长的上下文
    }
    return 4096; // 默认值
  }

  /**
   * 处理HTTP错误
   */
  private async handleHttpError(response: Response): Promise<AIProviderError> {
    const status = response.status;
    let errorText = '';
    
    try {
      errorText = await response.text();
    } catch {
      errorText = `HTTP ${status}`;
    }

    if (status === 401) {
      return new InvalidAPIKeyError(this.id);
    } else if (status === 429) {
      return new QuotaExceededError(this.id, { status, errorText });
    } else if (status === 404) {
      return new ModelNotFoundError('unknown', this.id);
    } else if (status >= 500) {
      return new NetworkError(this.id, { status, errorText });
    } else {
      return new AIProviderError(
        `HTTP ${status}: ${errorText}`,
        'HTTP_ERROR',
        this.id,
        { status, errorText }
      );
    }
  }

  /**
   * 处理错误并转换为统一的错误类型
   */
  private handleError(error: any): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    const message = error.message || '未知错误';
    
    // 网络相关错误
    if (error.name === 'AbortError' || message.includes('aborted')) {
      return new NetworkError(this.id, { error: '请求超时', originalError: error });
    }
    
    if (message.includes('Failed to fetch') || 
        message.includes('Network') ||
        message.includes('fetch')) {
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
   * 创建OpenAI兼容提供商实例的工厂方法
   */
  static create(config: {
    id: string;
    name: string;
    displayName: string;
    apiUrl: string;
    apiKey: string;
    enabled?: boolean;
    defaultModel?: string;
    customHeaders?: Record<string, string>;
  }): OpenAICompatibleProvider {
    return new OpenAICompatibleProvider(
      config.id,
      config.name,
      config.displayName,
      config.apiUrl,
      config.apiKey,
      config.enabled ?? true,
      config.defaultModel,
      config.customHeaders
    );
  }

  /**
   * 创建OpenAI官方提供商
   */
  static createOpenAI(config: {
    id: string;
    apiKey: string;
    enabled?: boolean;
  }): OpenAICompatibleProvider {
    return OpenAICompatibleProvider.create({
      id: config.id,
      name: 'openai',
      displayName: 'OpenAI',
      apiUrl: 'https://api.openai.com/v1',
      apiKey: config.apiKey,
      enabled: config.enabled,
      defaultModel: 'gpt-3.5-turbo',
    });
  }

  /**
   * 创建Claude提供商（通过OpenAI兼容API）
   */
  static createClaude(config: {
    id: string;
    apiKey: string;
    enabled?: boolean;
  }): OpenAICompatibleProvider {
    return OpenAICompatibleProvider.create({
      id: config.id,
      name: 'claude',
      displayName: 'Anthropic Claude',
      apiUrl: 'https://api.anthropic.com/v1',
      apiKey: config.apiKey,
      enabled: config.enabled,
      defaultModel: 'claude-3-sonnet-20240229',
      customHeaders: {
        'anthropic-version': '2023-06-01',
      },
    });
  }
}

/**
 * 预定义的OpenAI兼容提供商配置
 */
export const OPENAI_COMPATIBLE_CONFIGS = {
  OPENAI: {
    name: 'openai',
    displayName: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-3.5-turbo',
  },
  CLAUDE: {
    name: 'claude',
    displayName: 'Anthropic Claude',
    apiUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-sonnet-20240229',
    customHeaders: {
      'anthropic-version': '2023-06-01',
    },
  },
  DEEPSEEK: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  MOONSHOT: {
    name: 'moonshot',
    displayName: 'Moonshot AI',
    apiUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
  },
  ZHIPU: {
    name: 'zhipu',
    displayName: '智谱AI',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4',
  },
} as const;

/**
 * 常用的OpenAI模型
 */
export const OPENAI_MODELS = {
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_3_5_TURBO_16K: 'gpt-3.5-turbo-16k',
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo-preview',
  GPT_4_32K: 'gpt-4-32k',
} as const;

/**
 * 常用的Claude模型
 */
export const CLAUDE_MODELS = {
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
} as const;