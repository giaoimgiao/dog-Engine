'use server';

import type { ReviewManuscriptOutput } from "@/ai/flows/review-manuscript";

export interface Chapter {
  id: string;
  title: string;
  content: string;
  url?: string; // For bookstore chapters
}

export interface Book {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
  author?: string;
  cover?: string;
  category?: string;
  latestChapter?: string;
  detailUrl?: string; // For bookstore books
  sourceId?: string; // Origin source id to refetch chapters
}

export interface WorldSetting {
  id: string;
  keyword: string;
  description: string;
  enabled: boolean;
  /** 关联到书架中其他书籍的ID列表（用于跨书共享） */
  linkedBookIds?: string[];
}

export interface Character {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  /** 关联到书架中其他书籍的ID列表（用于跨书共享） */
  linkedBookIds?: string[];
  /** 角色别名（用于实体对齐与去重） */
  aliases?: string[];
  /** 首次/最近出现的章节ID（用于回溯与排序） */
  originChapterIds?: string[];
  /** 规范化后的主名（实体对齐使用，不展示） */
  canonicalName?: string;
  /** 合并历史记录（被合并来源的ID列表） */
  mergeHistory?: string[];
}

export type ReviewResult = ReviewManuscriptOutput;

export interface CommunityPrompt {
  id: string;
  name: string;
  prompt: string;
  likes: number;
  visible: boolean;
  createdAt: string;
}

// Bookstore specific types
export interface BookstoreBook {
  title: string;
  author: string;
  category: string;
  latestChapter: string;
  cover: string;
  detailUrl: string;
  sourceId: string; // To know which source it belongs to
}

export interface BookstoreCategory {
  title: string;
  url: string;
  sourceId: string;
}

export interface BookstoreChapter {
    title: string;
    url: string;
    intro?: string;
}

export interface BookstoreBookDetail extends Omit<BookstoreBook, 'sourceId'> {
    description: string;
    chapters: BookstoreChapter[];
    extraInfo?: Record<string, string>; // 额外的动态字段（评分、标签、主角等）
}

export interface BookstoreChapterContent {
  title: string;
  content: string;
  nextChapterUrl?: string;
  prevChapterUrl?: string;
}

// Data structure for parsing rules from community JSON
export interface BookSourceRule {
  // Search page rules
  search?: {
    url?: string;
    checkKeyWord?: string;
    bookList: string;
    name: string;
    author?: string;
    kind?: string;
    wordCount?: string;
    lastChapter?: string;
    intro?: string;
    coverUrl?: string;
    bookUrl: string;
  };
  
  // Find/Discovery page rules
  find?: {
    url?: string;
    bookList: string;
    name: string;
    author?: string;
    kind?: string;
    wordCount?: string;
    lastChapter?: string;
    intro?: string;
    coverUrl?: string;
    bookUrl: string;
  };

  // Book detail page rules
  bookInfo?: {
    init?: string; // pre-process rule
    name?: string;
    author?: string;
    kind?: string;
    wordCount?: string;
    lastChapter?: string;
    intro?: string;
    coverUrl?: string;
    tocUrl?: string; // Table of Contents URL
  };

  // Table of Contents (TOC) rules
  toc?: {
    preUpdateJs?: string;
    chapterList: string;
    chapterName: string;
    chapterUrl: string;
    formatJs?: string;
    isVolume?: string;
    updateTime?: string;
    isVip?: string;
    isPay?: string;
  };

  // Chapter content rules
  content?: {
    content: string;
    chapterName?: string;
    nextContentUrl?: string;
    webJs?: string;
    sourceRegex?: string;
    replaceRegex?: string;
    imageStyle?: string;
    imageDecode?: string;
    payAction?: string;
  };
}


// User-configurable Book Source based on community JSON structure
export interface BookSource {
  id: string; // Internal UUID
  enabled: boolean;
  
  // Main source info
  url: string;
  name: string;
  group?: string;
  comment?: string;
  exploreUrl?: string;
  loginUrl?: string;
  loginUi?: string;
  loginCheckJs?: string;
  jsLib?: string;
  coverDecodeJs?: string; // Cover decode JS
  proxyBase?: string; // Optional per-source proxy base
  bookUrlPattern?: string;
  header?: string; // Can be JSON string for request headers
  searchUrl?: string;
  
  // Parsing rules
  rules?: BookSourceRule | null;
}

// ===== AI 相关类型定义 =====

/**
 * 统一AI选项
 */
export interface UnifiedAIOptions {
  /** 提供商ID */
  providerId?: string;
  /** 模型ID */
  modelId?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大输出token数 */
  maxOutputTokens?: number;
  /** 系统指令 */
  systemInstruction?: string;
  /** Top-p 采样参数 */
  topP?: number;
  /** Top-k 采样参数 */
  topK?: number;
}

/**
 * 提供商类型枚举
 */
export type ProviderType = 'openai' | 'gemini' | 'claude' | 'custom';

/**
 * AI提供商配置（扩展版本，用于UI组件）
 */
export interface AIProviderConfigExtended {
  /** 提供商唯一标识符 */
  id: string;
  /** 提供商名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 提供商类型 */
  type: ProviderType;
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
  /** 额外配置 */
  extra?: Record<string, any>;
  /** 连接状态 */
  connectionStatus?: 'unknown' | 'connected' | 'error';
  /** 最后测试时间 */
  lastTestedAt?: string;
  /** 可用模型列表 */
  availableModels?: AIModelInfo[];
}

/**
 * AI模型信息
 */
export interface AIModelInfo {
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
  /** 提供商ID */
  providerId: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 默认参数 */
  defaultParams?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

/**
 * AI模型选择器选项
 */
export interface ModelSelectorOption {
  /** 提供商ID */
  providerId: string;
  /** 提供商显示名称 */
  providerDisplayName: string;
  /** 模型ID */
  modelId: string;
  /** 模型显示名称 */
  modelDisplayName: string;
  /** 是否可用 */
  available: boolean;
  /** 是否推荐 */
  recommended?: boolean;
}

/**
 * AI功能配置
 */
export interface AIFeatureConfig {
  /** 功能ID */
  id: string;
  /** 功能名称 */
  name: string;
  /** 功能描述 */
  description?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 默认提供商ID */
  defaultProviderId?: string;
  /** 默认模型ID */
  defaultModelId?: string;
  /** 默认参数 */
  defaultParams?: UnifiedAIOptions;
  /** 功能特定配置 */
  config?: Record<string, any>;
}

/**
 * AI使用统计
 */
export interface AIUsageStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 总token数 */
  totalTokens: number;
  /** 平均响应时间(毫秒) */
  averageResponseTime: number;
  /** 提供商使用统计 */
  providerUsage: Record<string, {
    requests: number;
    tokens: number;
    averageResponseTime: number;
  }>;
  /** 模型使用统计 */
  modelUsage: Record<string, {
    requests: number;
    tokens: number;
    averageResponseTime: number;
  }>;
  /** 统计时间范围 */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * AI错误信息
 */
export interface AIErrorInfo {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 提供商ID */
  providerId?: string;
  /** 模型ID */
  modelId?: string;
  /** 错误详情 */
  details?: any;
  /** 发生时间 */
  timestamp: string;
  /** 是否可重试 */
  retryable?: boolean;
  /** 建议的解决方案 */
  suggestions?: string[];
}

/**
 * AI配置导入导出格式
 */
export interface AIConfigExport {
  /** 配置版本 */
  version: string;
  /** 导出时间 */
  exportedAt: string;
  /** 提供商配置 */
  providers: AIProviderConfigExtended[];
  /** 模型配置 */
  models: AIModelInfo[];
  /** 功能配置 */
  features: AIFeatureConfig[];
  /** 当前选择 */
  selections: {
    providerId?: string;
    modelId?: string;
  };
  /** 用户偏好 */
  preferences: {
    autoSelectProvider?: boolean;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
    enableDebugMode?: boolean;
  };
}

/**
 * AI提示词模板
 */
export interface AIPromptTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description?: string;
  /** 模板内容 */
  template: string;
  /** 模板变量 */
  variables?: Array<{
    name: string;
    description?: string;
    required?: boolean;
    defaultValue?: string;
    type?: 'string' | 'number' | 'boolean' | 'select';
    options?: string[]; // for select type
  }>;
  /** 适用的功能 */
  applicableFeatures?: string[];
  /** 推荐的模型类型 */
  recommendedModelTypes?: ProviderType[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 是否为系统模板 */
  isSystem?: boolean;
  /** 使用次数 */
  usageCount?: number;
}

/**
 * AI会话历史
 */
export interface AIConversationHistory {
  /** 会话ID */
  id: string;
  /** 会话标题 */
  title?: string;
  /** 提供商ID */
  providerId: string;
  /** 模型ID */
  modelId: string;
  /** 消息列表 */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: {
      tokenCount?: number;
      responseTime?: number;
      temperature?: number;
    };
  }>;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 会话标签 */
  tags?: string[];
  /** 是否收藏 */
  starred?: boolean;
}

/**
 * AI功能使用上下文
 */
export interface AIContext {
  /** 当前书籍 */
  book?: Book;
  /** 当前章节 */
  chapter?: Chapter;
  /** 世界设定 */
  worldSettings?: WorldSetting[];
  /** 角色设定 */
  characters?: Character[];
  /** 用户角色设定 */
  userRole?: string;
  /** 额外上下文 */
  extraContext?: Record<string, any>;
}

/**
 * AI生成请求
 */
export interface AIGenerateRequest {
  /** 提示词 */
  prompt: string;
  /** 提供商ID */
  providerId: string;
  /** 模型ID */
  modelId: string;
  /** 生成选项 */
  options?: UnifiedAIOptions;
  /** 上下文信息 */
  context?: AIContext;
  /** 是否流式生成 */
  stream?: boolean;
  /** 请求ID（用于追踪） */
  requestId?: string;
}

/**
 * AI生成响应
 */
export interface AIGenerateResponse {
  /** 生成的内容 */
  content: string;
  /** 请求ID */
  requestId?: string;
  /** 使用的提供商ID */
  providerId: string;
  /** 使用的模型ID */
  modelId: string;
  /** 生成统计 */
  stats?: {
    inputTokens?: number;
    outputTokens?: number;
    responseTime: number;
    finishReason?: string;
  };
  /** 错误信息（如果有） */
  error?: AIErrorInfo;
}

/**
 * 豆包图片生成所需配置
 */
export interface DoubaoConfig {
  COOKIE: string;
  X_MS_TOKEN: string;
  DEVICE_ID: string;
  TEA_UUID: string;
  WEB_ID: string;
  MS_TOKEN: string;
  A_BOGUS: string;
  ROOM_ID: string;
}
