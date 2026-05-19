# 内容反馈系统开发计划

## 项目：ContentForge 内容认知反馈系统（CCOS-F）

---

## 一、系统定位与范围

### 最终目标
基于真实用户行为数据，持续优化内容认知系统——不是统计「哪个数据高」，而是溯因「为什么会高」，最终形成内容创作的学习闭环。

### 当前阶段
阶段一：数据采集基础设施 + 基础统计分析

### 不在当前范围内（条件不成熟，暂缓）
- 认知标签提取（依赖评论数据）
- 竞品认知机制分析（依赖竞品用户行为数据）
- Insight 注入 create（样本量不足，结论不可信）
- AI Agent 工作流（全链路数据后再说）

---

## 二、功能价值与定位速查表

| 功能 | 价值 | 定位 | 依赖条件 | 联动模块 |
|------|------|------|----------|----------|
| 反馈数据表 | 数据采集入口 | 基础设施 | 飞书表已建 | learn CLI、竞品表 |
| learn --feedback-summary | 发现我方内容高低因素 | 分析工具 | 反馈记录 >10条 | 反馈表、竞品表 |
| learn --feedback-compare | 找到与竞品的标签级差距 | 分析工具 | 反馈记录 + 竞品分析记录 | 反馈表、竞品表 |
| 竞品分析报告（人读版） | 发现竞品高表现规律 | 分析工具 | 竞品 analyzed/stored 记录 | 竞品表、Obsidian |
| 反馈表文章ID字段 | 同一文章跨周期纵向追踪 | 数据结构 | 无 | 反馈表、时序分析 |
| 认知标签提取（Phase2） | 把数字翻译成认知语言 | 进阶分析 | 评论数据获取 + 反馈 >50条 | 反馈表、评论解析 |
| Insight 注入 create（Phase3） | 让分析结论影响下次创作 | 应用层 | 反馈 >50条 + 认知标签完成 | create pipeline、insight库 |
| 竞品认知机制提取（Phase2） | 理解竞品触发了什么认知反应 | 进阶分析 | 竞品评论数据 | 竞品表、评论解析 |

---

## 三、开发任务分阶段拆解（最小粒度）

### Phase 1-1：反馈数据表结构优化

**任务**：在反馈数据表加「文章ID」字段，同一文章按 7日/14日/30日 追加新行

**操作**：飞书手动加字段（CLI 创建）

**验证**：`learn --feedback-summary` 能按文章聚合多周期数据

**文件**：无代码变更，数据在飞书

---

### Phase 1-2：竞品分析报告 CLI（人读版）

**任务**：实现 `learn --include-competitor` 输出完整 Markdown 报告到 Obsidian

**报告结构**（Section 0-5 + 附）：
- Section 0：核心发现一句话
- Section 1：市场格局（竞品 vs 我方位置）
- Section 2：高表现规律（结构/调性/角度/标签/标题）
- Section 3：差距缺口（我方 vs 竞品）
- Section 4：关键洞察（可行动的判断）
- Section 5：下一步行动（优先级排序）
- 附：数据来源说明

**代码变更**：
- 修改 `src/scenarios/topic/competitor-style-report.ts`
- 报告写入 `output/corpus/竞品库/竞品分析报告-{date}.md`
- 同步复制到 Obsidian `竞品库/`

**依赖**：竞品表有 analyzed 记录（≥3条）

**验证**：`learn --include-competitor` 输出报告，内容覆盖所有 Section

---

### Phase 1-3：竞品表叙事结构/情感调性/内容角度字段回填

**任务**：对竞品表已有 analyzed 记录，补填叙事结构/情感调性/内容角度（历史数据）

**代码变更**：在 `src/scenarios/topic/feishu-analyze.ts` 加 `--backfill` 选项，或新写 `backfill-analysis.ts`

**逻辑**：读取所有 analyzed 记录，调用 LLM 补填缺失字段，回写飞书

**验证**：竞品表所有 analyzed 记录均有叙事结构/情感调性/内容角度

---

### Phase 1-4：反馈数据时序聚合函数

**任务**：扩展 `analyzer.ts` 的 `computeFeedbackStats()` 支持按「文章ID + 周期」聚合

**目的**：追踪同一文章 7日→14日→30日 趋势，识别爆发力和长尾力

**代码变更**：
- `FeedbackStats` 加 `byArticle` 字段：`Record<文章ID, { byPeriod: PeriodStats[], trend: 'rising'|'declining'|'stable' }>`
- 新函数：`computeTimeSeriesStats(records)` 计算每篇文章的趋势

**验证**：同一文章多周期记录能正确聚合，趋势判断符合预期

---

### Phase 2-1：认知标签提取

**任务**：`learn --feedback-cognitive` 识别评论中的高传播观点类型

**输入**：用户手工提供评论文本（或从平台后台导出）

**输出**：认知标签（身份认同型/反直觉型/焦虑型/清醒型/共鸣型）

**代码变更**：新文件 `src/scenarios/feedback/cognitive-tagger.ts`

**依赖**：评论数据来源确认 + 反馈记录 >50条

**验证**：输入 10 条评论文本，输出标签分类结果合理

---

### Phase 2-2：竞品认知机制分析

**任务**：在竞品分析报告中加入「认知模式」Section（从文章结构/评论倒推）

**输入**：竞品文章文本 + 评论文本

**输出**：竞品高传播的认知机制描述

**代码变更**：修改 `competitor-style-report.ts` 增加认知分析模块

**依赖**：Phase 2-1 完成（认知标签体系建立）

---

### Phase 3-1：内容认知档案（Insight 库）

**任务**：`learn --competitor-insights` 输出 `output/competitor-insights.json`

**结构**：
```json
{
  "{标签}": {
    "priorityStructure": "对比型",
    "priorityTone": "励志",
    "priorityAngle": "普通人逆袭",
    "weakSignal": "...",
    "lastUpdated": "2026-05-18",
    "confidence": "high|medium|low",
    "sampleSize": 15
  }
}
```

**注入策略**：仅当样本量 ≥20 时写入，confidence = sampleSize / 50（≥20 = high）

**验证**：`learn --competitor-insights` 输出正确的 JSON 文件

---

### Phase 3-2：Create Pipeline 读取 Insight（软参考）

**任务**：在 `topic-assignment.ts` 或 `outline-generation.ts` 读取 `competitor-insights.json`，生成大纲时附带洞察建议（打印到 console，不硬约束）

**注入方式**：
- 用户运行 `create -k "职场加薪"` 时，系统读取匹配标签的 insight
- console 输出：`[Insight] 职场标签优先用对比型结构，避免纯理论分析`
- 不修改 create 的业务逻辑，只追加参考信息

**验证**：运行 create 时 console 有 insight 输出，内容与历史分析结论一致

---

### Phase 3-3：应用结果追踪（闭环验证）

**任务**：在反馈表加「应用洞察」字段（手动填写：是否应用了上期 insight），下一期 `--feedback-compare` 输出 insight 应用效果对比

**代码变更**：反馈表加字段 + `compareWithInsight()` 函数

**验证**：应用 insight 的文章 vs 未应用的，平均互动是否有差异

---

## 四、任务依赖关系图

```
Phase 1-1（反馈表结构）          Phase 1-3（竞品历史回填）
    ↓                                 ↓
Phase 1-2（竞品报告CLI）←←←←←← Phase 1-3
    ↓
Phase 1-4（时序聚合）
    ↓
Phase 2-1（认知标签）            Phase 2-2（竞品认知分析）
         ↓                               ↓
         └────────→ Phase 3-1 ←←←←←←←←←┘
                   ↓
              Phase 3-2（create读insight）
                   ↓
              Phase 3-3（闭环追踪）
```

---

## 五、优先级排序

| 优先级 | 任务 | 理由 |
|--------|------|------|
| P1 | Phase 1-2（竞品报告CLI） | 用户确认有价值的核心产出，当前可实现 |
| P1 | Phase 1-3（竞品历史回填） | 为竞品报告提供数据基础，只需跑一遍 |
| P1 | Phase 1-1（反馈表文章ID） | 时序追踪的基础数据结构，影响后续所有分析 |
| P2 | Phase 1-4（时序聚合） | 追踪内容爆发力和长尾力的关键指标 |
| P2 | Phase 2-1（认知标签） | 把数字翻译成认知语言的核心能力 |
| P3 | Phase 2-2（竞品认知分析） | 竞品报告进阶，依赖 Phase 2-1 |
| P3 | Phase 3-1（Insight库） | 等数据量和数据质量成熟 |
| P3 | Phase 3-2（create读insight） | 依赖 Phase 3-1 |
| P3 | Phase 3-3（闭环追踪） | 依赖 Phase 3-1 和 3-2 |

---

## 六、当前可执行任务清单

只需今天确认后立即开始：

1. **Phase 1-2**：竞品分析报告 CLI（`learn --include-competitor` 输出完整报告）
2. **Phase 1-3**：竞品历史数据分析回填（对已有 analyzed 记录补填三个字段）
3. **Phase 1-1**：飞书反馈表加「文章ID」字段（用户手动操作）

---

## 七、工程架构图（Phase 1）

```
┌─────────────────────────────────────────────────────────┐
│  飞书多维表格                                            │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │  竞品素材库        │  │  反馈数据表        │          │
│  │  tblYTDnJZuHuiBNa │  │  tblG9CQPIvgpaIvY │          │
│  └────────┬─────────┘  └────────┬─────────┘          │
└──────────┼──────────────────────┼──────────────────────┘
           │                      │
     ┌─────▼──────┐        ┌─────▼──────┐
     │ lark-cli   │        │ lark-cli   │
     └─────┬──────┘        └─────┬──────┘
           │                      │
     ┌─────▼───────────┐    ┌─────▼───────────┐
     │ feishu-sync.ts  │    │feishu-feedback.ts│
     │ (读/写竞品表)    │    │  (读反馈表)      │
     └─────┬───────────┘    └─────┬───────────┘
           │                      │
     ┌─────▼──────────────┐ ┌─────▼──────────────┐
     │ feishu-analyze.ts  │ │   analyzer.ts       │
     │ (AI分析→补填字段)   │ │ (computeStats/     │
     │                    │ │  buildSignal/      │
     │                    │ │  findWeakPatterns) │
     └─────┬──────────────┘ └─────┬──────────────┘
           │                      │
     ┌─────▼──────────────┐ ┌───▼───────────────┐
     │ competitor-style-   │ │ learn --feedback-  │
     │ report.ts (改造)    │ │ summary / compare  │
     └─────┬──────────────┘ └───┬───────────────┘
           │                      │
     ┌─────▼──────────────┐      │
     │ learn --include-   │      │
     │ competitor         │      │
     └─────┬──────────────┘      │
           │                      │
     ┌─────▼──────────────────────▼─────────┐
     │  Obsidian                               │
     │  竞品库/竞品分析报告-{date}.md          │
     │  output/corpus/竞品库/                 │
     └───────────────────────────────────────┘
```

---

## 八、数据流（Phase 1 完整）

```
竞品文章
  ↓ (topic scrape)
竞品表（pending）
  ↓ (learn --analyze)
竞品表（analyzed）← 同时补填叙事结构/情感调性/内容角度
  ↓ (learn --include-competitor)
竞品分析报告 → Obsidian 竞品库/
  ↓
人读报告 → 人工决定创作策略
  ↓ (手动填反馈数据)
反馈表（文章ID + 各周期数据）
  ↓ (learn --feedback-summary)
我方分析报告（console）
  ↓ (learn --feedback-compare)
竞品 vs 我方差距分析（console）
  ↓
下一轮内容创作优化
```

---

## 九、待补充项（后续阶段）

以下功能已记录，不在当前开发计划中，等条件成熟后启动：

| 功能 | 价值 | 定位 | 依赖 | 联动 |
|------|------|------|------|------|
| 认知标签提取 | 把数字翻译成认知语言 | 进阶分析 | 评论数据 + 反馈>50条 | 反馈表→认知标签→insight |
| 竞品认知机制分析 | 理解竞品触发了什么认知反应 | 进阶分析 | 竞品评论数据 | 竞品表→认知机制→报告 |
| Insight 注入 create（软参考） | 让分析结论影响下次创作 | 应用层 | 反馈>50条 + 认知标签 | create pipeline→insight库 |
| 竞品认知档案 | 结构化洞察存储 | 数据层 | 认知标签完成 | insight库→create |
| 应用结果追踪闭环 | 验证 insight 应用效果 | 闭环验证 | 应用数据 | 反馈表→insight有效性 |

---

版本：v0.1
日期：2026-05-18
状态：待确认后启动 Phase 1-2