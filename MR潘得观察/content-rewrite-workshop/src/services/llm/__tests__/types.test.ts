import { describe, it, expect } from 'vitest';
import {
  PROVIDER_LIST,
  DEFAULT_VARIABLES,
  type ProviderConfig,
  type FailoverConfig,
  type PlatformTemplate,
  type TemplateVariable,
} from '../types';

describe('LLM Types', () => {
  describe('PROVIDER_LIST', () => {
    it('应该包含所有预设供应商', () => {
      const providerIds = PROVIDER_LIST.map((p) => p.id);
      expect(providerIds).toContain('openai');
      expect(providerIds).toContain('anthropic');
      expect(providerIds).toContain('kimi');
      expect(providerIds).toContain('deepseek');
      expect(providerIds).toContain('minimax');
      expect(providerIds).toContain('glm');
      expect(providerIds).toContain('doubao');
      expect(providerIds).toContain('qwen');
      expect(providerIds).toContain('custom');
    });

    it('每个供应商应该有必要的字段', () => {
      PROVIDER_LIST.forEach((provider) => {
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.provider).toBeDefined();
        expect(provider.defaultModel).toBeDefined();
        expect(provider.baseUrl).toBeDefined();
        expect(provider.website).toBeDefined();
      });
    });

    it('custom 供应商应该有空的 defaultModel 和 baseUrl', () => {
      const customProvider = PROVIDER_LIST.find((p) => p.id === 'custom');
      expect(customProvider?.defaultModel).toBe('');
      expect(customProvider?.baseUrl).toBe('');
    });
  });

  describe('DEFAULT_VARIABLES', () => {
    it('应该包含必要的默认变量', () => {
      const variableNames = DEFAULT_VARIABLES.map((v) => v.name);
      expect(variableNames).toContain('{title}');
      expect(variableNames).toContain('{content}');
      expect(variableNames).toContain('{keywords}');
      expect(variableNames).toContain('{emotion}');
      expect(variableNames).toContain('{audience}');
      expect(variableNames).toContain('{category}');
      expect(variableNames).toContain('{style}');
    });

    it('每个变量应该有描述和示例', () => {
      DEFAULT_VARIABLES.forEach((variable) => {
        expect(variable.name).toBeDefined();
        expect(variable.description).toBeDefined();
        expect(variable.example).toBeDefined();
      });
    });
  });

  describe('ProviderConfig', () => {
    it('应该能创建有效的供应商配置', () => {
      const config: ProviderConfig = {
        id: 'test-provider',
        name: '测试供应商',
        provider: 'openai',
        apiKey: 'sk-test123',
        model: 'gpt-4o',
        temperature: 0.7,
        isEnabled: true,
        isPrimary: true,
      };

      expect(config.id).toBe('test-provider');
      expect(config.provider).toBe('openai');
      expect(config.isPrimary).toBe(true);
    });

    it('应该支持自定义 baseUrl', () => {
      const config: ProviderConfig = {
        id: 'custom-provider',
        name: '自定义中转站',
        provider: 'custom',
        apiKey: 'sk-test',
        baseUrl: 'https://api.example.com/v1',
        model: 'gpt-4o',
        temperature: 0.7,
        isEnabled: true,
        isPrimary: false,
      };

      expect(config.baseUrl).toBe('https://api.example.com/v1');
      expect(config.provider).toBe('custom');
    });
  });

  describe('FailoverConfig', () => {
    it('应该有默认的故障转移配置', () => {
      const config: FailoverConfig = {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
      };

      expect(config.enabled).toBe(true);
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(1000);
    });

    it('应该支持禁用故障转移', () => {
      const config: FailoverConfig = {
        enabled: false,
        maxRetries: 0,
        retryDelay: 0,
      };

      expect(config.enabled).toBe(false);
    });
  });

  describe('TemplateVariable', () => {
    it('应该能创建有效的模板变量', () => {
      const variable: TemplateVariable = {
        name: '{custom_var}',
        description: '自定义变量',
        example: '示例内容',
      };

      expect(variable.name).toBe('{custom_var}');
      expect(variable.description).toBe('自定义变量');
    });
  });

  describe('PlatformTemplate', () => {
    it('应该能创建有效的平台模板', () => {
      const template: PlatformTemplate = {
        id: 'test-platform',
        name: '测试平台',
        icon: '📝',
        isBuiltIn: false,
        isDefault: true,
        titlePrompt: '生成一个{style}风格的标题',
        titleVariables: DEFAULT_VARIABLES.slice(0, 3),
        contentPrompt: '生成{style}风格的内容',
        contentVariables: DEFAULT_VARIABLES.slice(0, 4),
        qualityPrompt: '评估内容质量',
        qualityCriteria: ['标题吸引力', '内容价值'],
      };

      expect(template.id).toBe('test-platform');
      expect(template.isBuiltIn).toBe(false);
      expect(template.isDefault).toBe(true);
      expect(template.titleVariables.length).toBe(3);
      expect(template.contentVariables.length).toBe(4);
      expect(template.qualityCriteria.length).toBe(2);
    });
  });
});
