import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type AppSettings,
  type AISettings,
  type ProviderConfig,
  type FailoverConfig,
  type PlatformSettings,
  type PlatformTemplate,
  type TemplateVariable,
  type AIProvider,
  type AnalysisSettings,
  type AnalysisTemplate,
  type OptimizationSettings,
  type OptimizationTemplate,
  DEFAULT_VARIABLES,
} from '../services/llm/types';

// 默认故障转移配置
const DEFAULT_FAILOVER_CONFIG: FailoverConfig = {
  enabled: true,
  maxRetries: 3,
  retryDelay: 1000,
};

// 内置平台模板
const createBuiltInPlatforms = (): PlatformTemplate[] => [
  {
    id: 'gzh',
    name: '公众号',
    icon: '📺',
    isBuiltIn: true,
    isDefault: false,
    titlePrompt: `你是一个公众号爆款标题专家。请根据以下信息生成5个适合公众号的爆款标题：

【原始内容】
{content}

【关键词】
{keywords}

【内容调性】
{style}

【要求】
1. 13-25字，关键词前置
2. 使用八大标题公式：颠覆认知型、痛点共鸣型、悬念钩子型、数字清单型、身份标签型、热点借力型、对话口语型、金句前置型
3. 引发好奇或共鸣，能吸引点击
4. 每个标题标注类型和推荐度`,
    titleVariables: DEFAULT_VARIABLES,
    contentPrompt: `你是一个公众号内容创作专家。请根据以下信息改写成公众号风格的文章：

【原始内容】
{content}

【目标受众】
{audience}

【核心关键词】
{keywords}

【情绪基调】
{emotion}

【内容分类】
{category}

【风格】
{style}

【公众号爆款公式】
爆款 = 精准选题 × 吸睛标题 × 黄金开头 × 价值密度 × 情绪共鸣 × 传播设计

【写作要求】
1. 开头300字：使用场景代入法/数据冲击法/金句引入法/故事开头法/直接提问法，建立"这是写给我的"代入感
2. 主体1500-2000字：
   - 使用并列式/递进式/故事式/对比式结构
   - 每300字一个视觉休息点
   - 包含小标题（有观点、有态度）
   - 植入金句（对比型、定义型，反问型、诗意型、行动型）
3. 结尾300-500字：使用行动召唤型/情感升华型/开放式提问型/金句收束型/预告期待型
4. 段落分明、干货充足
5. 预埋3-5个传播触发点
6. 字数：2000-3000字`,
    contentVariables: [
      ...DEFAULT_VARIABLES,
      { name: '{word_count}', description: '目标字数', example: '2000' },
    ],
    qualityPrompt: `请对以下公众号文章进行六维度质检：
文章内容：{content}

评估维度：`,
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
    isDefault: false,
    titlePrompt: `你是一个小红书爆款标题专家。请根据以下信息生成5个适合小红书的爆款标题：

【原始内容】
{content}

【关键词】
{keywords}

【内容调性】
{style}

【小红书生态画像】
- 用户心理："我想发现好东西" / "这个对我有用吗"
- 核心指标：点击率 > 互动率 > 收藏率 > 转化率
- CES评分：点赞1分+收藏1分+评论4分+转发4分+关注8分

【要求】
1. 20字以内，关键词+情绪词前置
2. 使用六大标题公式：大字报型、拼图对比型、真实场景型、信息图表型、悬念钩子型、人物情绪型
3. 引发收藏和分享（高CES互动）
4. 身份标签化：打工人/25岁/INFJ/内向者等
5. 每个标题标注类型和推荐度`,
    titleVariables: DEFAULT_VARIABLES,
    contentPrompt: `你是一个小红书内容创作专家。请根据以下信息改写成小红书风格的笔记：

【原始内容】
{content}

【目标受众】
{audience}

【核心关键词】
{keywords}

【情绪基调】
{emotion}

【内容分类】
{category}

【风格】
{style}

【小红书爆款公式】
爆款 = 精准封面 × 痛点标题 × 快速代入 × 干货密度 × 情绪共鸣 × 互动设计

【正文黄金结构】
字数：300-800字（最佳500字左右）
- 开头（代入感）：50-80字，2秒留存
- 中间（干货/故事）：200-500字，干货密度
- 结尾（互动）：50-80字，互动触发

【开头公式】
- 情绪共鸣式："谁懂啊！______" / "家人们，我真的会谢！______"
- 问题痛点式："被______困扰的姐妹看过来！"
- 成果展示式："坚持______X天后，我______"
- 故事引入式："最近发现了一个______"
- 直接干货式："总结了X个关键点："

【中间内容】
- 清单式：1️⃣ 2️⃣ 3️⃣ 结构
- 故事式：困境→转折→改变→感悟
- 对比式：以前❌ → 现在✅
- 教程式：Step 1 / Step 2 / Step 3

【结尾公式】
- 直接号召式："觉得有用的话记得点赞收藏哦~"
- 提问互动式："你们有同感吗？"
- 情感共鸣式："愿我们都能成为更好的自己"
- 预告期待式："关🐷我，持续分享______"

【排版技巧】
- 每100-150字一个段落
- 使用emoji作为视觉标记（❗️💡⭐️✨ / 1️⃣2️⃣3️⃣ / 😭😂❤️💕）
- 重点用「」或【】突出
- 适当换行和空格

【互动引导】
- 点赞收藏引导
- 评论互动话题
- 关注引导`,
    contentVariables: DEFAULT_VARIABLES,
    qualityPrompt: `请对以下小红书笔记进行六维度质检：
笔记内容：{content}

评估维度：`,
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
    isDefault: false,
    titlePrompt: `你是一个抖音爆款标题专家。请根据以下信息生成5个适合抖音的爆款标题：

【原始内容】
{content}

【关键词】
{keywords}

【内容调性】
{style}

【抖音生态画像】
- 用户心理："我想开心一下" / "这个有意思吗"
- 核心指标：3秒完播率 > 整体完播率 > 互动率 > 转粉率
- 算法逻辑：赛马机制，实时数据决定流量池跃升

【要求】
1. 15字以内，悬念/冲突/情绪
2. 使用黄金3秒十大公式：反常识开头/强情绪开头/悬念钩子开头/身份锁定开头/冲突矛盾开头/数字冲击开头/直接提问开头/结果前置开头/情绪爆发开头/场景代入开头
3. 引发完播和评论
4. 每个标题标注类型和推荐度`,
    titleVariables: DEFAULT_VARIABLES,
    contentPrompt: `你是一个抖音脚本创作专家。请根据以下信息改写成抖音风格的脚本：

【原始内容】
{content}

【目标受众】
{audience}

【核心关键词】
{keywords}

【情绪基调】
{emotion}

【内容分类】
{category}

【风格】
{style}

【抖音爆款公式】
爆款 = 黄金3秒 × 情绪曲线 × 信息密度 × 节奏控制 × 互动设计

【黄金45秒结构】
0-3秒：黄金钩子（生死线）
3-15秒：问题/痛点放大
15-30秒：核心内容输出
30-40秒：案例/金句佐证
40-45秒：行动召唤/升华

【黄金3秒十大公式】
1. 反常识开头："你以为______，其实______"
2. 强情绪开头："太扎心了！______" / "听完这段话，我沉默了..."
3. 悬念钩子开头："我终于知道为什么______了"
4. 身份锁定开头："30岁以上的人，建议认真看完"
5. 冲突矛盾开头："他月薪3000，却比我月薪3万过得好"
6. 数字冲击开头："只用了3天，我______"
7. 直接提问开头："你有没有发现______？"
8. 结果前置开头："看完这个视频，你会______"
9. 情绪爆发开头：直接播放最精彩片段
10. 场景代入开头："凌晨2点，我又失眠了"

【脚本模板】
[0-3秒] 黄金钩子：画面特写 + 口播钩子句 + 大字字幕 + BGM
[3-15秒] 痛点放大：日常场景 + 痛点描述 + 字幕强调
[15-35秒] 核心观点：主讲人 + 关键句字幕 + BGM递进
[35-50秒] 案例佐证：素材展示 + 前后对比 + 字幕
[50-60秒] 行动召唤：切回主讲人 + 点赞手势 + 关注引导 + BGM收尾

【金句类型】
- 对比反差型："我们总以为来日方长，却忘了世事无常"
- 定义洞察型："所谓成熟，就是承认有些努力确实没有结果"
- 反问扎心型："为什么你总是很累？因为你一直在假装努力"
- 行动力量型："与其焦虑未来，不如把今天过到极致"

【字幕设计】
- 大字标题：占屏幕1/3
- 颜色对比：黄黑/红白/蓝白
- 动画效果：打字机/弹跳/渐显
- 关键信息逐字放大

【互动设计】
- 点赞触发："认同的点个赞"
- 评论触发："A还是B？你选哪个？"
- 转发触发："转发给需要的人"
- 关注触发："关注我，每天一个______"

【节奏控制】
- 每3-5秒必须有新的信息或刺激
- 口播类：每5-10秒切换画面
- 语速：钩子部分快→核心部分适中→结尾部分放缓`,
    contentVariables: DEFAULT_VARIABLES,
    qualityPrompt: `请对以下抖音脚本进行六维度质检：
脚本内容：{content}

评估维度：`,
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
  templates: createBuiltInPlatforms(),
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
      analysisPrompt: `你是一个顶尖新媒体爆款拆解专家。请对以下爆款内容进行深度逆向拆解，提取其Content DNA底层逻辑。

请严格按照以下维度进行结构化分析，以JSON格式输出：

## 一、基础定位
- 主题分类：情感/科技/商业/生活/教育/娱乐/其他
- 核心议题：内容主要讨论什么问题？受众的痛点是什么？
- 目标受众画像：年龄段、身份标签，心理需求

## 二、结构脉络 (Structure)
- 开篇钩子：前30秒/前300字是如何留住用户的？使用了什么技巧（悬念/冲突/共鸣）？吸引力打分（1-10分）
- 主线脉络：按时间线梳理3-5个核心论点或故事节点
- 高潮时刻：哪一部分最精彩？标记其特征
- 逻辑链条：提炼"论点→论据→结论"的完整转化路径
- 收尾方式：如何结束？是否有强烈的行动号召(CTA)或情绪余韵？

## 三、价值与情绪 (Value & Emotion)
- 知识增量：用户能学到什么？
- 认知颠覆：打破了什么固有观念？
- 情绪价值：引发什么共鸣？（焦虑→释怀→振奋等情绪起伏）
- 实用价值：有可操作性吗？

## 四、爆款基因评估
- 标题吸引力打分（1-10分）及亮点分析
- 开头留存力打分（1-10分）及亮点分析
- 内容价值度打分（1-10分）及亮点分析
- 情绪感染力打分（1-10分）及亮点分析
- 传播设计度打分（1-10分）及亮点分析（金句/转发点）
- 排版美观度打分（1-10分）及亮点分析

## 五、高光与传播点
- 金句提取：3-5句极具传播属性的金句
- 互动诱饵：作者是如何引导点赞、评论或收藏的？

请以JSON格式输出完整分析结果。`,
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

// 默认优化报告设置
const createDefaultOptimizationSettings = (): OptimizationSettings => ({
  templates: [
    {
      id: 'default',
      name: '针对性优化',
      isBuiltIn: true,
      isDefault: true,
      systemPrompt: '你是一个内容优化专家，擅长根据质检报告进行针对性优化。只修改需要改进的部分，其他保持原样。',
      optimizePrompt: `请根据以下质检报告对内容进行针对性优化。

## 原始内容
{originalContent}

## 质检报告
{qualityReport}

## 优化要求
1. 只修改质检报告中标记为"未通过"或"不足"的部分
2. 其他内容保持不变
3. 保持内容的完整性、逻辑流畅度、风格、语调、情绪
4. 修改后的内容要自然流畅，不要有拼接感

请直接输出优化后的完整内容，不要添加任何解释。`
    }
  ],
  defaultTemplate: 'default',
});

// 默认完整设置
const createDefaultSettings = (): AppSettings => ({
  ai: createDefaultAISettings(),
  platforms: createDefaultPlatformSettings(),
  analysis: createDefaultAnalysisSettings(),
  optimization: createDefaultOptimizationSettings(),
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

  // 平台模板操作
  addPlatform: (template: Omit<PlatformTemplate, 'id' | 'isBuiltIn'>) => void;
  updatePlatform: (id: string, updates: Partial<PlatformTemplate>) => void;
  removePlatform: (id: string) => void;
  resetPlatform: (id: string) => void;
  setDefaultPlatform: (id: string) => void;

  // 模板变量操作
  addTitleVariable: (platformId: string, variable: TemplateVariable) => void;
  removeTitleVariable: (platformId: string, variableName: string) => void;
  addContentVariable: (platformId: string, variable: TemplateVariable) => void;
  removeContentVariable: (platformId: string, variableName: string) => void;

  // 内容分析模板操作
  addAnalysisTemplate: (template: Omit<AnalysisTemplate, 'id' | 'isBuiltIn'>) => void;
  updateAnalysisTemplate: (id: string, updates: Partial<AnalysisTemplate>) => void;
  removeAnalysisTemplate: (id: string) => void;
  resetAnalysisTemplate: (id: string) => void;
  setDefaultAnalysisTemplate: (id: string) => void;

  // 优化报告模板操作
  addOptimizationTemplate: (template: Omit<OptimizationTemplate, 'id' | 'isBuiltIn'>) => void;
  updateOptimizationTemplate: (id: string, updates: Partial<OptimizationTemplate>) => void;
  removeOptimizationTemplate: (id: string) => void;
  resetOptimizationTemplate: (id: string) => void;
  setDefaultOptimizationTemplate: (id: string) => void;

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

      // 平台模板操作
      addPlatform: (template) => {
        const id = `platform-${Date.now()}`;
        const newTemplate: PlatformTemplate = {
          ...template,
          id,
          isBuiltIn: false,
        };
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: [...state.platforms.templates, newTemplate],
          },
        }));
      },

      updatePlatform: (id, updates) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: state.platforms.templates.map((t) =>
              t.id === id ? { ...t, ...updates } : t
            ),
          },
        }));
      },

      removePlatform: (id) => {
        set((state) => {
          // 找到要删除的平台
          const platformToRemove = state.platforms.templates.find(
            (t) => t.id === id
          );

          // 如果是内置平台，不允许删除
          if (platformToRemove?.isBuiltIn) {
            return state;
          }

          const templates = state.platforms.templates.filter(
            (t) => t.id !== id
          );
          // 如果删除的是默认平台，重新设置默认平台
          const needsNewDefault =
            templates.length > 0 &&
            !templates.some((t) => t.isDefault);
          if (needsNewDefault) {
            templates[0].isDefault = true;
          }
          return {
            platforms: {
              ...state.platforms,
              templates,
              defaultPlatform:
                state.platforms.defaultPlatform === id
                  ? templates[0]?.id
                  : state.platforms.defaultPlatform,
            },
          };
        });
      },

      resetPlatform: (id) => {
        const builtIn = createBuiltInPlatforms().find((t) => t.id === id);
        if (builtIn) {
          set((state) => ({
            platforms: {
              ...state.platforms,
              templates: state.platforms.templates.map((t) =>
                t.id === id ? builtIn : t
              ),
            },
          }));
        }
      },

      setDefaultPlatform: (id) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: state.platforms.templates.map((t) => ({
              ...t,
              isDefault: t.id === id,
            })),
            defaultPlatform: id,
          },
        }));
      },

      // 模板变量操作
      addTitleVariable: (platformId, variable) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: state.platforms.templates.map((t) =>
              t.id === platformId
                ? {
                    ...t,
                    titleVariables: [...t.titleVariables, variable],
                  }
                : t
            ),
          },
        }));
      },

      removeTitleVariable: (platformId, variableName) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: state.platforms.templates.map((t) =>
              t.id === platformId
                ? {
                    ...t,
                    titleVariables: t.titleVariables.filter(
                      (v) => v.name !== variableName
                    ),
                  }
                : t
            ),
          },
        }));
      },

      addContentVariable: (platformId, variable) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: state.platforms.templates.map((t) =>
              t.id === platformId
                ? {
                    ...t,
                    contentVariables: [...t.contentVariables, variable],
                  }
                : t
            ),
          },
        }));
      },

      removeContentVariable: (platformId, variableName) => {
        set((state) => ({
          platforms: {
            ...state.platforms,
            templates: state.platforms.templates.map((t) =>
              t.id === platformId
                ? {
                    ...t,
                    contentVariables: t.contentVariables.filter(
                      (v) => v.name !== variableName
                    ),
                  }
                : t
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
      addOptimizationTemplate: (template) => {
        const id = `optimization-${Date.now()}`;
        const newTemplate: OptimizationTemplate = {
          ...template,
          id,
          isBuiltIn: false,
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

      setDefaultOptimizationTemplate: (id) => {
        set((state) => ({
          optimization: {
            ...state.optimization,
            templates: state.optimization.templates.map((t) => ({
              ...t,
              isDefault: t.id === id,
            })),
            defaultTemplate: id,
          },
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
    }
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
