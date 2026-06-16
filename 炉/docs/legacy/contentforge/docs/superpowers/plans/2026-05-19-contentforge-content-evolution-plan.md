# ContentForge 内容进化系统提案

> 版本 v0.1 | 日期 2026-05-19 | 状态：提案待讨论

---

## 一、问题定义

### 当前缺失的能力

ContentForge 能生成内容、能修订内容、能保存内容，**但不会从自己的操作中学习**。

| 行为 | 产生数据 | 是否被利用 |
|------|----------|------------|
| 用户修订标题 | revision manifest 记录了改了什么 | ❌ 只保存，未分析 |
| 用户选择差异化方向 | 二创记录了方向偏好 | ❌ 只统计，未学习 |
| 竞品高互动 | 竞品表有结构/调性/角度/互动率 | ❌ 只做报告，未注入创作 |
| 我方发布后数据 | 反馈表有阅读/点赞/评论/转发 | ❌ 0记录，未形成闭环 |

**结果**：每次创作都是从零开始，不调用历史积累。

---

## 二、目标定义

### 最终目标

通过记录、分析、学习三个步骤，让 ContentForge 的创作能力**随使用次数增加而提升**。

### 中期目标（Phase 1-2）

```
修订记录 → 分析有效模式 → 注入创作偏好
反馈数据 → 识别高表现结构 → 调整生成策略
竞品分析 → 提取市场规律 → 补充创作盲区
```

### 远期目标（Phase 3）

```
学习结果 → 自动调整 prompt 权重 → 主动推荐创作方向
```

---

## 三、数据来源

### 3.1 修订行为数据

**来源**：`output/<runId>/revisions/manifest.json`

**可提取的信息**：

| 字段 | 内容 | 学习价值 |
|------|------|----------|
| selections | 用户选了哪些元素 | 什么元素最常被改 |
| userInstruction | 用户怎么描述修改 | 偏好什么风格/语气 |
| appliedTriggers | 实际改了什么 | 什么改法被最终采纳 |
| version 数 | 一个 run 被改了几轮 | 什么情况下需要多轮修改 |

**示例数据**：
```json
{
  "parentRunId": "create_xxx",
  "versions": [
    {
      "version": "v1",
      "userInstruction": "标题更有冲击力，hook 更短",
      "selections": [{"element": "title"}, {"element": "hook"}],
      "appliedTriggers": [
        { "element": "title", "action": "rewrite-title",
          "originalText": "AI不是电钻是筛子",
          "newText": "被AI筛掉的人：30岁后还有退路吗" }
      ]
    }
  ]
}
```

### 3.2 反馈数据

**来源**：飞书反馈表（tblG9CQPIvgpaIvY）

**可提取的信息**：

| 字段 | 内容 | 学习价值 |
|------|------|----------|
| 叙事结构 | 故事型/清单型/对比型/分析型 | 哪种结构互动率最高 |
| 情感调性 | 励志/冷静/温暖/犀利/幽默 | 哪种调性互动率最高 |
| 内容角度 | 切入角度 | 哪个角度互动率最高 |
| 标签 | 话题标签 | 哪个话题互动率最高 |
| 互动率 | (点赞+评论+转发)/阅读 | 综合质量指标 |

### 3.3 竞品数据

**来源**：飞书竞品表（tblYTDnJZuHuiBNa）

**可提取的信息**：

| 字段 | 内容 | 学习价值 |
|------|------|----------|
| 叙事结构 | 竞品偏好的结构 | 我方 vs 竞品差距 |
| 情感调性 | 竞品偏好的调性 | 我方 vs 竞品差距 |
| 内容角度 | 竞品偏好的角度 | 我方 vs 竞品差距 |
| 标签 | 竞品热门话题 | 市场热点 |
| 互动率 | 竞品表现基准 | 我方努力的标杆 |

---

## 四、学习维度

### 4.1 标题学习

**记录**：
- 改前标题 → 改后标题 → 是否被采纳
- 用户输入的修改指令

**分析**：
- 什么词/结构/长度被保留
- 改前 vs 改后的差异模式

**应用**：
- 生成标题时，优先使用被采纳过的改法
- 标记高采纳率的标题模式

### 4.2 Hook 学习

**记录**：
- 开头第一句 / 前三段的改法
- 用户说"hook更有冲击力" → 改了什么

**分析**：
- 好 hook 的共同特征（短句开头 / 场景切入 / 数字 / 反常识）
- 不同平台 hook 差异

**应用**：
- outline 生成时，优先使用有效 hook 结构
- 不同平台使用不同 hook 策略

### 4.3 结构学习

**记录**：
- 反馈表中哪种叙事结构互动率最高
- 竞品表中哪种叙事结构表现最好

**分析**：
- 结构与平台/话题/调性的交叉关系
- 我的有效结构 vs 竞品有效结构

**应用**：
- outline 生成时，优先推荐高互动率结构
- 不同话题推荐不同结构

### 4.4 调性学习

**记录**：
- 反馈表中哪种情感调性互动率最高
- 竞品中哪种调性表现最好

**分析**：
- 调性与受众/话题的匹配关系
- 我的偏好 vs 竞品偏好

**应用**：
- content 生成时，调性权重调整
- 不同受众推荐不同调性

### 4.5 案例学习

**记录**：
- 用户选择替换案例时，替换成了什么
- 什么类型的案例被保留

**分析**：
- 高互动文章的案例特征
- 有效案例的类型（普通人故事/名人故事/数据/实验）

**应用**：
- material-search 时，优先推荐有效案例类型
- 案例选择时，过滤无效类型

---

## 五、学习机制设计

### 5.1 三层学习架构

```
┌─────────────────────────────────────────┐
│           Layer 3：创作策略层            │
│   根据学到的模式，调整 prompt 权重      │
│   注入 creative preferences             │
└────────────────────┬────────────────────┘
                     ↑
┌─────────────────────────────────────────┐
│           Layer 2：模式提取层            │
│   从 revision/feedback/competitor       │
│   提取有效模式（规则 + 统计）           │
└────────────────────┬────────────────────┘
                     ↑
┌─────────────────────────────────────────┐
│           Layer 1：数据记录层            │
│   revision manifest + feedback +         │
│   competitor records                    │
└─────────────────────────────────────────┘
```

### 5.2 模式提取逻辑

**规则型模式**（确定性高）：
- "标题含数字" → 互动率 +X%
- "对比型结构" → 互动率 +X%
- "开头用场景" → hook 采纳率高

**统计型模式**（需要样本量）：
- 各结构的平均互动率
- 各调性的平均互动率
- 各角度的平均互动率

**阈值**：
- 样本量 < 10 条 → 只用规则型，不做统计推断
- 样本量 10-30 条 → 统计型参考，降低权重
- 样本量 > 30 条 → 统计型为主，规则型为辅

### 5.3 优先级策略

```
有效模式优先级：
1. 反馈数据（我方真实表现）> 竞品数据（外部参考）
2. 高互动样本 > 低互动样本
3. 近期数据 > 历史数据（时间衰减）
4. 大样本统计 > 小样本推断
```

---

## 六、应用机制设计

### 6.1 应用方式

| 应用点 | 方式 | 说明 |
|--------|------|------|
| **大纲生成** | 提示词权重调整 | 推荐高互动率结构/调性/角度 |
| **标题生成** | 候选排序提升 | 高采纳率模式优先出现 |
| **素材搜索** | 案例类型过滤 | 优先推荐有效案例类型 |
| **调性控制** | prompt 注入学到偏好 | 生成时使用学到的调性风格 |
| **智能优化** | 修订指令联想 | 根据上下文推荐常见改法 |

### 6.2 应用方式详解

**A. 创作偏好注入（creative-preferences）**

```json
// creative-preferences.json
{
  "title": {
    "effectivePatterns": [
      { "pattern": "含数字", "adoptionRate": 0.75 },
      { "pattern": "反常识", "adoptionRate": 0.68 }
    ],
    "lastUpdated": "2026-05-19",
    "confidence": "medium",
    "sampleSize": 12
  },
  "hook": {
    "effectivePatterns": [
      { "pattern": "场景开头", "adoptionRate": 0.82 },
      { "pattern": "短句开头", "adoptionRate": 0.71 }
    ],
    "lastUpdated": "2026-05-19",
    "confidence": "medium",
    "sampleSize": 8
  },
  "structure": {
    "preference": "对比型",
    "avgEngagement": 0.072,
    "sampleSize": 15,
    "confidence": "low"
  }
}
```

**B. 在创作流程中的应用点**

```
outline-wechat:
  读取 creative-preferences
    ↓
  当选择叙事结构时，权重调整：
    对比型权重 × 1.2
    清单型权重 × 0.9
    ↓
  生成时优先推荐对比型
```

```
topic-analysis:
  读取 tag performance
    ↓
  高互动标签提升权重
  低互动标签降低权重
```

### 6.3 强制约束（远期计划，记录在案）

| 阶段 | 应用方式 | 条件 |
|------|----------|------|
| Phase 1-2（当前） | 软提示 | 样本 < 30 条，只做提示 |
| Phase 3（计划） | 强制约束 | 样本 > 50 条 + 验证有效 + 人工确认 |

**强制约束的设计意图**：
- 当某模式被验证长期有效（> 50 条数据，> 80% 采纳率）时，可考虑从软提示升级为强制约束
- 具体做法：某类内容只生成特定结构/调性，移除其他选项
- 风险：一旦学错，无法兜底；内容趋同，失去创意
- **前置条件**：必须有明确的验证流程，人工确认模式有效后再升级

### 6.4 Manifest 扩展字段设计

**设计原则**：
- 写作是高度主观、细节密集的活动，同样的指令（"更有冲击力"）在不同文章中指代不同的具体改法
- 字段设计要记录"改了什么维度、为什么改、上下文是什么"，而不只是"改前vs改后"
- 加字段能知道"有效的是'具体+口语化+短'，不只是含数字"

**扩展字段设计**：
```json
{
  "learningMetadata": {
    "revisionTriggers": [
      {
        "element": "title",
        "instruction": "更有冲击力",
        "instructionDetail": "语气更狠/短句/加数字",  // AI 补充的细节推断
        "changeScope": "word/tone/length/structure",    // 改了什么维度
        "adopted": true,
        "platform": "wechat",
        "context": "二创/原创",                       // 来源上下文
        "feedbackTrigger": "self/他人反馈"            // 什么触发了这次修订
      }
    ]
  }
}
```

### 6.5 不做什么（暂缓）

| 暂缓 | 理由 |
|------|------|
| 自动修改 prompt 文件 | 小样本推断不可信，等 > 50 条再考虑 |
| 机器学习训练模型 | 样本量不足，数据质量不稳定 |
| 跨平台混合学习 | 各平台差异大，分开学更准确 |

---

## 七、数据流设计

```
【数据采集】
revision manifest  ──────────┐
feedback records ────────────┼──→ PatternAnalyzer
competitor records ──────────┘
        ↓
【模式分析】
PatternAnalyzer → effectivePatterns
        ↓
【策略更新】
UpdateStrategy → creative-preferences.json
        ↓
【创作应用】
skill "帮我写..." → outline-wechat
    ↓
读取 creative-preferences
    ↓
注入结构/调性/角度偏好
    ↓
生成内容
        ↓
review-wechat（质量审查）
        ↓
修订 / 保存
        ↓
新数据 → 回到【数据采集】
```

---

## 八、实现方案

### Phase 1：数据记录层（Manifest 扩展）

**决策**：直接从扩展 manifest 字段采集完整学习数据，不做反推。

**任务 1**：扩展 revision manifest 数据结构（见 6.4 节设计）

**任务 2**：修改 `RevisionPipeline`，在每次修订确认时写入 `learningMetadata` 字段

```typescript
interface PatternRecord {
  type: 'title' | 'hook' | 'structure' | 'tone' | 'angle' | 'case';
  pattern: string;
  source: 'revision' | 'feedback' | 'competitor';
  engagementRate?: number;
  adoptionRate?: number;
  count: number;
}

export function analyzePatterns(records: {
  revisions: RevisionManifest[];
  feedbacks: FeedbackRecord[];
  competitors: FeishuRecord[];
}): PatternRecord[]
```

**任务 3**：新增 `src/scenarios/learning/creative-preferences.ts`

```typescript
export function loadCreativePreferences(): CreativePreferences
export function updateCreativePreferences(patterns: PatternRecord[]): void
export function applyPreferences(context: PipelineContext): void
```

### Phase 2：模式提取层

**任务 3**：新增 `src/scenarios/learning/pattern-analyzer.ts`

**任务 4**：新增 `src/scenarios/learning/creative-preferences.ts`

### Phase 3：创作应用层

**任务 5**：在 outline-wechat 注入偏好

**任务 6**：在 topic-analysis 注入标签偏好

### Phase 4：智能优化辅助

**任务 7**：修订时推荐常见改法

---

## 九、暂缓功能

| 功能 | 暂缓原因 |
|------|----------|
| 自动修改 prompt | 小样本不可信，Phase 3 再说 |
| 机器学习模型 | 数据量和质量不足 |
| 强制约束创作 | 导致内容趋同 |
| 跨平台学习 | 各平台差异大，暂不混用 |

---

## 十、已确认决策

| 问题 | 最终选择 | 理由 |
|------|----------|------|
| 学习结果存储 | **飞书表** | 多端同步，用户可手动调整 |
| Phase 1 数据层 | **扩展 manifest 加字段** | 记录完整上下文，能追溯因果 |
| 应用方式 | **软提示**（Phase 1-2），**强制约束**（Phase 3 远期计划） | 小样本期不用强制，等验证后再升级 |
| 学习粒度 | **分开学**（每平台独立） | 各平台差异大，混学容易误导 |

**强制约束远期条件**：
- 样本 > 50 条 + 某模式 > 80% 采纳率 + 人工确认模式有效
- 记录在 6.3 节

---

## 十一、版本与状态

| 版本 | 日期 | 状态 |
|------|------|------|
| v0.1 | 2026-05-19 | 提案 |
| v0.2 | 2026-05-20 | Phase 1-4 实现完成 ✅ |