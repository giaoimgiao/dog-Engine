/**
 * 高级设置功能测试
 */

import { AIConfigManager } from '../config-manager';
import { GeminiProvider } from '../providers/gemini';
import { OpenAICompatibleProvider } from '../providers/openai-compatible';
import type { AIProviderConfig, AdvancedGenerationConfig } from '../providers/base';

describe('高级设置功能测试', () => {
  beforeEach(() => {
    // 清理测试环境
    AIConfigManager.clearAll();
  });

  describe('基础类型定义', () => {
    test('AdvancedGenerationConfig 接口应该包含所有必要字段', () => {
      const config: AdvancedGenerationConfig = {
        defaultTemperature: 0.7,
        defaultTopP: 0.9,
        defaultTopK: 40,
        enableDynamicThinking: true,
        thinkingBudget: -1,
      };

      expect(config.defaultTemperature).toBe(0.7);
      expect(config.defaultTopP).toBe(0.9);
      expect(config.defaultTopK).toBe(40);
      expect(config.enableDynamicThinking).toBe(true);
      expect(config.thinkingBudget).toBe(-1);
    });
  });

  describe('AI配置管理器验证', () => {
    test('应该正确验证高级配置参数', () => {
      const validConfig: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'> = {
        id: 'test-gemini',
        name: 'test-gemini',
        displayName: 'Test Gemini',
        type: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        enabled: true,
        advancedConfig: {
          defaultTemperature: 0.7,
          defaultTopP: 0.9,
          defaultTopK: 40,
          enableDynamicThinking: true,
          thinkingBudget: -1,
        },
      };

      const validation = AIConfigManager.validateProvider(validConfig as AIProviderConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('应该拒绝无效的温度值', () => {
      const invalidConfig: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'> = {
        id: 'test-gemini',
        name: 'test-gemini',
        displayName: 'Test Gemini',
        type: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        enabled: true,
        advancedConfig: {
          defaultTemperature: 1.5, // 无效值
        },
      };

      const validation = AIConfigManager.validateProvider(invalidConfig as AIProviderConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('默认温度必须在0-1之间');
    });

    test('应该拒绝无效的思考预算值', () => {
      const invalidConfig: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'> = {
        id: 'test-gemini',
        name: 'test-gemini',
        displayName: 'Test Gemini',
        type: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        enabled: true,
        advancedConfig: {
          thinkingBudget: -2, // 无效值
        },
      };

      const validation = AIConfigManager.validateProvider(invalidConfig as AIProviderConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('思考预算必须是-1（动态）、0（禁用）或正整数');
    });
  });

  describe('Gemini提供商高级配置', () => {
    test('应该正确合并高级配置和选项参数', () => {
      const advancedConfig: AdvancedGenerationConfig = {
        defaultTemperature: 0.8,
        defaultTopP: 0.95,
        defaultTopK: 50,
        enableDynamicThinking: true,
        thinkingBudget: -1,
      };

      const provider = new GeminiProvider(
        'test-gemini',
        'test-gemini',
        'Test Gemini',
        'https://generativelanguage.googleapis.com/v1beta',
        'test-key',
        true,
        'gemini-2.5-flash',
        undefined,
        advancedConfig
      );

      // 测试私有方法需要通过类型断言
      const mergedOptions = (provider as any).mergeGenerationOptions({
        temperature: 0.5, // 应该覆盖默认值
      });

      expect(mergedOptions.temperature).toBe(0.5);
      expect(mergedOptions.topP).toBe(0.95); // 使用默认值
      expect(mergedOptions.topK).toBe(50); // 使用默认值
      expect(mergedOptions.thinkingBudget).toBe(-1); // 动态思考
    });

    test('应该正确检测Gemini 2.5系列模型', () => {
      const provider = new GeminiProvider(
        'test-gemini',
        'test-gemini',
        'Test Gemini',
        'https://generativelanguage.googleapis.com/v1beta',
        'test-key'
      );

      expect((provider as any).supportsThinking('gemini-2.5-flash')).toBe(true);
      expect((provider as any).supportsThinking('gemini-2.5-pro')).toBe(true);
      expect((provider as any).supportsThinking('gemini-1.5-flash')).toBe(false);
    });
  });

  describe('OpenAI兼容提供商高级配置', () => {
    test('应该正确合并高级配置参数', () => {
      const advancedConfig: AdvancedGenerationConfig = {
        defaultTemperature: 0.6,
        defaultTopP: 0.8,
        defaultTopK: 30,
      };

      const provider = new OpenAICompatibleProvider(
        'test-openai',
        'test-openai',
        'Test OpenAI',
        'https://api.openai.com/v1',
        'test-key',
        true,
        'gpt-3.5-turbo',
        undefined,
        advancedConfig
      );

      const mergedOptions = (provider as any).mergeGenerationOptions({
        maxOutputTokens: 1000,
      });

      expect(mergedOptions.temperature).toBe(0.6);
      expect(mergedOptions.topP).toBe(0.8);
      expect(mergedOptions.maxOutputTokens).toBe(1000);
    });
  });

  describe('配置存储和加载', () => {
    test('应该正确保存和加载高级配置', () => {
      const config: Omit<AIProviderConfig, 'createdAt' | 'updatedAt'> = {
        id: 'test-provider',
        name: 'test-provider',
        displayName: 'Test Provider',
        type: 'gemini',
        apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'test-key',
        enabled: true,
        advancedConfig: {
          defaultTemperature: 0.7,
          enableDynamicThinking: true,
          thinkingBudget: -1,
        },
      };

      // 添加配置
      const savedConfig = AIConfigManager.addProvider(config);
      expect(savedConfig.advancedConfig).toBeDefined();
      expect(savedConfig.advancedConfig?.defaultTemperature).toBe(0.7);
      expect(savedConfig.advancedConfig?.enableDynamicThinking).toBe(true);

      // 加载配置
      const loadedConfig = AIConfigManager.getProvider('test-provider');
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig?.advancedConfig?.defaultTemperature).toBe(0.7);
      expect(loadedConfig?.advancedConfig?.enableDynamicThinking).toBe(true);
    });
  });
});