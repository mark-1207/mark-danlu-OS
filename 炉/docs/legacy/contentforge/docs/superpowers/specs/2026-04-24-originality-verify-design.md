# 原创度双层防御 — 设计文档

> 日期：2026-04-24
> 状态：待批准

## 背景

当前 recreate pipeline 的原创度保障存在薄弱点：
- 生成时没有风格锚定，碎片选择靠 keyword 匹配而非语义相似度
- 生成后只有 case/data 的 embedding 检查（0.85 阈值偏宽）
- 没有金句级保护
- 全篇重写而不是精准段落替换

## 目标

双层防御 + 精准定位替换：
- 生成前过滤相似碎片（来源：原文要素 vs 碎片库）
- 生成后 flag 问题段落（来源：原文要素 vs 生成内容逐段）
- 用户 TUI 选要替换哪个 → LocalRewriteStep 只改那段

## 阈值

- 相似度阈值：**0.80**
- 循环策略：**不限次数**，用户选哪个换哪个，直到满意

---

## 数据结构

### ViralGenomeSchema 扩展

```typescript
// 在 viral-deconstruction 时提取并预计算 embedding
goldQuotes: Array<{
  id: string
  text: string           // 金句原文
  embedding: number[]   // 预计算 embedding（Tavily）
  position: string      // 在原文中的位置描述
}>
```

### Embedding 预计算策略（混合）

- **常见类型预计算**：开头类型、句式结构对应的 embedding 在 learn/viral-deconstruction 时算好写入 ViralGenome
- **实时计算**：非预计算的要素，在 recreate 时实时调 Tavily API 算 embedding

---

## 双层防御

### 第一层：生成前过滤

**触发时机**：recreate 的 `content-generation` 选碎片时

**流程**：
1. 从 ViralGenome 取 `caseStudies` + `keyDataPoints` + `goldQuotes`（含预计算 embedding）
2. 从碎片库（fragment-library.json）拉候选句式/金句
3. 每个碎片的 text 做 embedding，然后和原文三个要素包的 embedding 分别做 cosine similarity
4. 任何一项 similarity > 0.80 的碎片 → 过滤掉
5. 通过的碎片 + 原文要素 embedding → 一起注入生成 prompt

**关键代码位置**：`src/scenarios/recreate/steps/content-generation.ts` 的 `doExecute`

### 第二层：生成后校验

**触发时机**：dual-review 步骤

**现有逻辑扩展**：
- case/data 的 embedding 相似度检查（已有，阈值从 0.85 调整为 0.80）
- **新增**：goldQuotes 也加入 embedding 相似度检查
- **新增**：检查对象改为生成内容**逐段**和原文各要素比对（不只是全文）

**输出格式**：
```typescript
flaggedElements: Array<{
  type: 'caseStudy' | 'keyDataPoint' | 'goldQuote'
  id: string
  originalText: string        // 原文要素内容
  matchedText: string        // 生成内容中相似的段落
  similarity: number          // 0~1
  paragraphIndex: number      // 在生成内容中的段落位置
}>
```

---

## TUI 精确定位替换

**流程**：
1. dual-review 输出 `flaggedElements` 写入 run context
2. CLI 层读取 flag，在 TUI 展示：
   ```
   ❌ 案例 [id=cs_1] 相似度 0.87
      原文："外卖小哥每天跑12小时，月入过万"
      生成："骑手每天工作14小时，月收入破万"

   ❌ 数据 [id=dp_3] 相似度 0.83
      原文："2024年应届生就业率仅62%"
      生成："去年应届生就业率只有64%"
   ```
3. 用户输入要替换哪个（如 `1,3`）
4. 选中的要素 → `LocalRewriteStep` 只重写生成内容中对应段落
5. 重写后继续展示剩余 flag，用户可以继续选或退出

**注意**：TUI 替换流程在 dual-review 之后、local-rewrite 之前执行，不走 pipeline 的自动循环

---

## 改动范围

| 文件 | 改动 |
|------|------|
| `src/scenarios/recreate/types.ts` | ViralGenomeSchema + goldQuotes 字段 |
| `src/prompts/templates/recreate/viral-deconstruction.system.md` | 金句提取指令 |
| `src/scenarios/recreate/steps/content-generation.ts` | 生成前 embedding 过滤 |
| `src/scenarios/recreate/steps/dual-review.ts` | goldQuote 检查 + 逐段检查 + 阈值 0.80 |
| `src/cli/commands/recreate.ts` | TUI flag 展示 + 用户选择 + 调用 LocalRewriteStep |
| `src/utils/embedding.ts` | 可能需要 `computeTextEmbedding` 工具函数 |
| `src/fragment-library/fragment-loader.ts` | 碎片选择时加载原文要素 embedding 做过滤 |

---

## 依赖

- Tavily API（embedding 计算）
- LocalRewriteStep（已有，只改调用方式）
- style-profile 传入 context（本次不包含，在另一个 spec 里处理）
