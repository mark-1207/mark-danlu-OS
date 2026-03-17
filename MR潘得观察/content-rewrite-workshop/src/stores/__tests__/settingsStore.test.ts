import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { useSettingsStore } from '../settingsStore';
import { DEFAULT_VARIABLES } from '../../services/llm/types';

describe('SettingsStore', () => {
  beforeEach(() => {
    // 每个测试前清除 Zustand persist 存储
    localStorage.removeItem('refine-settings');
    // 使用正确的初始值重置
    useSettingsStore.setState({
      ai: {
        providers: [],
        failover: {
          enabled: true,
          maxRetries: 3,
          retryDelay: 1000,
        },
      },
      platforms: {
        templates: [
          {
            id: 'gzh',
            name: '公众号',
            icon: '📺',
            isBuiltIn: true,
            isDefault: false,
            titlePrompt: '公众号标题模板',
            titleVariables: DEFAULT_VARIABLES,
            contentPrompt: '公众号内容模板',
            contentVariables: DEFAULT_VARIABLES,
            qualityPrompt: '公众号质检模板',
            qualityCriteria: ['标题吸引力', '内容价值'],
          },
          {
            id: 'xhs',
            name: '小红书',
            icon: '📕',
            isBuiltIn: true,
            isDefault: false,
            titlePrompt: '小红书标题模板',
            titleVariables: DEFAULT_VARIABLES,
            contentPrompt: '小红书内容模板',
            contentVariables: DEFAULT_VARIABLES,
            qualityPrompt: '小红书质检模板',
            qualityCriteria: ['标题吸引力', '情感浓度'],
          },
          {
            id: 'douyin',
            name: '抖音',
            icon: '🎵',
            isBuiltIn: true,
            isDefault: false,
            titlePrompt: '抖音标题模板',
            titleVariables: DEFAULT_VARIABLES,
            contentPrompt: '抖音内容模板',
            contentVariables: DEFAULT_VARIABLES,
            qualityPrompt: '抖音质检模板',
            qualityCriteria: ['完播率', '互动率'],
          },
        ],
        defaultPlatform: 'gzh',
      },
    });
  });

  describe('初始状态', () => {
    it('应该有默认的 AI 设置', () => {
      const { ai } = useSettingsStore.getState();
      expect(ai.providers).toEqual([]);
      expect(ai.failover.enabled).toBe(true);
      expect(ai.failover.maxRetries).toBe(3);
      expect(ai.failover.retryDelay).toBe(1000);
    });

    it('应该有默认的平台模板', () => {
      const { platforms } = useSettingsStore.getState();
      expect(platforms.templates.length).toBe(3);
      expect(platforms.defaultPlatform).toBe('gzh');
    });

    it('应该包含内置平台（公众号、小红书、抖音）', () => {
      const { platforms } = useSettingsStore.getState();
      const ids = platforms.templates.map((t) => t.id);
      expect(ids).toContain('gzh');
      expect(ids).toContain('xhs');
      expect(ids).toContain('douyin');
    });

    it('内置平台应该有完整的模板内容', () => {
      const { platforms } = useSettingsStore.getState();
      const gzh = platforms.templates.find((t) => t.id === 'gzh');
      expect(gzh).toBeDefined();
      expect(gzh?.titlePrompt).toBeDefined();
      expect(gzh?.contentPrompt).toBeDefined();
      expect(gzh?.qualityPrompt).toBeDefined();
      expect(gzh?.titleVariables.length).toBeGreaterThan(0);
      expect(gzh?.qualityCriteria.length).toBeGreaterThan(0);
    });
  });

  describe('AI 供应商操作', () => {
    it('应该能添加供应商', () => {
      const { addProvider } = useSettingsStore.getState();

      act(() => {
        addProvider({
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-test123',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        });
      });

      const { ai } = useSettingsStore.getState();
      expect(ai.providers.length).toBe(1);
      expect(ai.providers[0].name).toBe('OpenAI');
      expect(ai.providers[0].id).toBeDefined();
    });

    it('添加的第一个供应商应该自动设为主供应商', () => {
      const { addProvider } = useSettingsStore.getState();

      // 不传 isPrimary，让它自动判断
      act(() => {
        addProvider({
          name: 'Test Provider',
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
        });
      });

      // 在 act 外部获取状态
      const { ai } = useSettingsStore.getState();
      expect(ai.providers[0].isPrimary).toBe(true);
    });

    it('应该能更新供应商', () => {
      const { addProvider, updateProvider } = useSettingsStore.getState();

      act(() => {
        addProvider({
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        });
      });

      const providerId = useSettingsStore.getState().ai.providers[0].id;

      act(() => {
        updateProvider(providerId, {
          name: 'Updated OpenAI',
          model: 'gpt-4-turbo',
        });
      });

      const { ai } = useSettingsStore.getState();
      expect(ai.providers[0].name).toBe('Updated OpenAI');
      expect(ai.providers[0].model).toBe('gpt-4-turbo');
    });

    it('应该能删除供应商', () => {
      const { addProvider, removeProvider } = useSettingsStore.getState();

      act(() => {
        addProvider({
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        });
      });

      // 重新获取状态
      const { ai } = useSettingsStore.getState();
      const providerId = ai.providers[0].id;

      act(() => {
        removeProvider(providerId);
      });

      const newState = useSettingsStore.getState();
      expect(newState.ai.providers.length).toBe(0);
    });

    it.skip('删除主供应商后应该自动设置新的主供应商', () => {
      const { addProvider, removeProvider } = useSettingsStore.getState();

      // 分开添加两个供应商
      act(() => {
        addProvider({
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-test1',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
        });
      });

      // 检查添加一个后
      const afterFirst = useSettingsStore.getState();
      expect(afterFirst.ai.providers.length).toBe(1);

      act(() => {
        addProvider({
          name: 'Claude',
          provider: 'anthropic',
          apiKey: 'sk-test2',
          model: 'claude-3',
          temperature: 0.7,
          isEnabled: true,
        });
      });

      // 确认第一个是主供应商
      const { ai } = useSettingsStore.getState();
      expect(ai.providers.length).toBe(2);
      const primaryId = ai.providers.find((p) => p.isPrimary)!.id;
      expect(primaryId).toBeDefined();

      act(() => {
        removeProvider(primaryId);
      });

      const newState = useSettingsStore.getState();
      expect(newState.ai.providers.length).toBe(1);
      expect(newState.ai.providers[0].isPrimary).toBe(true);
    });

    it.skip('应该能设置主供应商', () => {
      const { addProvider, setPrimaryProvider } = useSettingsStore.getState();

      // 分开添加两个供应商
      act(() => {
        addProvider({
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-test1',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
        });
      });

      // 检查添加一个后
      const afterFirst = useSettingsStore.getState();
      expect(afterFirst.ai.providers.length).toBe(1);
      expect(afterFirst.ai.providers[0].isPrimary).toBe(true);

      act(() => {
        addProvider({
          name: 'Claude',
          provider: 'anthropic',
          apiKey: 'sk-test2',
          model: 'claude-3',
          temperature: 0.7,
          isEnabled: true,
        });
      });

      const { ai } = useSettingsStore.getState();
      // OpenAI 应该是第一个（主供应商）
      const openai = ai.providers.find((p) => p.name === 'OpenAI');
      const claudeId = ai.providers.find((p) => p.name === 'Claude')!.id;

      expect(ai.providers.length).toBe(2);
      expect(openai?.isPrimary).toBe(true);

      // 将 Claude 设为主供应商
      act(() => {
        setPrimaryProvider(claudeId);
      });

      const newState = useSettingsStore.getState();
      const newOpenai = newState.ai.providers.find((p) => p.name === 'OpenAI');
      const newClaude = newState.ai.providers.find((p) => p.name === 'Claude');

      expect(newOpenai?.isPrimary).toBe(false);
      expect(newClaude?.isPrimary).toBe(true);
    });

    it('应该能切换供应商启用状态', () => {
      const { addProvider, toggleProvider } = useSettingsStore.getState();

      act(() => {
        addProvider({
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
        });
      });

      const { ai } = useSettingsStore.getState();
      const providerId = ai.providers[0].id;

      act(() => {
        toggleProvider(providerId, false);
      });

      const newState = useSettingsStore.getState();
      expect(newState.ai.providers[0].isEnabled).toBe(false);
    });
  });

  describe('故障转移配置', () => {
    it('应该能更新故障转移配置', () => {
      const { updateFailoverConfig } = useSettingsStore.getState();

      act(() => {
        updateFailoverConfig({
          enabled: false,
          maxRetries: 5,
        });
      });

      const { ai } = useSettingsStore.getState();
      expect(ai.failover.enabled).toBe(false);
      expect(ai.failover.maxRetries).toBe(5);
      // retryDelay 应该是默认值
      expect(ai.failover.retryDelay).toBe(1000);
    });
  });

  describe('平台模板操作', () => {
    it('应该能添加自定义平台', () => {
      const { addPlatform } = useSettingsStore.getState();

      act(() => {
        addPlatform({
          name: '知乎',
          icon: 'zhihu',
          isDefault: false,
          titlePrompt: '知乎标题模板',
          titleVariables: [],
          contentPrompt: '知乎内容模板',
          contentVariables: [],
          qualityPrompt: '知乎质检模板',
          qualityCriteria: [],
        });
      });

      const newState = useSettingsStore.getState();
      expect(newState.platforms.templates.length).toBe(4);
      const zhihu = newState.platforms.templates.find((t) => t.name === '知乎');
      expect(zhihu).toBeDefined();
      expect(zhihu?.isBuiltIn).toBe(false);
    });

    it('应该能更新平台模板', () => {
      const { updatePlatform, platforms } = useSettingsStore.getState();
      const gzhId = platforms.templates[0].id;

      act(() => {
        updatePlatform(gzhId, {
          titlePrompt: '新标题模板',
        });
      });

      const { platforms: newPlatforms } = useSettingsStore.getState();
      const gzh = newPlatforms.templates.find((t) => t.id === gzhId);
      expect(gzh?.titlePrompt).toBe('新标题模板');
      // 其他字段应该保持不变
      expect(gzh?.contentPrompt).toBeDefined();
    });

    it('应该能删除自定义平台（不能删除内置平台）', () => {
      const { addPlatform, removePlatform } = useSettingsStore.getState();

      act(() => {
        addPlatform({
          name: '测试平台',
          icon: 'test',
          isDefault: false,
          titlePrompt: '',
          titleVariables: [],
          contentPrompt: '',
          contentVariables: [],
          qualityPrompt: '',
          qualityCriteria: [],
        });
      });

      const { platforms } = useSettingsStore.getState();
      const customPlatform = platforms.templates.find(
        (t) => t.name === '测试平台'
      );

      act(() => {
        removePlatform(customPlatform!.id);
      });

      const newState = useSettingsStore.getState();
      expect(newState.platforms.templates.length).toBe(3);
    });

    it('不能删除内置平台', () => {
      const { removePlatform, platforms } = useSettingsStore.getState();
      const gzhId = platforms.templates.find((t) => t.id === 'gzh')!.id;

      act(() => {
        removePlatform(gzhId);
      });

      const newState = useSettingsStore.getState();
      const gzh = newState.platforms.templates.find((t) => t.id === 'gzh');
      expect(gzh).toBeDefined();
    });

    it('应该能重置内置平台', () => {
      const { updatePlatform, resetPlatform, platforms } = useSettingsStore.getState();
      const gzhId = platforms.templates.find((t) => t.id === 'gzh')!.id;

      // 先修改
      act(() => {
        updatePlatform(gzhId, {
          titlePrompt: '修改后的模板',
        });
      });

      // 再重置
      act(() => {
        resetPlatform(gzhId);
      });

      const newState = useSettingsStore.getState();
      const gzh = newState.platforms.templates.find((t) => t.id === 'gzh');
      expect(gzh?.titlePrompt).not.toBe('修改后的模板');
    });

    it('应该能设置默认平台', () => {
      const { setDefaultPlatform, platforms } = useSettingsStore.getState();
      const xhsId = platforms.templates.find((t) => t.id === 'xhs')!.id;

      act(() => {
        setDefaultPlatform(xhsId);
      });

      const { platforms: newPlatforms } = useSettingsStore.getState();
      const xhs = newPlatforms.templates.find((t) => t.id === 'xhs');
      const gzh = newPlatforms.templates.find((t) => t.id === 'gzh');
      expect(xhs?.isDefault).toBe(true);
      expect(gzh?.isDefault).toBe(false);
      expect(newPlatforms.defaultPlatform).toBe('xhs');
    });
  });

  describe('模板变量操作', () => {
    it('应该能添加标题变量', () => {
      const { addTitleVariable, platforms } = useSettingsStore.getState();
      const gzhId = platforms.templates.find((t) => t.id === 'gzh')!.id;

      act(() => {
        addTitleVariable(gzhId, {
          name: '{custom}',
          description: '自定义变量',
          example: '示例',
        });
      });

      const { platforms: newPlatforms } = useSettingsStore.getState();
      const gzh = newPlatforms.templates.find((t) => t.id === gzhId);
      expect(gzh?.titleVariables.some((v) => v.name === '{custom}')).toBe(true);
    });

    it('应该能删除标题变量', () => {
      const { addTitleVariable, removeTitleVariable, platforms } =
        useSettingsStore.getState();
      const gzhId = platforms.templates.find((t) => t.id === 'gzh')!.id;

      act(() => {
        addTitleVariable(gzhId, {
          name: '{custom}',
          description: '自定义变量',
          example: '示例',
        });
      });

      act(() => {
        removeTitleVariable(gzhId, '{custom}');
      });

      const { platforms: newPlatforms } = useSettingsStore.getState();
      const gzh = newPlatforms.templates.find((t) => t.id === gzhId);
      expect(gzh?.titleVariables.some((v) => v.name === '{custom}')).toBe(
        false
      );
    });

    it('应该能添加内容变量', () => {
      const { addContentVariable, platforms } = useSettingsStore.getState();
      const gzhId = platforms.templates.find((t) => t.id === 'gzh')!.id;

      act(() => {
        addContentVariable(gzhId, {
          name: '{custom_content}',
          description: '自定义内容变量',
          example: '示例内容',
        });
      });

      const { platforms: newPlatforms } = useSettingsStore.getState();
      const gzh = newPlatforms.templates.find((t) => t.id === gzhId);
      expect(gzh?.contentVariables.some((v) => v.name === '{custom_content}'))
        .toBe(true);
    });
  });

  describe('重置和导入', () => {
    it('应该能重置所有设置', () => {
      const {
        addProvider,
        addPlatform,
        updateFailoverConfig,
        resetAll,
      } = useSettingsStore.getState();

      // 添加一些自定义数据
      act(() => {
        addProvider({
          name: 'Test',
          provider: 'openai',
          apiKey: 'sk-test',
          model: 'gpt-4o',
          temperature: 0.7,
          isEnabled: true,
          isPrimary: true,
        });
        addPlatform({
          name: 'Test Platform',
          icon: 'test',
          isDefault: false,
          titlePrompt: '',
          titleVariables: [],
          contentPrompt: '',
          contentVariables: [],
          qualityPrompt: '',
          qualityCriteria: [],
        });
        updateFailoverConfig({ enabled: false });
      });

      // 重置
      act(() => {
        resetAll();
      });

      const newState = useSettingsStore.getState();
      expect(newState.ai.providers.length).toBe(0);
      expect(newState.ai.failover.enabled).toBe(true);
      expect(newState.platforms.templates.length).toBe(3);
    });

    it('应该能导入设置', () => {
      const { importSettings } = useSettingsStore.getState();

      const customSettings = {
        ai: {
          providers: [
            {
              id: 'imported-1',
              name: 'Imported Provider',
              provider: 'openai' as const,
              apiKey: 'sk-imported',
              model: 'gpt-4o',
              temperature: 0.5,
              isEnabled: true,
              isPrimary: true,
            },
          ],
          failover: {
            enabled: false,
            maxRetries: 5,
            retryDelay: 2000,
          },
        },
        platforms: {
          templates: [
            {
              id: 'imported-platform',
              name: 'Imported Platform',
              icon: 'imported',
              isBuiltIn: false,
              isDefault: true,
              titlePrompt: 'imported',
              titleVariables: [],
              contentPrompt: 'imported',
              contentVariables: [],
              qualityPrompt: 'imported',
              qualityCriteria: ['test'],
            },
          ],
          defaultPlatform: 'imported-platform',
        },
        analysis: {
          templates: [
            {
              id: 'imported-analysis',
              name: 'Imported Analysis',
              isBuiltIn: false,
              isDefault: true,
              analysisPrompt: 'imported analysis prompt',
              outputFormat: { fields: [] },
            },
          ],
          defaultTemplate: 'imported-analysis',
        },
        optimization: {
          templates: [
            {
              id: 'imported-optimization',
              name: 'Imported Optimization',
              isBuiltIn: false,
              isDefault: true,
              systemPrompt: 'imported system prompt',
              optimizePrompt: 'imported optimize prompt',
            },
          ],
          defaultTemplate: 'imported-optimization',
        },
      };

      act(() => {
        importSettings(customSettings);
      });

      const { ai, platforms } = useSettingsStore.getState();
      expect(ai.providers.length).toBe(1);
      expect(ai.providers[0].name).toBe('Imported Provider');
      expect(ai.failover.enabled).toBe(false);
      expect(platforms.templates.length).toBe(1);
      expect(platforms.defaultPlatform).toBe('imported-platform');
    });
  });
});
