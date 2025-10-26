
/**
 * @fileOverview 统一AI客户端单元测试
 * 验证核心功能的正确性和稳定性
 */

import { UnifiedAIClient } from '../unified-client';
import { AIConfigManager } from '../config-manager';
import { GeminiProvider } from '../providers/gemini';
import { OpenAICompatibleProvider } from '../providers/openai-compatible';
import {
  AIProvider,
  AIModel,
  GenerateOptions,
  ConnectionTestResult,
  AIProviderError,
} from '../providers/base';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch
global.fetch = jest.fn();

// Mock provider for testing
class MockProvider implements AIProvider {
  public readonly type = 'custom' as const;

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

  async generateContent(
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): Promise<string> {
    if (modelId === 'error-model') {
      throw new AIProviderError('Test error', 'TEST_ERROR', this.id);
    }
    return `Generated content for: ${prompt}`;
  }

  async* generateContentStream(
    modelId: string,
    prompt: string,
    options?: GenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    const content = await this.generateContent(modelId, prompt, options);
    const chunks = content.split(' ');
    for (const chunk of chunks) {
      yield chunk + ' ';
    }
  }

  async listModels(): Promise<AIModel[]> {
    return [
      {
        id: 'test-model',
        name: 'test-model',
        displayName: 'Test Model',
        description: 'A test model',
        maxTokens: 4096,
        supportStreaming: true,
        supportSystemInstruction: true,
      },
      {
        id: 'error-model',
        name: 'error-model',
        displayName: 'Error Model',
        description: 'A model that throws errors',
        maxTokens: 4096,
        supportStreaming: false,
        supportSystemInstruction: false,
      },
    ];
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return {
      valid: this.apiKey === 'valid-key',
      error: this.apiKey === 'valid-key' ? undefined : 'Invalid API key',
      responseTime: 100,
    };
  }

  async isValidModel(modelId: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some(m => m.id === modelId);
  }

  async getModelInfo(modelId: string): Promise<AIModel | null> {
    const models = await this.listModels();
    return models.find(m => m.id === modelId) || null;
  }
}

describe('UnifiedAIClient', () => {
  let client: UnifiedAIClient;
  let mockProvider: MockProvider;

  beforeEach(() => {
    // Clear localStorage
    mockLocalStorage.clear();
    
    // Create client without auto-loading config
    client = new UnifiedAIClient({ autoLoadConfig: false, debug: true });
    
    // Create mock provider
    mockProvider = new MockProvider(
      'test-provider',
      'test-provider',
      'Test Provider',
      'https://api.test.com',
      'valid-key',
      true,
      'test-model'
    );
    
    // Add mock provider to client
    client.addProvider(mockProvider);
  });

  afterEach(() => {
    client.destroy();
  });

  describe('Provider Management', () => {
    test('should add and retrieve providers', () => {
      const provider = client.getProvider('test-provider');
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('test-provider');
      expect(provider?.displayName).toBe('Test Provider');
    });

    test('should list all providers', () => {
      const providers = client.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('test-provider');
    });

    test('should list enabled providers only', () => {
      // Add disabled provider
      const disabledProvider = new MockProvider(
        'disabled-provider',
        'disabled-provider',
        'Disabled Provider',
        'https://api.disabled.com',
        'key',
        false
      );
      client.addProvider(disabledProvider);

      const enabledProviders = client.getEnabledProviders();
      expect(enabledProviders).toHaveLength(1);
      expect(enabledProviders[0].id).toBe('test-provider');
    });

    test('should remove providers', () => {
      client.removeProvider('test-provider');
      const provider = client.getProvider('test-provider');
      expect(provider).toBeUndefined();
    });
  });

  describe('Content Generation', () => {
    test('should generate content successfully', async () => {
      const result = await client.generateContent(
        'test-provider',
        'test-model',
        'Hello world'
      );
      
      expect(result).toBe('Generated content for: Hello world');
    });

    test('should handle generation errors', async () => {
      await expect(
        client.generateContent('test-provider', 'error-model', 'Hello world')
      ).rejects.toThrow('Test error');
    });

    test('should throw error for non-existent provider', async () => {
      await expect(
        client.generateContent('non-existent', 'test-model', 'Hello world')
      ).rejects.toThrow("Provider 'non-existent' not found");
    });

    test('should throw error for disabled provider', async () => {
      // Add disabled provider
      const disabledProvider = new MockProvider(
        'disabled-provider',
        'disabled-provider',
        'Disabled Provider',
        'https://api.disabled.com',
        'key',
        false
      );
      client.addProvider(disabledProvider);

      await expect(
        client.generateContent('disabled-provider', 'test-model', 'Hello world')
      ).rejects.toThrow("Provider 'disabled-provider' is disabled");
    });
  });

  describe('Stream Generation', () => {
    test('should generate content stream successfully', async () => {
      const chunks: string[] = [];
      const stream = client.generateContentStream(
        'test-provider',
        'test-model',
        'Hello world'
      );

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('Generated content for: Hello world');
    });
  });

  describe('Model Management', () => {
    test('should list models for provider', async () => {
      const models = await client.listModels('test-provider');
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('test-model');
      expect(models[1].id).toBe('error-model');
    });

    test('should list all models from all providers', async () => {
      const allModels = await client.listAllModels();
      expect(allModels).toHaveLength(1);
      expect(allModels[0].providerId).toBe('test-provider');
      expect(allModels[0].models).toHaveLength(2);
    });

    test('should validate model existence', async () => {
      const isValid = await client.isValidModel('test-provider', 'test-model');
      expect(isValid).toBe(true);

      const isInvalid = await client.isValidModel('test-provider', 'non-existent-model');
      expect(isInvalid).toBe(false);
    });

    test('should get model info', async () => {
      const modelInfo = await client.getModelInfo('test-provider', 'test-model');
      expect(modelInfo).toBeDefined();
      expect(modelInfo?.id).toBe('test-model');
      expect(modelInfo?.displayName).toBe('Test Model');

      const nonExistentModel = await client.getModelInfo('test-provider', 'non-existent');
      expect(nonExistentModel).toBeNull();
    });
  });

  describe('Connection Testing', () => {
    test('should test provider connection', async () => {
      const result = await client.testConnection('test-provider');
      expect(result.valid).toBe(true);
      expect(result.responseTime).toBe(100);
    });

    test('should test all connections', async () => {
      const results = await client.testAllConnections();
      expect(results).toHaveLength(1);
      expect(results[0].providerId).toBe('test-provider');
      expect(results[0].result.valid).toBe(true);
    });
  });

  describe('Auto Provider Selection', () => {
    test('should select best provider', async () => {
      const selection = await client.selectBestProvider();
      expect(selection).toBeDefined();
      expect(selection?.providerId).toBe('test-provider');
      expect(selection?.modelId).toBe('test-model');
    });

    test('should return null when no providers available', async () => {
      const emptyClient = new UnifiedAIClient({ autoLoadConfig: false });
      const selection = await emptyClient.selectBestProvider();
      expect(selection).toBeNull();
      emptyClient.destroy();
    });
  });

  describe('Statistics', () => {
    test('should track generation statistics', async () => {
      await client.generateContent('test-provider', 'test-model', 'Hello world');
      
      const stats = client.getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].providerId).toBe('test-provider');
      expect(stats[0].modelId).toBe('test-model');
      expect(stats[0].success).toBe(true);
    });

    test('should track failed generation statistics', async () => {
      try {
        await client.generateContent('test-provider', 'error-model', 'Hello world');
      } catch {
        // Expected error
      }
      
      const stats = client.getStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].success).toBe(false);
      expect(stats[0].error).toBe('Test error');
    });

    test('should generate statistics summary', async () => {
      // Generate some successful requests
      await client.generateContent('test-provider', 'test-model', 'Hello 1');
      await client.generateContent('test-provider', 'test-model', 'Hello 2');
      
      // Generate a failed request
      try {
        await client.generateContent('test-provider', 'error-model', 'Hello 3');
      } catch {
        // Expected error
      }

      const summary = client.getStatsSummary();
      expect(summary.totalRequests).toBe(3);
      expect(summary.successfulRequests).toBe(2);
      expect(summary.failedRequests).toBe(1);
      expect(summary.providerUsage['test-provider']).toBe(3);
    });

    test('should clear statistics', () => {
      client.clearStats();
      const stats = client.getStats();
      expect(stats).toHaveLength(0);
    });
  });
});

describe('AIConfigManager', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe('Provider Configuration', () => {
    test('should save and load providers', () => {
      const providers = [
        {
          id: 'test-provider',
          name: 'test-provider',
          displayName: 'Test Provider',
          type: 'custom' as const,
          apiUrl: 'https://api.test.com',
          apiKey: 'test-key',
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      AIConfigManager.saveProviders(providers);
      const loaded = AIConfigManager.getProviders();
      
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('test-provider');
      expect(loaded[0].displayName).toBe('Test Provider');
    });

    test('should add new provider', () => {
      const provider = AIConfigManager.addProvider({
        id: 'new-provider',
        name: 'new-provider',
        displayName: 'New Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
      });

      expect(provider.id).toBe('new-provider');
      expect(provider.createdAt).toBeDefined();
      expect(provider.updatedAt).toBeDefined();

      const providers = AIConfigManager.getProviders();
      expect(providers).toHaveLength(1);
    });

    test('should update existing provider', () => {
      // Add a provider first
      AIConfigManager.addProvider({
        id: 'test-provider',
        name: 'test-provider',
        displayName: 'Test Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
      });

      // Update it
      const updated = AIConfigManager.updateProvider('test-provider', {
        displayName: 'Updated Provider',
        enabled: false,
      });

      expect(updated.displayName).toBe('Updated Provider');
      expect(updated.enabled).toBe(false);
      expect(updated.id).toBe('test-provider'); // ID should not change
    });

    test('should remove provider', () => {
      // Add a provider first
      AIConfigManager.addProvider({
        id: 'test-provider',
        name: 'test-provider',
        displayName: 'Test Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
      });

      AIConfigManager.removeProvider('test-provider');
      const providers = AIConfigManager.getProviders();
      expect(providers).toHaveLength(0);
    });

    test('should get enabled providers only', () => {
      AIConfigManager.addProvider({
        id: 'enabled-provider',
        name: 'enabled-provider',
        displayName: 'Enabled Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
      });

      AIConfigManager.addProvider({
        id: 'disabled-provider',
        name: 'disabled-provider',
        displayName: 'Disabled Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: false,
      });

      const enabledProviders = AIConfigManager.getEnabledProviders();
      expect(enabledProviders).toHaveLength(1);
      expect(enabledProviders[0].id).toBe('enabled-provider');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid provider config', () => {
      const config = {
        id: 'test-provider',
        name: 'test-provider',
        displayName: 'Test Provider',
        type: 'openai' as const,
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validation = AIConfigManager.validateProvider(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid provider config', () => {
      const config = {
        id: '',
        name: '',
        displayName: '',
        type: 'invalid' as any,
        apiUrl: 'invalid-url',
        apiKey: '',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validation = AIConfigManager.validateProvider(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Import/Export', () => {
    test('should export configuration', () => {
      AIConfigManager.addProvider({
        id: 'test-provider',
        name: 'test-provider',
        displayName: 'Test Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
      });

      const exported = AIConfigManager.exportConfig();
      const config = JSON.parse(exported);
      
      expect(config.version).toBeDefined();
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].id).toBe('test-provider');
    });

    test('should import configuration', () => {
      const config = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        providers: [
          {
            id: 'imported-provider',
            name: 'imported-provider',
            displayName: 'Imported Provider',
            type: 'openai',
            apiUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        models: [],
      };

      const result = AIConfigManager.importConfig(JSON.stringify(config));
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);

      const providers = AIConfigManager.getProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('imported-provider');
    });
  });

  describe('Health Check', () => {
    test('should check configuration health', () => {
      // Add a valid provider
      AIConfigManager.addProvider({
        id: 'valid-provider',
        name: 'valid-provider',
        displayName: 'Valid Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        enabled: true,
      });

      const health = AIConfigManager.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });

    test('should detect health issues', () => {
      // Add an invalid provider
      AIConfigManager.addProvider({
        id: 'invalid-provider',
        name: 'invalid-provider',
        displayName: 'Invalid Provider',
        type: 'openai',
        apiUrl: 'https://api.openai.com/v1',
        apiKey: '', // Empty API key
        enabled: true,
      });

      const health = AIConfigManager.checkHealth();
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
    });
  });
});

describe('Provider Classes', () => {
  describe('GeminiProvider', () => {
    test('should create Gemini provider', () => {
      const provider = GeminiProvider.create({
        id: 'gemini-test',
        name: 'gemini-test',
        displayName: 'Gemini Test',
        apiKey: 'test-key',
      });

      expect(provider.id).toBe('gemini-test');
      expect(provider.type).toBe('gemini');
      expect(provider.displayName).toBe('Gemini Test');
      expect(provider.enabled).toBe(true);
    });

    test('should create from legacy config', () => {
      const provider = GeminiProvider.fromLegacyConfig('legacy-key');
      
      expect(provider.id).toBe('gemini-legacy');
      expect(provider.type).toBe('gemini');
      expect(provider.apiKey).toBe('legacy-key');
    });
  });

  describe('OpenAICompatibleProvider', () => {
    test('should create OpenAI provider', () => {
      const provider = OpenAICompatibleProvider.createOpenAI({
        id: 'openai-test',
        apiKey: 'test-key',
      });

      expect(provider.id).toBe('openai-test');
      expect(provider.type).toBe('openai');
      expect(provider.name).toBe('openai');
      expect(provider.apiUrl).toBe('https://api.openai.com/v1');
    });

    test('should create Claude provider', () => {
      const provider = OpenAICompatibleProvider.createClaude({
        id: 'claude-test',
        apiKey: 'test-key',
      });

      expect(provider.id).toBe('claude-test');
      expect(provider.type).toBe('openai');
      expect(provider.name).toBe('claude');
      expect(provider.apiUrl).toBe('https://api.anthropic.com/v1');
    });

    test('should create custom provider', () => {
      const provider = OpenAICompatibleProvider.create({
        id: 'custom-test',
        name: 'custom-test',
        displayName: 'Custom Test',
        apiUrl: 'https://api.custom.com/v1',
        apiKey: 'test-key',
      });

      expect(provider.id).toBe('custom-test');
      expect(provider.type).toBe('openai');
      expect(provider.apiUrl).toBe('https://api.custom.com/v1');
    });
  });
});

describe('Integration Tests', () => {
  test('should work end-to-end with config manager and client', () => {
    // Clear any existing config
    mockLocalStorage.clear();

    // Add provider via config manager
    AIConfigManager.addProvider({
      id: 'integration-test',
      name: 'integration-test',
      displayName: 'Integration Test',
      type: 'custom',
      apiUrl: 'https://api.test.com',
      apiKey: 'test-key',
      enabled: true,
    });

    // Create client with auto-load
    const client = new UnifiedAIClient({ autoLoadConfig: true, debug: false });

    // Verify provider was loaded
    const provider = client.getProvider('integration-test');
    expect(provider).toBeDefined();
    expect(provider?.displayName).toBe('Integration Test');

    // Clean up
    client.destroy();
  });

  test('should handle config changes dynamically', (done) => {
    // Clear any existing config
    mockLocalStorage.clear();

    // Create client with auto-load
    const client = new UnifiedAIClient({ autoLoadConfig: true, debug: false });

    // Listen for config changes
    const unsubscribe = AIConfigManager.onConfigChange((event) => {
      if (event.detail.type === 'providers') {
        // Verify provider was added to client
        setTimeout(() => {
          const provider = client.getProvider('dynamic-test');
          expect(provider).toBeDefined();
          
          // Clean up
          client.destroy();
          unsubscribe();
          done();
        }, 100);
      }
    });

    // Add provider via config manager (should trigger reload)
    AIConfigManager.addProvider({
      id: 'dynamic-test',
      name: 'dynamic-test',
      displayName: 'Dynamic Test',
      type: 'custom',
      apiUrl: 'https://api.test.com',
      apiKey: 'test-key',
      enabled: true,
    });
  });
});