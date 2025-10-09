/**
 * @fileOverview 基础验证脚本
 * 用于快速验证核心功能是否正常工作
 */

import { AIConfigManager } from '../config-manager';
import { UnifiedAIClient } from '../unified-client';
import { GeminiProvider } from '../providers/gemini';
import { OpenAICompatibleProvider } from '../providers/openai-compatible';

/**
 * 基础验证函数
 */
export async function runBasicValidation(): Promise<{
  success: boolean;
  results: Array<{
    test: string;
    passed: boolean;
    error?: string;
  }>;
}> {
  const results: Array<{
    test: string;
    passed: boolean;
    error?: string;
  }> = [];

  // 测试1: 配置管理器基本功能
  try {
    // 清除现有配置
    AIConfigManager.clearAll();
    
    // 添加测试提供商
    const provider = AIConfigManager.addProvider({
      id: 'test-validation',
      name: 'test-validation',
      displayName: 'Test Validation Provider',
      type: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key-123',
      enabled: true,
    });

    // 验证添加成功
    const retrieved = AIConfigManager.getProvider('test-validation');
    if (!retrieved || retrieved.id !== 'test-validation') {
      throw new Error('Provider not found after adding');
    }

    results.push({ test: 'Config Manager - Add/Get Provider', passed: true });
  } catch (error: any) {
    results.push({ 
      test: 'Config Manager - Add/Get Provider', 
      passed: false, 
      error: error.message 
    });
  }

  // 测试2: 提供商类创建
  try {
    const geminiProvider = GeminiProvider.create({
      id: 'gemini-test',
      name: 'gemini-test',
      displayName: 'Gemini Test',
      apiKey: 'test-key',
    });

    if (geminiProvider.type !== 'gemini' || geminiProvider.id !== 'gemini-test') {
      throw new Error('Gemini provider creation failed');
    }

    const openaiProvider = OpenAICompatibleProvider.createOpenAI({
      id: 'openai-test',
      apiKey: 'test-key',
    });

    if (openaiProvider.type !== 'openai' || openaiProvider.id !== 'openai-test') {
      throw new Error('OpenAI provider creation failed');
    }

    results.push({ test: 'Provider Classes - Creation', passed: true });
  } catch (error: any) {
    results.push({ 
      test: 'Provider Classes - Creation', 
      passed: false, 
      error: error.message 
    });
  }

  // 测试3: 统一客户端基本功能
  try {
    const client = new UnifiedAIClient({ autoLoadConfig: false });
    
    // 添加测试提供商
    const testProvider = GeminiProvider.create({
      id: 'client-test',
      name: 'client-test',
      displayName: 'Client Test',
      apiKey: 'test-key',
    });
    
    client.addProvider(testProvider);

    // 验证提供商添加成功
    const provider = client.getProvider('client-test');
    if (!provider || provider.id !== 'client-test') {
      throw new Error('Provider not added to client');
    }

    // 验证列表功能
    const providers = client.listProviders();
    if (providers.length !== 1) {
      throw new Error('Provider list incorrect');
    }

    client.destroy();
    results.push({ test: 'Unified Client - Basic Operations', passed: true });
  } catch (error: any) {
    results.push({ 
      test: 'Unified Client - Basic Operations', 
      passed: false, 
      error: error.message 
    });
  }

  // 测试4: 配置验证
  try {
    const validConfig = {
      id: 'valid-test',
      name: 'valid-test',
      displayName: 'Valid Test',
      type: 'openai' as const,
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const validation = AIConfigManager.validateProvider(validConfig);
    if (!validation.valid) {
      throw new Error(`Valid config failed validation: ${validation.errors.join(', ')}`);
    }

    const invalidConfig = {
      ...validConfig,
      id: '', // Invalid empty ID
      apiKey: '', // Invalid empty API key
    };

    const invalidValidation = AIConfigManager.validateProvider(invalidConfig);
    if (invalidValidation.valid) {
      throw new Error('Invalid config passed validation');
    }

    results.push({ test: 'Config Validation', passed: true });
  } catch (error: any) {
    results.push({ 
      test: 'Config Validation', 
      passed: false, 
      error: error.message 
    });
  }

  // 测试5: 导入导出功能
  try {
    // 清除配置
    AIConfigManager.clearAll();
    
    // 添加测试配置
    AIConfigManager.addProvider({
      id: 'export-test',
      name: 'export-test',
      displayName: 'Export Test',
      type: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      enabled: true,
    });

    // 导出配置
    const exported = AIConfigManager.exportConfig();
    const config = JSON.parse(exported);
    
    if (!config.version || !config.providers || config.providers.length !== 1) {
      throw new Error('Export format incorrect');
    }

    // 清除配置
    AIConfigManager.clearAll();
    
    // 导入配置
    const importResult = AIConfigManager.importConfig(exported);
    if (!importResult.success || importResult.imported !== 1) {
      throw new Error('Import failed');
    }

    // 验证导入结果
    const providers = AIConfigManager.getProviders();
    if (providers.length !== 1 || providers[0].id !== 'export-test') {
      throw new Error('Import verification failed');
    }

    results.push({ test: 'Import/Export', passed: true });
  } catch (error: any) {
    results.push({ 
      test: 'Import/Export', 
      passed: false, 
      error: error.message 
    });
  }

  // 计算总体结果
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  const success = passedTests === totalTests;

  return {
    success,
    results,
  };
}

/**
 * 打印验证结果
 */
export function printValidationResults(results: {
  success: boolean;
  results: Array<{
    test: string;
    passed: boolean;
    error?: string;
  }>;
}): void {
  console.log('\n=== AI 核心功能验证结果 ===\n');
  
  results.results.forEach((result, index) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.test}: ${status}`);
    if (!result.passed && result.error) {
      console.log(`   错误: ${result.error}`);
    }
  });

  const passedTests = results.results.filter(r => r.passed).length;
  const totalTests = results.results.length;
  
  console.log(`\n总结: ${passedTests}/${totalTests} 测试通过`);
  
  if (results.success) {
    console.log('🎉 所有核心功能验证通过！');
  } else {
    console.log('⚠️  部分功能验证失败，请检查错误信息。');
  }
  
  console.log('\n=== 验证完成 ===\n');
}

/**
 * 运行验证并打印结果
 */
export async function validateAndPrint(): Promise<boolean> {
  try {
    const results = await runBasicValidation();
    printValidationResults(results);
    return results.success;
  } catch (error: any) {
    console.error('验证过程中发生错误:', error.message);
    return false;
  }
}

// 如果直接运行此文件，执行验证
if (require.main === module) {
  validateAndPrint().then(success => {
    process.exit(success ? 0 : 1);
  });
}