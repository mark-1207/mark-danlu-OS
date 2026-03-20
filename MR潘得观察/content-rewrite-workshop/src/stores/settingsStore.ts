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
        titlePrompt: `你是一个公众号爆款标题专家。请根据以下信息生成5个适合公众号的爆款标题：

【原始内容】
{content}

【关键词】
{keywords}

【内容调性】
{style}

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

【要求】
1. 13-25字，关键词前置
2. 使用八大标题公式：颠覆认知型、痛点共鸣型、悬念钩子型、数字清单型、身份标签型、热点借力型、对话口语型、金句前置型
3. 引发好奇或共鸣，能吸引点击
4. 每个标题标注类型和推荐度`,
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

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

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
      },
      {
        id: 'gzh-quick',
        name: '快讯模板',
        titlePrompt: `你是一个公众号标题专家。请根据以下信息生成3个简洁的公众号标题：

【原始内容】
{content}

【关键词】
{keywords}

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

【要求】
1. 15-20字，简明扼要
2. 突出核心信息
3. 引发好奇或关注`,
        contentPrompt: `你是一个公众号内容创作专家。请根据以下信息改写成简洁的公众号文章：

【原始内容】
{content}

【目标受众】
{audience}

【核心关键词】
{keywords}

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

【要求】
1. 开头100字：直接点题，核心信息前置
2. 主体300-500字：关键信息+补充说明
3. 结尾100字：总结或引导
4. 字数：500-800字
5. 简洁明了，信息密度高`,
      },
    ],
    defaultTemplateId: 'gzh-deep',
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
    templates: [
      {
        id: 'xhs-grass',
        name: '种草模板',
        titlePrompt: `你是一个小红书爆款标题专家。请根据以下信息生成5个适合小红书的爆款标题：

【原始内容】
{content}

【关键词】
{keywords}

【内容调性】
{style}

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

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

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

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
      },
    ],
    defaultTemplateId: 'xhs-grass',
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
    templates: [
      {
        id: 'douyin-short',
        name: '短视频脚本',
        titlePrompt: `你是一个抖音爆款标题专家。请根据以下信息生成5个适合抖音的爆款标题：

【原始内容】
{content}

【关键词】
{keywords}

【内容调性】
{style}

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

【抖音生态画像】
- 用户心理："我想开心一下" / "这个有意思吗"
- 核心指标：3秒完播率 > 整体完播率 > 互动率 > 转粉率
- 算法逻辑：赛马机制，实时数据决定流量池跃升

【要求】
1. 15字以内，悬念/冲突/情绪
2. 使用黄金3秒十大公式：反常识开头/强情绪开头/悬念钩子开头/身份锁定开头/冲突矛盾开头/数字冲击开头/直接提问开头/结果前置开头/情绪爆发开头/场景代入开头
3. 引发完播和评论
4. 每个标题标注类型和推荐度`,
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

【前置信息】
平台：{platform}
内容类型：{content_type}
所属赛道：{track}
数据参考：点赞{likes} / 收藏{collect_count} / 阅读{view_count} / 分享{share_count}

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
      },
    ],
    defaultTemplateId: 'douyin-short',
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
      analysisPrompt: `你是一个顶尖新媒体爆款拆解专家。请对以下爆款内容进行深度逆向拆解，提取其Content DNA底层逻辑。

请严格按照以下JSON格式输出，**不要添加任何解释、评论或markdown代码块标记**，直接输出有效JSON：

{
  "主题分类": "情感/科技/商业/生活/教育/娱乐/其他",
  "核心议题": "内容主要讨论什么问题？",
  "目标受众": "年龄段、身份标签，心理需求",
  "情绪基调": ["情绪词1", "情绪词2"],
  "内容结构": {
    "开篇钩子": {"内容": "钩子内容", "技巧": "悬念/冲突/共鸣", "打分": 8},
    "主线脉络": ["节点1", "节点2", "节点3"],
    "高潮时刻": "最精彩的部分",
    "逻辑链条": "论点→论据→结论",
    "收尾方式": "结束方式"
  },
  "价值点": {
    "知识增量": "用户能学到的内容",
    "认知颠覆": "打破的固有观念",
    "情绪价值": "引发的共鸣",
    "实用价值": "可操作的内容"
  },
  "爆款基因评估": {
    "标题吸引力": {"打分": 8, "亮点": "亮点分析"},
    "开头留存力": {"打分": 8, "亮点": "亮点分析"},
    "内容价值度": {"打分": 8, "亮点": "亮点分析"},
    "情绪感染力": {"打分": 8, "亮点": "亮点分析"},
    "传播设计度": {"打分": 8, "亮点": "亮点分析"},
    "排版美观度": {"打分": 8, "亮点": "亮点分析"}
  },
  "高光片段": [
    {"类型": "金句", "内容": "金句内容"},
    {"类型": "金句", "内容": "金句内容2"}
  ]
}`,
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
      systemPrompt: '你是一个公众号内容优化专家，擅长根据质检报告进行针对性优化。根据公众号的特点（深度阅读、情感共鸣、传播设计）来优化内容。',
      optimizePrompt: `请根据以下质检报告对公众号文章进行针对性优化。

## 原始内容
{originalContent}

## 质检报告
{qualityReport}

## 公众号优化要求
1. 只修改质检报告中标记为"未通过"或"不足"的部分
2. 保持公众号风格：深度分析、情感共鸣、金句点缀
3. 保持内容的完整性、逻辑流畅度
4. 预埋传播触发点（金句、槽点、共鸣点）

请直接输出优化后的完整内容，不要添加任何解释。`
    },
    // 小红书优化模板
    {
      id: 'xhs-default',
      name: '小红书通用优化',
      isBuiltIn: true,
      isDefault: true,
      platformId: 'xhs',
      systemPrompt: '你是一个小红书内容优化专家，擅长根据质检报告进行针对性优化。根据小红书的特点（种草、互动、真实感）来优化内容。',
      optimizePrompt: `请根据以下质检报告对小红书笔记进行针对性优化。

## 原始内容
{originalContent}

## 质检报告
{qualityReport}

## 小红书优化要求
1. 只修改质检报告中标记为"未通过"或"不足"的部分
2. 保持小红书风格：真实分享、种草价值、互动引导
3. 使用emoji和分段保持视觉节奏
4. 结尾增加互动引导（点赞收藏评论）

请直接输出优化后的完整内容，不要添加任何解释。`
    },
    // 抖音优化模板
    {
      id: 'douyin-default',
      name: '抖音通用优化',
      isBuiltIn: true,
      isDefault: true,
      platformId: 'douyin',
      systemPrompt: '你是一个抖音脚本优化专家，擅长根据质检报告进行针对性优化。根据抖音的特点（黄金3秒、情绪节奏、完播率）来优化内容。',
      optimizePrompt: `请根据以下质检报告对抖音脚本进行针对性优化。

## 原始内容
{originalContent}

## 质检报告
{qualityReport}

## 抖音优化要求
1. 只修改质检报告中标记为"未通过"或"不足"的部分
2. 保持抖音风格：黄金3秒钩子、情绪节奏、紧凑节奏
3. 每3-5秒有新信息或刺激点
4. 增加行动号召和互动引导

请直接输出优化后的完整内容，不要添加任何解释。`
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
