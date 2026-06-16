# WORKFLOW_DESIGN.md


## 1. 场景 A 各步骤详细设计

### Step 1: 主题深挖 (topic-analysis)

**目的**：将一个简单的关键词/主题扩展为丰富的内容创作素材池

**LLM 调用配置**：

- 模型：Claude Sonnet（推理能力强）

- 温度：0.7（需要创造性发散）

- 最大输出 token：4000

**输入 Schema**：

```typescript
interface TopicAnalysisInput {
  keyword: string;
  userContext?: string; // 用户提供的额外上下文
  excludeDirections?: string[]; // 用户排除的方向
}
```

**输出 Schema**：

```typescript
interface TopicAnalysis {
  keyword: string;
  subTopics: Array<{
    name: string;
    description: string;
    heatLevel: 'high' | 'medium' | 'low';
  }>;
  painPoints: Array<{
    description: string;
    targetAudience: string;
    emotionalTrigger: string;
  }>;
  trendingAngles: Array<{
    angle: string;
    whyTrending: string;
    suitablePlatforms: string[];
  }>;
  controversies: Array<{
    topic: string;
    sideA: string;
    sideB: string;
  }>;
  targetDemographics: Array<{
    group: string;
    interests: string[];
    contentPreferences: string[];
  }>;
}
```

### Step 2: 三平台选题分配 (topic-assignment)

**目的**：从 Step 1 的素材池中，为三个平台分别选定最优且差异化的切入角度

**LLM 调用配置**：

- 模型：Claude Sonnet

- 温度：0.6

- 最大输出 token：4000

- 上下文注入：三个平台的策略文件（`strategies/wechat.md` 等）

**输入**：Step 1 的 `TopicAnalysis` 输出

**输出 Schema**：

```typescript
interface PlatformAssignments {
  wechat: TopicCard;
  xiaohongshu: TopicCard;
  douyin: TopicCard;
  overlapAnalysis: string; // 说明三个选题的差异化程度
}

interface TopicCard {
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  angle: string;
  titleDrafts: string[]; // 3个候选标题
  coreArgument: string;
  targetAudience: string;
  tone: string;
  wordCountRange: [number, number];
  contentType: string; // 如 "深度分析"、"干货清单"、"口播脚本"
  emotionalGoal: string;
}
```

**关键 Prompt 指令**：

- 三个平台的角度重合度不超过 30%

- 每个平台的选题必须契合该平台的内容生态和用户习惯

- 标题草案必须符合各平台的标题风格

### Step 3: 大纲生成 (outline-generation)

**三路并行执行**，每路使用不同的平台策略 prompt。

**公众号大纲输出 Schema**：

```typescript
interface WechatOutline {
  hook: {
    technique: string; // 如 "反常识开头"、"故事开头"、"数据冲击"
    content: string;
  };
  sections: Array<{
    title: string;
    purpose: string;
    keyPoints: string[];
    caseSlot: string; // 案例位置标记，描述需要什么类型的案例
    wordCount: number;
    emotionTarget: string;
  }>;
  conclusion: {
    type: string; // 如 "认知升级"、"行动号召"、"金句收尾"
    direction: string;
  };
  estimatedTotalWords: number;
}
```

**小红书大纲输出 Schema**：

```typescript
interface XiaohongshuOutline {
  persona: {
    identity: string; // 如 "工作3年的互联网运营"
    credibilityHook: string; // 如 "从月薪8k到3w"
  };
  tips: Array<{
    title: string; // 带 emoji
    content: string;
    actionable: string; // 读者今天就能做的事
  }>;
  closingHook: string; // 引导收藏/关注的金句
  hashtags: string[];
  estimatedTotalWords: number;
}
```

**抖音大纲输出 Schema**：

```typescript
interface DouyinOutline {
  hook3s: {
    technique: string; // 如 "反常识"、"冲突"、"提问"
    script: string; // 前3秒的具体台词
  };
  corePoint: {
    statement: string;
    analogy: string; // 用一个类比解释
  };
  miniCase: string; // 极简案例（1-2句话）
  closingPunch: string; // 金句收尾
  interactionGuide: string; // 引导互动的话术
  estimatedTotalWords: number;
}
```

### Step 4: 素材检索 (material-search) 【可选】

**三路并行执行**。

**处理逻辑**：

1. 从大纲中提取需要素材支撑的论点

2. 为每个论点生成 1-2 个搜索查询

3. 调用搜索 API 获取结果

4. 用 LLM 从搜索结果中提取有用的数据、案例、引用

5. 去重：确保三个平台的素材不重复

**输出 Schema**：

```typescript
interface MaterialCollection {
  platform: string;
  materials: Array<{
    forSection: string; // 对应大纲的哪个部分
    type: 'data' | 'case' | 'quote' | 'story';
    content: string;
    source: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
}
```

### Step 5: 全文生成 (content-generation)

**三路并行执行**，每路使用不同的写作人格 System Prompt。

**LLM 调用配置**：

- 温度：0.8（需要创造性表达）

- 最大输出 token：8000

**关键 Prompt 设计**：

- System Prompt 定义写作人格（详见 PROMPT_TEMPLATES.md）

- User Prompt 包含：选题卡片 + 大纲 + 素材（如有）

- 明确指令：严格按照大纲结构写作，不要遗漏任何部分

**输出**：Markdown 格式的完整文章文本

### Step 6: 审校优化 (review-optimization)

**三路并行执行**。

**LLM 调用配置**：

- 温度：0.4（审校需要精确性）

- 最大输出 token：8000

**审校维度**：

```typescript
interface ReviewResult {
  revisedContent: string; // 修改后的全文
  titleOptions: string[]; // 5个优化后的标题候选
  recommendedTitle: string;
  qualityScore: {
    titleAttraction: number;    // 1-10
    hookRetention: number;      // 1-10
    contentValue: number;       // 1-10
    emotionalEngagement: number;// 1-10
    interactionDesign: number;  // 1-10
  };
  changes: Array<{
    location: string;
    original: string;
    revised: string;
    reason: string;
  }>;
  platformCompliance: {
    wordCountOk: boolean;
    sensitiveWordsFound: string[];
    formatOk: boolean;
  };
}
```

---

## 2. 场景 B 各步骤详细设计

### Step 1: 爆款解构分析 (viral-deconstruction)

**LLM 调用配置**：

- 温度：0.3（分析需要精确性）

- 最大输出 token：6000

**输出 Schema**：

```typescript
interface ViralGenome {
  topicStrategy: {
    painPoint: string;
    emotionalTrigger: string;
    targetAudience: string;
    whyItWorks: string;
  };
  narrativeStructure: Array<{
    sectionIndex: number;
    purpose: string; // 如 "制造悬念"、"定义问题"、"提供方案"
    wordRatio: number; // 占总篇幅的比例
    emotionMark: string; // 如 "焦虑"、"好奇"、"释然"、"振奋"
    technique: string; // 使用的写作技巧
  }>;
  hookTechnique: {
    type: string;
    mechanism: string; // 为什么这个钩子有效
    template: string; // 抽象出的钩子模板
  };
  emotionCurve: Array<{
    position: number; // 0-100 表示文章位置百分比
    emotion: string;
    intensity: number; // 1-10
  }>;
  powerSentences: Array<{
    original: string;
    structure: string; // 句式结构分析
    whyPowerful: string;
  }>;
  viralFactors: string[];
  contentDensityScore: number; // 1-10
  estimatedReadTime: string;
}
```

### Step 2: 差异化方向生成 (differentiation)

**输出 Schema**：

```typescript
interface DifferentiationDirection {
  name: string;
  perspectiveShift: string;
  audienceShift: string;
  contentShift: string;
  newAngle: string;
  sampleTitle: string;
  differentiationScore: number; // 1-10
  feasibilityScore: number; // 1-10
  compositeScore: number; // diff * 0.6 + feasibility * 0.4
}

interface DifferentiationOutput {
  directions: DifferentiationDirection[];
  selectedDirection: DifferentiationDirection; // 自动选择 compositeScore 最高的
  selectionReason: string;
}
```

### Step 3: 新大纲生成 (new-outline)

**⚠️ 关键约束**：输入中只包含 ViralGenome 的 `narrativeStructure` 和 `emotionCurve`，不包含原文全文。

**输出 Schema**：

```typescript
interface NewOutline {
  sections: Array<{
    correspondingOriginalIndex: number; // 对应原文结构的第几段
    originalPurpose: string; // 原文该段的目的
    newContent: {
      argument: string; // 新论点
      caseDirection: string; // 新案例方向
      expressionStyle: string; // 新的表达方式
    };
    wordRatio: number;
    emotionTarget: string;
  }>;
  newHookDesign: {
    technique: string;
    draft: string;
  };
  newClosingDesign: {
    technique: string;
    direction: string;
  };
}
```

### Step 4: 全文生成 (content-generation)

**⚠️ 关键约束**：上下文中不包含原文全文。只传入：

- ViralGenome 的 `narrativeStructure` + `emotionCurve`（结构和节奏参考）

- NewOutline（内容指导）

- 选定的 DifferentiationDirection（方向参考）

**Prompt 中的明确禁止指令**：

- 禁止复用原文的任何完整句子

- 禁止使用相同的案例和数据

- 禁止使用相同的比喻和类比

- 必须形成独立的语言风格和节奏

### Step 5: 双重审查 (dual-review)

**此步骤需要原文全文**（用于对比）。

**审查 A — 原创度审查输出**：

```typescript
interface OriginalityReport {
  overallScore: number; // 1-10, 10为完全原创
  flaggedParagraphs: Array<{
    paragraphIndex: number;
    recreationText: string;
    similarOriginalText: string;
    similarityType: 'expression' | 'structure' | 'example' | 'metaphor';
    severity: 'high' | 'medium' | 'low';
  }>;
  passThreshold: boolean; // overallScore >= 8 且无 high severity
}
```

**审查 B — 爆款潜力评估输出**：

```typescript
interface ViralPotentialReport {
  scores: {
    titleAttraction: number;
    hookRetention: number;
    contentValue: number;
    emotionalEngagement: number;
    interactionDesign: number;
  };
  comparisonWithOriginal: {
    originalScores: typeof scores;
    recreationScores: typeof scores;
    improvements: string[];
    regressions: string[];
  };
  optimizationSuggestions: string[];
}
```

**条件回环逻辑**：

```typescript
// 伪代码
if (originalityReport.flaggedParagraphs.length > 0) {
  // 回到 Step 4，仅重写标记段落
  rewriteFlaggedParagraphs(flaggedParagraphs, newOutline);
  // 再次执行 Step 5 审查
  // 最多循环 3 次
}
```

---

## 2.5 场景 A 短文子模式数据流 (--short)

```plaintext
keyword: "AI取代工作"
    │
    ▼
[Step1: topic-analysis]
    │ output: TopicAnalysis
    ▼
[Step2: short-angle-selection]
    │ 从 TopicAnalysis 中选最能引发共鸣的角度
    │ 确定钩子策略（悬念/共鸣/反常识/数据冲击）
    │ output: ShortAngle { angle, hookStrategy, emotionalCore, targetAudience }
    ▼
[Step3: short-content]
    │ 生成 200-500 字短文
    │ 风格约束：接地气、不说教、金句洞察、口语化
    │ output: ShortContent { title, content, wordCount, hookType, goldenSentence }
    ▼
[Step4: short-review]
    │ 5维评分：情绪共鸣度/传播力/钩子强度/接地气/金句密度
    │ 风格检测：isPreachy(说教)、isColloquial(口语化)
    │ output: ShortReview { scores, styleFlags, suggestions[], approved }
    ▼
FinalOutput
```

**关键约束**：跳过 topic-assignment、outline、material-search、per-platform content/review。4步串行，无并行组。

---

## 2.6 场景 D 观点输出数据流 (--opinion)

```plaintext
keyword / opinion text: "远程办公才是未来"
    │
    ▼
[Step0: topic-analysis]  ← 复用现有 topic-analysis
    │ output: TopicAnalysis
    ▼
[Step0.5: opinion-refine]  ← 新增，内联 OpinionRefineStep
    │ 输入：{ opinion: keyword }
    │ HKR 质检（H=热度/K=知识密度/R=可反驳性）+ 证伪 + 锤炼论点 + 推荐标题
    │ output: RefinedOpinion
    │ context key: 'refined-opinion'
    ▼
[Step1: topic-assignment]  ← 标准 create 流程继续
    │ output: PlatformAssignments
    ▼
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
[Step3: outline]   [Step3: outline]   [Step3: outline]
    ...                ...                ...
    ▼                  ▼                  ▼
[Step6: review]    [Step6: review]    [Step6: review]
    ▼                  ▼                  ▼
    └──────────────────┴──────────────────┘
                       │
                       ▼
                 FinalOutput
```

**触发方式**：
- `contentforge create -k "远程办公才是未来" --opinion`（显式 flag）
- `contentforge opinion -k "远程办公才是未来"`（向后兼容别名，等同于 --opinion）
- 交互模式：disambiguation TUI 选择"观点输出"

**Disambiguation TUI** (`src/cli/ui/disambiguation.ts`)：在 topic-analysis 完成后、topic-assignment 之前，问用户"🎯 观点输出 / 🔍 探索生成"。选"观点"触发 opinion-refine，选"探索"跳过。

---

## 2.7 观点 Refine 步骤详细设计

**目的**：将用户的观点打磨成有论据支撑、有标题推荐的 RefinedOpinion

**LLM 调用配置**：
- 温度：0.7
- 最大输出 token：4000

**输出 Schema**：

```typescript
interface RefinedOpinion {
  originalOpinion: string;           // 用户原始观点
  refinedThesis: string;             // 锤炼后的论点
  type: 'comparison' | 'causal' | 'judgment';  // 观点类型
  evidence: string[];                // 支撑论据
  counterArguments: string[];        // 反面论据
  boundaries: string;                // 适用范围
  whyNow: string;                    // 为什么现在说
  hkrScore: {
    h: number;  // 热度 0-100
    k: number;  // 知识密度 0-100
    r: number;  // 可反驳性 0-100
  };
  recommendedTitles: string[];       // 推荐标题
}
```

**HKR 质检维度**：
- **H (热度)**：这个话题现在有多热？有多少人在讨论？
- **K (知识密度)**：你的观点里有多少是别人不知道的？
- **R (可反驳性)**：你的观点有多容易被反驳？（越容易被反驳=越有争议性=越有讨论价值）

---

## 3. 输出校验与错误处理

### 3.1 Zod Schema 校验

每个步骤的输出必须通过 Zod schema 校验：

```typescript
import { z } from 'zod';

// Step 1 输出校验
const TopicAnalysisSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(z.object({
    name: z.string(),
    description: z.string(),
    heatLevel: z.enum(['high', 'medium', 'low']),
  })).min(10).max(15),
  painPoints: z.array(z.object({
    description: z.string(),
    targetAudience: z.string(),
    emotionalTrigger: z.string(),
  })).min(5).max(8),
  // ... 其他字段
});

// 在 Step 中使用
class TopicAnalysisStep extends PipelineStep {
  validateOutput(output: unknown): TopicAnalysis {
    return TopicAnalysisSchema.parse(output);
  }
}
```

### 3.2 校验失败处理

```typescript
async execute(input: unknown, context: PipelineContext): Promise<stepresult> {
  let attempt = 0;
  const maxAttempts = 2;
  
  while (attempt < maxAttempts) {
    const llmOutput = await this.callLLM(input);
    
    try {
      const validatedOutput = this.validateOutput(llmOutput);
      return { success: true, data: validatedOutput };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // 提取缺失字段
        const missingFields = error.errors.map(e => e.path.join('.'));
        
        if (attempt < maxAttempts - 1) {
          // 重试，在 prompt 中追加格式提醒
          input = this.addValidationHint(input, missingFields);
          attempt++;
          continue;
        } else {
          // 最后一次尝试失败，记录警告并使用部分数据
          logger.warn(`Step ${this.config.name} output validation failed`, error);
          return { success: true, data: llmOutput, warning: 'Partial validation failure' };
        }
      }
    }
  }
}
</stepresult>
```

---

## 4. 平台策略注入机制

### 4.1 策略文件结构

```markdown
<!-- src/strategies/wechat.md -->

# 公众号内容策略

## 用户画像
- 年龄：25-45岁为主
- 场景：通勤、睡前、碎片时间
- 阅读习惯：愿意花 5-10 分钟深度阅读
- 期望：获得有深度的洞察或实用的知识

## 内容偏好
- 深度 > 广度：宁可一个点讲透，不要蜻蜓点水
- 故事化表达：抽象概念要用故事/案例具象化
- 逻辑清晰：有明确的论证主线
- 有温度：理性分析中穿插人文关怀

## 最佳实践
- 标题：15-25字，包含数字/疑问/反常识中的至少一个
- 开头：前 3 句话决定读者是否继续，必须抓人
- 结构：钩子 → 问题 → 分析 → 案例 → 升华 → 启示
- 字数：2000-3000 字最佳
- 段落：每段不超过 5 行，避免大段文字

## 敏感词/限流词
- 政治敏感词：[具体列表]
- 医疗健康类：避免绝对化表述（"治愈"、"根除"等）
- 金融投资类：避免收益承诺

## 互动引导
- 文末引导：转发/在看/点赞
- 评论区引导：提出开放式问题
```

### 4.2 策略注入方式

```typescript
// 在 Step 2 中注入平台策略
class TopicAssignmentStep extends PipelineStep {
  async execute(input: TopicAnalysis, context: PipelineContext): Promise<stepresult> {
    // 加载三个平台的策略文件
    const wechatStrategy = await fs.readFile('src/strategies/wechat.md', 'utf-8');
    const xhsStrategy = await fs.readFile('src/strategies/xiaohongshu.md', 'utf-8');
    const douyinStrategy = await fs.readFile('src/strategies/douyin.md', 'utf-8');
    
    // 渲染 prompt，将策略注入到变量中
    const systemPrompt = this.promptLoader.render('create/step2-topic-assignment.system', {
      wechatStrategy,
      xiaohongshuStrategy: xhsStrategy,
      douyinStrategy,
    });
    
    const userPrompt = this.promptLoader.render('create/step2-topic-assignment.user', {
      topicAnalysis: JSON.stringify(input, null, 2),
    });
    
    // 调用 LLM
    const response = await this.llmProvider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      maxTokens: 4000,
    });
    
    return { success: true, data: JSON.parse(response.content) };
  }
}
</stepresult>
```

---

## 5. Token 用量统计

每个步骤执行完毕后，记录 token 用量：

```typescript
interface StepResult<t =="" unknown=""> {
  success: boolean;
  data?: T;
  error?: string;
  tokenUsage: {
    input: number;
    output: number;
  };
  durationMs: number;
}

// 在 Pipeline 执行完毕后汇总
class PipelineContext {
  getTotalTokenUsage() {
    let totalInput = 0;
    let totalOutput = 0;
    
    for (const [stepName, result] of this.stepResults.entries()) {
      totalInput += result.tokenUsage.input;
      totalOutput += result.tokenUsage.output;
    }
    
    // 成本估算（以 Claude Sonnet 为例）
    const inputCost = (totalInput / 1_000_000) * 3.0;  // $3/MTok
    const outputCost = (totalOutput / 1_000_000) * 15.0; // $15/MTok
    const estimatedCost = inputCost + outputCost;
    
    return { input: totalInput, output: totalOutput, estimatedCost };
  }
}
</t>
```