import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type AppSettings,
  type AISettings,
  type ProviderConfig,
  type FailoverConfig,
  type PlatformSettings,
  type Platform,
  type ContentTemplate,
  type AIProvider,
  type AnalysisSettings,
  type AnalysisTemplate,
  type OptimizationSettings,
  type OptimizationTemplate,
} from '../services/llm/types';
import {
  analysisPrompt,
  gzhTitlePrompt,
  gzhContentPrompt,
  gzhQualityPrompt,
  gzhSystemPrompt,
  gzhOptimizationPrompt,
  xhsTitlePrompt,
  xhsContentPrompt,
  xhsQualityPrompt,
  xhsSystemPrompt,
  xhsOptimizationPrompt,
  douyinTitlePrompt,
  douyinContentPrompt,
  douyinQualityPrompt,
  douyinSystemPrompt,
  douyinOptimizationPrompt,
} from '../data/index';

// 默认故障转移配置
const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelay: 1000,
};

// 内置平台（每个平台可有多个内容模板）
const createBuiltInPlatforms = (): Platform[] => [
  {
    id: 'gzh',
    name: '公众号',
    icon: '📺',
    isBuiltIn: true,
    templates: [
      {
        id: 'gzh-deep',
        name: '深度文章模板',
        titlePrompt: gzhTitlePrompt,
        contentPrompt: gzhContentPrompt,
      },
      {
        id: 'gzh-quick',
        name: '快讯模板',
        titlePrompt: gzhTitlePrompt,
        contentPrompt: gzhContentPrompt,
      },
    ],
    defaultTemplateId: 'gzh-deep',
    qualityPrompt: gzhQualityPrompt,
    qualityCriteria: [
      '标题吸引力（13-25字，关键词前置）',
      '开头留存力（前300字留存）',
      '内容价值度（知识增量+认知颠覆）',
      '情绪感染力（共鸣+深度）',
      '传播设计度（金句数+转发点）',
      '排版美观度（段落+重点标记）',
    ],
  },
  {
    id: 'xhs',
    name: '小红书',
    icon: '📕',
    isBuiltIn: true,
    templates: [
      {
        id: 'xhs-grass',
        name: '种草模板',
        titlePrompt: xhsTitlePrompt,
        contentPrompt: xhsContentPrompt,
      },
    ],
    defaultTemplateId: 'xhs-grass',
    qualityPrompt: xhsQualityPrompt,
    qualityCriteria: [
      '标题吸引力（20字内，情绪词+关键词）',
      '开头留存力（前50字留存）',
      '内容价值度（实用干货+种草价值）',
      '情绪感染力（真实+温暖）',
      '传播设计度（互动引导+收藏点）',
      '排版美观度（Emoji+分段）',
    ],
  },
  {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    isBuiltIn: true,
    templates: [
      {
        id: 'douyin-short',
        name: '短视频脚本',
        titlePrompt: douyinTitlePrompt,
        contentPrompt: douyinContentPrompt,
      },
    ],
    defaultTemplateId: 'douyin-short',
    qualityPrompt: douyinQualityPrompt,
    qualityCriteria: [
      '标题吸引力（15字内，悬念/冲突）',
      '开头留存力（前3秒完播）',
      '内容价值度（信息密度+节奏）',
      '情绪感染力（强烈+即时）',
      '传播设计度（点赞引导+评论点）',
      '排版美观度（字幕+画面）',
    ],
  },
];

// 默认 AI 设置
const createDefaultAISettings = (): AISettings => ({
  providers: [],
  failover: DEFAULT_FAILOVER_CONFIG,
});

// 默认平台设置
const createDefaultPlatformSettings = (): PlatformSettings => ({
  platforms: createBuiltInPlatforms(),
  defaultPlatform: 'gzh',
});

// 默认内容分析设置
const createDefaultAnalysisSettings = (): AnalysisSettings => ({
  templates: [
    {
      id: 'default',
      name: '爆款内容拆解',
      isBuiltIn: true,
      isDefault: true,
      analysisPrompt: analysisPrompt,
      outputFormat: {
        fields: [
          { key: '主题分类', label: '主题分类', type: 'string', required: true },
          { key: '核心议题', label: '核心议题', type: 'string', required: true },
          { key: '目标受众', label: '目标受众', type: 'string', required: true },
          { key: '情绪基调', label: '情绪基调', type: 'array', required: true },
          { key: '内容结构', label: '内容结构', type: 'object', required: true },
          { key: '价值点', label: '价值点', type: 'object', required: true },
          { key: '高光片段', label: '高光片段', type: 'array', required: true }
        ]
      }
    }
  ],
  defaultTemplate: 'default',
});

// 默认优化报告设置（按平台分类）
const createDefaultOptimizationSettings = (): OptimizationSettings => ({
  templates: [
    // 公众号优化模板
    {
      id: 'gzh-default',
      name: '公众号通用优化',
      isBuiltIn: true,
      isDefault: true,
      platformId: 'gzh',
      systemPrompt: gzhSystemPrompt,
      optimizePrompt: gzhOptimizationPrompt,
    },
    // 小红书优化模板
    {
      id: 'xhs-default',
      name: '小红书通用优化',
      isBuiltIn: true,
      isDefault: true,
      platformId: 'xhs',
      systemPrompt: xhsSystemPrompt,
      optimizePrompt: xhsOptimizationPrompt,
    },
    // 抖音优化模板
    {
      id: 'douyin-default',
      name: '抖音通用优化',
      isBuiltIn: true,
      isDefault: true,
      platformId: 'douyin',
      systemPrompt: douyinSystemPrompt,
      optimizePrompt: douyinOptimizationPrompt,
    }
  ],
  defaultTemplate: 'gzh-default',
});

// 默认完整设置
const createDefaultSettings = (): AppSettings => ({
  ai: createDefaultAISettings(),
  platforms: createDefaultPlatformSettings(),
  analysis: createDefaultAnalysisSettings(),
  optimization: createDefaultOptimizationSettings(),
  testMode: false,
});

// 默认前置信息
const createDefaultPreInfo = () => ({
  platform: '',
  contentType: '',
  track: '',
  likes: 0,
  collectCount: 0,
  viewCount: 0,
  shareCount: 0,
});

// 设置 Store
interface SettingsState extends AppSettings {
  // AI 供应商操作
  addProvider: (provider: Partial<ProviderConfig> & { name: string; provider: AIProvider; apiKey: string; model: string }) => void;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setPrimaryProvider: (id: string) => void;
  toggleProvider: (id: string, enabled: boolean) => void;

  // 故障转移配置
  updateFailoverConfig: (config: Partial<FailoverConfig>) => void;

  // 平台操作
  addPlatform: (platform: Omit<Platform, 'id' | 'isBuiltIn' | 'templates' | 'defaultTemplateId'> & { templates: Omit<ContentTemplate, 'id'>[] }) => void;
  updatePlatform: (id: string, updates: Partial<Platform>) => void;
  removePlatform: (id: string) => void;
  resetPlatform: (id: string) => void;
  setDefaultPlatform: (id: string) => void;

  // 平台内容模板操作
  addContentTemplate: (platformId: string, template: Omit<ContentTemplate, 'id'>) => void;
  updateContentTemplate: (platformId: string, templateId: string, updates: Partial<ContentTemplate>) => void;
  removeContentTemplate: (platformId: string, templateId: string) => void;
  setDefaultContentTemplate: (platformId: string, templateId: string) => void;

  // 内容分析模板操作
  addAnalysisTemplate: (template: Omit<AnalysisTemplate, 'id' | 'isBuiltIn'>) => void;
  updateAnalysisTemplate: (id: string, updates: Partial<AnalysisTemplate>) => void;
  removeAnalysisTemplate: (id: string) => void;
  resetAnalysisTemplate: (id: string) => void;
  setDefaultAnalysisTemplate: (id: string) => void;

  // 优化报告模板操作
  addOptimizationTemplate: (template: Omit<OptimizationTemplate, 'id' | 'isBuiltIn'>, platformId?: string) => void;
  updateOptimizationTemplate: (id: string, updates: Partial<OptimizationTemplate>) => void;
  removeOptimizationTemplate: (id: string) => void;
  resetOptimizationTemplate: (id: string) => void;
  setDefaultOptimizationTemplate: (id: string, platformId?: string) => void;
  getOptimizationTemplatesByPlatform: (platformId: string) => OptimizationTemplate[];

  // 测试模式
  toggleTestMode: () => void;

  // 前置信息（持久化）
  preInfo: {
    platform: string;
    contentType: string;
    track: string;
    likes: number;
    collectCount: number;
    viewCount: number;
    shareCount: number;
  };
  setPreInfo: (info: {
    platform?: string;
    contentType?: string;
    track?: string;
    likes?: number;
    collectCount?: number;
    viewCount?: number;
    shareCount?: number;
  }) => void;

  // 初始化/重置
  resetAll: () => void;
  importSettings: (settings: AppSettings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...createDefaultSettings(),

      // AI 供应商操作
      addProvider: (provider) => {
        const id = `provider-${Date.now()}`;
        const newProvider: ProviderConfig = {
          ...provider,
          id,
          temperature: provider.temperature ?? 0.7,
          isEnabled: provider.isEnabled ?? true,
          isPrimary: provider.isPrimary ?? get().ai.providers.length === 0,
        };
        set((state) => ({
          ai: {
            ...state.ai,
            providers: [...state.ai.providers, newProvider],
          },
        }));
      },

      updateProvider: (id, updates) => {
        set((state) => ({
          ai: {
            ...state.ai,
            providers: state.ai.providers.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
          },
        }));
      },

      removeProvider: (id) => {
        set((state) => {
          const providers = state.ai.providers.filter((p) => p.id !== id);
          // 如果删除的是主供应商，重新设置主供应商
          const needsNewPrimary =
            providers.length > 0 &&
            !providers.some((p) => p.isPrimary);
          if (needsNewPrimary) {
            providers[0].isPrimary = true;
          }
          return {
            ai: {
              ...state.ai,
              providers,
            },
          };
        });
      },

      setPrimaryProvider: (id) => {
        set((state) => ({
          ai: {
            ...state.ai,
            providers: state.ai.providers.map((p) => ({
              ...p,
              isPrimary: p.id === id,
            })),
          },
        }));
      },

      toggleProvider: (id, enabled) => {
        set((state) => ({
          ai: {
            ...state.ai,
            providers: state.ai.providers.map((p) =>
              p.id === id ? { ...p, isEnabled: enabled } : p
            ),
          },
        }));
      },

      // 故障转移配置
      updateFailoverConfig: (config) => {
        set((state) => ({
          ai: {
            ...state.ai,
            failover: {
              ...state.ai.failover,
              ...config,
            },
          },
        }));
      },

      // 平台操作
      addPlatform: (platform) => {
        const id = `platform-${Date.now()}`;
        const templates = platform.templates.map((t, idx) => ({
          ...t,
          id: `${id}-tpl-${idx}`,
        }));
        const newPlatform: Platform = {
          ...platform,
          id,
          isBuiltIn: false,
          templates,
          defaultTemplateId: templates[0]?.id || '',
        };
        set((state) => ({
          platforms: {
            ...state.platforms,
            platforms: [...state.platforms.platforms, newPlatform],
          },
        }));
      },

      updatePlatform: (id, updates) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            platforms: state.platforms.platforms.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
          },
        }));
      },

      removePlatform: (id) => {
        set((state) => {
          const platformToRemove = state.platforms.platforms.find(
            (p) => p.id === id
          );
          if (platformToRemove?.isBuiltIn) {
            return state;
          }
          const platforms = state.platforms.platforms.filter(
            (p) => p.id !== id
          );
          const needsNewDefault =
            platforms.length > 0 &&
            !platforms.some((p) => p.id === state.platforms.defaultPlatform);
          return {
            platforms: {
              ...state.platforms,
              platforms,
              defaultPlatform: needsNewDefault
                ? platforms[0]?.id
                : state.platforms.defaultPlatform,
            },
          };
        });
      },

      resetPlatform: (id) => {
        const builtIn = createBuiltInPlatforms().find((p) => p.id === id);
        if (builtIn) {
          set((state) => ({
            platforms: {
              ...state.platforms,
              platforms: state.platforms.platforms.map((p) =>
                p.id === id ? builtIn : p
              ),
            },
          }));
        }
      },

      setDefaultPlatform: (id) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            defaultPlatform: id,
          },
        }));
      },

      // 平台内容模板操作
      addContentTemplate: (platformId, template) => {
        const id = `tpl-${Date.now()}`;
        const newTemplate: ContentTemplate = {
          ...template,
          id,
        };
        set((state) => ({
          platforms: {
            ...state.platforms,
            platforms: state.platforms.platforms.map((p) =>
              p.id === platformId
                ? {
                    ...p,
                    templates: [...p.templates, newTemplate],
                    defaultTemplateId: p.defaultTemplateId || id,
                  }
                : p
            ),
          },
        }));
      },

      updateContentTemplate: (platformId, templateId, updates) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            platforms: state.platforms.platforms.map((p) =>
              p.id === platformId
                ? {
                    ...p,
                    templates: p.templates.map((t) =>
                      t.id === templateId ? { ...t, ...updates } : t
                    ),
                  }
                : p
            ),
          },
        }));
      },

      removeContentTemplate: (platformId, templateId) => {
        set((state) => {
          const platform = state.platforms.platforms.find((p) => p.id === platformId);
          if (!platform) return state;

          const templates = platform.templates.filter((t) => t.id !== templateId);
          if (templates.length === 0) return state;

          let defaultTemplateId = platform.defaultTemplateId;
          if (defaultTemplateId === templateId) {
            defaultTemplateId = templates[0].id;
          }

          return {
            platforms: {
              ...state.platforms,
              platforms: state.platforms.platforms.map((p) =>
                p.id === platformId
                  ? { ...p, templates, defaultTemplateId }
                  : p
              ),
            },
          };
        });
      },

      setDefaultContentTemplate: (platformId, templateId) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            platforms: state.platforms.platforms.map((p) =>
              p.id === platformId
                ? { ...p, defaultTemplateId: templateId }
                : p
            ),
          },
        }));
      },

      // 内容分析模板操作
      addAnalysisTemplate: (template) => {
        const id = `analysis-${Date.now()}`;
        const newTemplate: AnalysisTemplate = {
          ...template,
          id,
          isBuiltIn: false,
        };
        set((state) => ({
          analysis: {
            ...state.analysis,
            templates: [...state.analysis.templates, newTemplate],
          },
        }));
      },

      updateAnalysisTemplate: (id, updates) => {
        set((state) => ({
          analysis: {
            ...state.analysis,
            templates: state.analysis.templates.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          },
        }));
      },

      removeAnalysisTemplate: (id) => {
        const template = get().analysis.templates.find((t) => t.id === id);
        if (template?.isBuiltIn) return;

        set((state) => {
          const templates = state.analysis.templates.filter((t) => t.id !== id);
          // 如果删除的是默认模板，切换到第一个
          let defaultTemplate = state.analysis.defaultTemplate;
          if (defaultTemplate === id && templates.length > 0) {
            defaultTemplate = templates[0].id;
          }
          return {
            analysis: {
              templates,
              defaultTemplate,
            },
          };
        });
      },

      resetAnalysisTemplate: (id) => {
        const builtIn = createDefaultAnalysisSettings().templates.find((t) => t.id === id);
        if (!builtIn) return;

        set((state) => ({
          analysis: {
            ...state.analysis,
            templates: state.analysis.templates.map((t) =>
              t.id === id ? builtIn : t
            ),
          },
        }));
      },

      setDefaultAnalysisTemplate: (id) => {
        set((state) => ({
          analysis: {
            ...state.analysis,
            templates: state.analysis.templates.map((t) => ({
              ...t,
              isDefault: t.id === id,
            })),
            defaultTemplate: id,
          },
        }));
      },

      // 优化报告模板操作
      addOptimizationTemplate: (template, platformId) => {
        const id = `optimization-${Date.now()}`;
        const newTemplate: OptimizationTemplate = {
          ...template,
          id,
          isBuiltIn: false,
          platformId: platformId || template.platformId,
        };
        set((state) => ({
          optimization: {
            ...state.optimization,
            templates: [...state.optimization.templates, newTemplate],
          },
        }));
      },

      updateOptimizationTemplate: (id, updates) => {
        set((state) => ({
          optimization: {
            ...state.optimization,
            templates: state.optimization.templates.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          },
        }));
      },

      removeOptimizationTemplate: (id) => {
        const template = get().optimization.templates.find((t) => t.id === id);
        if (template?.isBuiltIn) return;

        set((state) => {
          const templates = state.optimization.templates.filter((t) => t.id !== id);
          let defaultTemplate = state.optimization.defaultTemplate;
          if (defaultTemplate === id && templates.length > 0) {
            defaultTemplate = templates[0].id;
          }
          return {
            optimization: {
              templates,
              defaultTemplate,
            },
          };
        });
      },

      resetOptimizationTemplate: (id) => {
        const builtIn = createDefaultOptimizationSettings().templates.find((t) => t.id === id);
        if (!builtIn) return;

        set((state) => ({
          optimization: {
            ...state.optimization,
            templates: state.optimization.templates.map((t) =>
              t.id === id ? builtIn : t
            ),
          },
        }));
      },

      setDefaultOptimizationTemplate: (id, platformId) => {
        set((state) => ({
          optimization: {
            ...state.optimization,
            // 如果传了 platformId，只设置该平台的默认模板
            // 否则设置全局默认模板（兼容旧逻辑）
            templates: platformId
              ? state.optimization.templates.map((t) => ({
                  ...t,
                  isDefault: t.platformId === platformId ? t.id === id : t.isDefault,
                }))
              : state.optimization.templates.map((t) => ({
                  ...t,
                  isDefault: t.id === id,
                })),
            defaultTemplate: platformId
              ? state.optimization.defaultTemplate // 保持原有的全局默认不变
              : id,
          },
        }));
      },

      getOptimizationTemplatesByPlatform: (platformId) => {
        return get().optimization.templates.filter(t => t.platformId === platformId);
      },

      // 测试模式
      toggleTestMode: () => {
        set((state) => ({
          testMode: !state.testMode,
        }));
      },

      // 前置信息（持久化）
      preInfo: createDefaultPreInfo(),

      setPreInfo: (info) => {
        set((state) => ({
          preInfo: { ...state.preInfo, ...info },
        }));
      },

      // 初始化/重置
      resetAll: () => {
        set(createDefaultSettings());
      },

      importSettings: (settings) => {
        set(settings);
      },
    }),
    {
      name: 'refine-settings', // localStorage key
      partialize: (state) => ({
        ai: state.ai,
        platforms: state.platforms,
        analysis: state.analysis,
        optimization: state.optimization,
        testMode: state.testMode,
      }),
      onRehydrateStorage: () => (state) => {
        // 迁移旧数据结构
        if (state && state.platforms) {
          const platforms = state.platforms as any;
          // 如果是旧结构 (templates 数组)，转换为新结构 (platforms 数组)
          if (Array.isArray(platforms.templates) && !platforms.platforms) {
            // 将旧的 templates 转换为 platforms
            const oldTemplates = platforms.templates;
            const migratedPlatforms = oldTemplates.map((t: any) => ({
              id: t.id,
              name: t.name,
              icon: t.icon,
              isBuiltIn: t.isBuiltIn,
              templates: [
                {
                  id: `${t.id}-default`,
                  name: '默认模板',
                  titlePrompt: t.titlePrompt || '',
                  contentPrompt: t.contentPrompt || '',
                }
              ],
              defaultTemplateId: `${t.id}-default`,
              qualityPrompt: t.qualityPrompt,
              qualityCriteria: t.qualityCriteria,
            }));
            state.platforms = {
              platforms: migratedPlatforms,
              defaultPlatform: platforms.defaultPlatform || migratedPlatforms[0]?.id,
            };
          }
        }
      },
    },
  )
);

// 选择器：获取主供应商
export const selectPrimaryProvider = (state: SettingsState) =>
  state.ai.providers.find((p) => p.isPrimary);

// 选择器：获取启用的供应商列表
export const selectEnabledProviders = (state: SettingsState) =>
  state.ai.providers.filter((p) => p.isEnabled);

// 选择器：获取备用供应商列表
export const selectFallbackProviders = (state: SettingsState) =>
  state.ai.providers
    .filter((p) => !p.isPrimary && p.isEnabled);
