# ContentForge Topic Phase 3 — 竞品洞察注入选题

## 1. 目标与定位

**核心目标**：在 `create --keyword` 的 Step1（主题分析）中注入竞品数据，让 AI 生成子话题时具备市场视角——知道哪些角度已被竞品覆盖、哪些是空白机会。

**服务场景**：用户执行 `create --keyword "AI"` 时，Step1 自动读取飞书竞品素材库，AI 在同一次调用中完成主题分析 + 竞品聚合，用户在 TUI 确认前看到竞品洞察摘要。

---

## 2. 数据结构

### 2.1 Schema 扩展

```typescript
export const CompetitorInsightSchema = z.object({
  coveredAngles: z.array(z.object({
    angle: z.string(),
    sourceTitle: z.string(),
    platform: z.string(),
  })),
  opportunityAngles: z.array(z.object({
    angle: z.string(),
    whyOpportunity: z.string(),
  })),
  warning: z.string(),  // 整体差异化建议
});

export const TopicAnalysisSchema = z.object({
  keyword: z.string(),
  subTopics: z.array(SubTopicSchema).min(10).max(15),
  painPoints: z.array(PainPointSchema).min(5).max(8),
  trendingAngles: z.array(TrendingAngleSchema).min(5).max(8),
  controversies: z.array(ControversySchema).min(3).max(5),
  targetDemographics: z.array(TargetDemographicSchema).min(3).max(5),
  competitorInsights: CompetitorInsightSchema.optional(),  // 新增
});
```

### 2.2 竞品洞察结构说明

| 字段 | 含义 |
|------|------|
| `coveredAngles` | 竞品已覆盖的角度（标题 + 平台），提示用户差异化 |
| `opportunityAngles` | 竞品未覆盖的空白机会，AI 建议切入 |
| `warning` | 整体建议，如"以下角度已被竞品用烂，建议绕开" |

---

## 3. 流程设计

### 3.1 执行顺序

```
create --keyword "AI"
         │
         ▼
TopicAnalysisStep（单次 LLM 调用，同步完成）
  ├─ 查缓存（数据驱动过期）
  ├─ 读飞书竞品数据
  ├─ AI 聚合并追加到主题分析结果
  └─ 降级跳过
         │
         ▼
输出：TopicAnalysis（含 competitorInsights）
         │
         ▼
TUI 展示（追加在输出末尾）
用户确认后进入 Step2
```

### 3.2 单次调用设计

竞品聚合**不单独发起 LLM 调用**，而是在 `TopicAnalysisStep` 的 user prompt 末尾追加竞品素材，AI 在同一次输出中同时返回：
- 主题分析结果（subTopics / painPoints / trendingAngles 等）
- 竞品洞察（coveredAngles / opportunityAngles / warning）

优势：一次调用解决两个问题，无额外延迟。

---

## 4. 缓存策略

### 4.1 缓存路径

```
output/corpus/competitor-insights/{md5(keyword)}.json
```

### 4.2 过期条件

**数据驱动**：读取飞书表格所有记录的 `抓取时间`，取最新时间 `latestCrawlAt`。如果 `latestCrawlAt > cachedAt`，强制重刷。

### 4.3 缓存内容

```json
{
  "keyword": "AI",
  "cachedAt": "2026-04-28T12:00:00Z",
  "records": [ ... ],   // 读取的飞书记录（原始）
  "insights": { ... }   // AI 聚合结果
}
```

---

## 5. 飞书数据读取

### 5.1 筛选条件

读取 `状态` 为 `analyzed` 或 `stored` 的记录，即已完成 AI 分析的竞品。

### 5.2 传入 AI 的数据量

为控制 token 成本，单次传入最多 **10 条**竞品记录，按 `收藏 = true` 优先 + `抓取时间` 倒序。

### 5.3 传入字段

标题 / 选题角度 / 爆款结构 / 平台 / 收藏标记（原始链接不传入）。

---

## 6. Prompt 模板

### 6.1 系统 Prompt

不变，沿用现有 `topic-analysis.system.md`。

### 6.2 用户 Prompt 扩展

在现有 `topic-analysis.user.md` 末尾追加：

```markdown
{{#if competitorInsights}}
---
## 竞品参考素材

以下是系统中已有的竞品分析数据，供你参考差异化方向：

**竞品已覆盖角度**：
{{#each competitorInsights.coveredAngles}}
- [{{platform}}] {{angle}}（来源：{{sourceTitle}}）
{{/each}}

{{#if competitorInsights.opportunityAngles}}
**空白机会角度**：
{{#each competitorInsights.opportunityAngles}}
- {{angle}}：{{whyOpportunity}}
{{/each}}
{{/if}}

**差异化建议**：{{competitorInsights.warning}}
{{/if}}
```

---

## 7. TUI 展示

### 7.1 展示位置

竞品洞察以**追加文本**形式附在 Step1 分析结果末尾，用户在确认主题方向前自然看到。

### 7.2 展示内容（文本格式）

```
=== 竞品洞察 ===
⚠️ 以下角度已被竞品覆盖，建议差异化切入：
- [微信公众号] AI焦虑恐慌类（来源：AI时代的生存指南）

✨ 空白机会：
-职场人如何使用AI（为什么这个机会存在）

建议：避免同质化切入，优先考虑上述空白角度。
```

### 7.3 警告提示（无数据时）

```
⚠️ 竞品库暂无数据，跳过竞品洞察注入。
```

### 7.4 失败提示（AI 聚合失败时）

```
⚠️ 竞品洞察生成失败，跳过注入。流程继续。
```

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 飞书读取失败 | 警告提示，跳过 |
| AI 聚合失败 | 警告提示，跳过，流程继续 |
| 缓存写入失败 | 静默，不阻断 |
| 竞品库为空 | 警告提示"竞品库暂无数据"，正常输出 |

---

## 9. 实现清单

| 任务 | 说明 |
|------|------|
| 扩展 TopicAnalysisSchema | 新增 `competitorInsights` 字段 |
| 扩展 prompt 模板 | `topic-analysis.user.md` 末尾追加竞品素材变量 |
| 实现竞品读取 + 缓存逻辑 | `readFeishuRecords()` 筛选 + `competitor-insights/` 缓存读写 |
| 实现 Prompt 追加逻辑 | 读取飞书数据 → 格式化 → 追加到 user prompt |
| 实现 TUI 展示 | 在 topic-review TUI 中追加竞品洞察文本块 |
| 单元测试 | 缓存读写 / 飞书筛选 / Prompt 拼接 |

---

## 10. 文件结构

```
src/
├── scenarios/create/
│   ├── steps/
│   │   └── topic-analysis.ts     # 扩展：读飞书 + 追加竞品数据
│   └── types.ts                  # 扩展 TopicAnalysisSchema
├── scenarios/topic/
│   ├── feishu-sync.ts            # 复用现有 readFeishuRecords()
│   └── competitor-cache.ts       # 新增：缓存读写 + 过期判断
└── prompts/templates/create/
    └── topic-analysis.user.md   # 扩展：追加竞品素材变量

output/corpus/competitor-insights/
    └── {md5(keyword)}.json       # 缓存文件
```

---

## 11. 阶段依赖

- Phase 1 ✅：抓取 + AI 分析 + 写入飞书
- Phase 2 ✅：碎片提取 + 碎片库同步
- **Phase 3（本文）**：选题时读取飞书竞品数据 → AI 聚合 → 注入 TopicAnalysisStep
- Phase 4：风格学习基于抓取内容
- Phase 5：Decay 通知功能
