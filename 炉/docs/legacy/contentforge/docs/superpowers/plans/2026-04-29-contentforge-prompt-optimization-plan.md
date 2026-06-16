# LLM Prompt 优化计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精简 Prompt 模板体积，移除冗余内容，在不损伤输出质量的前提下节省 token 消耗。

**Architecture:** 
- JSON Schema 定义统一迁移到 `src/prompts/schemas/` 目录，作为常量引用
- user prompt 中的 Schema 描述改为"请严格遵循 TopicAnalysisSchema / PlatformAssignmentsSchema"
- viral-deconstruction system 只压缩解释性说明，保留推理引导（压缩 ≤20%）

**Tech Stack:** TypeScript + Node.js + prompt renderer

---

## File Map

```
src/prompts/
├── templates/
│   ├── create/
│   │   ├── topic-analysis.user.md        # 修改：移除 Schema，改为引用
│   │   └── topic-assignment.user.md      # 修改：移除 Schema，改为引用
│   └── recreate/
│       ├── viral-deconstruction.system.md  # 修改：压缩 ≤20%，保留推理引导
│       └── dual-review.user.md           # 修改：删除与 system 重复的说明
└── schemas/                              # 新增：Schema 常量目录
    ├── topic-analysis.schema.md
    └── topic-assignment.schema.md
```

---

## Task 1: JSON Schema 迁移 — topic-analysis

**Files:**
- Create: `src/prompts/schemas/topic-analysis.schema.md`
- Modify: `src/prompts/templates/create/topic-analysis.user.md`

**Steps:**

- [ ] **Step 1: 创建 topic-analysis.schema.md**

```markdown
# TopicAnalysisSchema

{
  "keyword": "string",
  "subTopics": [{ "name": "string", "description": "string", "heatLevel": "high|medium|low" }],
  "painPoints": [{ "description": "string", "targetAudience": "string", "emotionalTrigger": "string" }],
  "trendingAngles": [{ "angle": "string", "whyTrending": "string", "suitablePlatforms": ["string"] }],
  "controversies": [{ "topic": "string", "sideA": "string", "sideB": "string" }],
  "targetDemographics": [{ "group": "string", "interests": ["string"], "contentPreferences": ["string"] }],
  "competitorInsights": {
    "coveredAngles": [{ "angle": "string", "sourceTitle": "string", "platform": "string" }],
    "opportunityAngles": [{ "angle": "string", "whyOpportunity": "string" }],
    "warning": "string"
  }
}
```

- [ ] **Step 2: 修改 topic-analysis.user.md，移除 Schema 段落**

将文件末尾的 JSON Schema 段落（从第13行 `"keyword": "string"` 到第21行 `]`）替换为：

```markdown
请按照要求输出 JSON 格式的分析结果。必须严格遵循 TopicAnalysisSchema（见 schemas/topic-analysis.schema.md）。
```

- [ ] **Step 3: 验证渲染正确**

Run: `cd "D:/myproject/内容系统v1/contentforge" && node -e "import('./src/prompts/renderer.js').then(m => { const r = m.renderPrompt('必须严格遵循TopicAnalysisSchema', {}); console.log(r.includes('TopicAnalysisSchema') ? 'OK' : 'FAIL'); })"`

- [ ] **Step 4: Commit**

```bash
git add src/prompts/templates/create/topic-analysis.user.md src/prompts/schemas/topic-analysis.schema.md
git commit -m "refactor(prompt): extract topic-analysis JSON schema to external file"
```

---

## Task 2: JSON Schema 迁移 — topic-assignment

**Files:**
- Create: `src/prompts/schemas/topic-assignment.schema.md`
- Modify: `src/prompts/templates/create/topic-assignment.user.md`

**Steps:**

- [ ] **Step 1: 创建 topic-assignment.schema.md**

```markdown
# TopicAssignmentSchema

{
  "wechat": {
    "platform": "wechat",
    "angle": "string",
    "titleDrafts": ["string", "string", "string"],
    "coreArgument": "string",
    "targetAudience": "string",
    "tone": "string",
    "wordCountRange": [2000, 3000],
    "contentType": "string",
    "emotionalGoal": "string"
  },
  "xiaohongshu": { /* 同上结构 */ },
  "douyin": { /* 同上结构 */ },
  "overlapAnalysis": "string"
}
```

- [ ] **Step 2: 修改 topic-assignment.user.md，移除 Schema 段落**

将文件末尾的 JSON Schema 段落（从第10行到第26行）替换为：

```markdown
请按照要求输出 JSON 格式的选题分配结果。必须严格遵循 TopicAssignmentSchema（见 schemas/topic-assignment.schema.md）。
```

- [ ] **Step 3: Commit**

```bash
git add src/prompts/templates/create/topic-assignment.user.md src/prompts/schemas/topic-assignment.schema.md
git commit -m "refactor(prompt): extract topic-assignment JSON schema to external file"
```

---

## Task 3: dual-review.user.md 去除重复说明

**Files:**
- Modify: `src/prompts/templates/recreate/dual-review.user.md`

**当前文件内容：**
```
请对以下文章进行双重审查：

【待审查文章】
{{originalArticle}}

【二创约束要求】
{{constraints}}

请按照以下标准进行审查并输出结果。JSON Schema:
{
  "originalityScore": number,
  "viralPotentialScore": number,
  ...
}
```

其中"请按照以下标准进行审查"与 system prompt 中的审校标准重复。

**Steps:**

- [ ] **Step 1: 读取当前 dual-review.user.md**

- [ ] **Step 2: 删除与 system 重复的说明段落**

将"请按照以下标准进行审查并输出结果"及其 JSON Schema 段落改为：

```markdown
请对上述文章进行双重审查并输出结果。审校标准详见 system prompt。
```

- [ ] **Step 3: Commit**

```bash
git add src/prompts/templates/recreate/dual-review.user.md
git commit -m "refactor(prompt): remove redundant review criteria from dual-review user prompt"
```

---

## Task 4: viral-deconstruction.system.md 保守压缩（≤20%）

**Files:**
- Modify: `src/prompts/templates/recreate/viral-deconstruction.system.md`

**压缩原则：**
- 删除：重复的格式说明、注释性说明（如"分析维度："后的解释）
- 保留：推理引导（"要分析'为什么'，不仅仅是'是什么'"）
- 目标：103行 → 80行（压缩约22%）

**Steps:**

- [ ] **Step 1: 读取当前文件，计算可删除内容**

以下段落可压缩/删除（它们是说明而非约束）：
- 第5-16行"分析维度："后的详细解释文字 → 压缩为一行
- 第13-15行"分析原则："的三条说明 → 合并为一句
- 保留核心推理引导语（"要分析为什么，不仅仅是什么"）

- [ ] **Step 2: 重写压缩版本**

```markdown
你是一位内容行业的资深分析师，专门研究爆款内容的底层逻辑。

你的任务：对输入的爆款文章进行深度解剖，提取其"爆款基因图谱"。

分析维度（只描述"分析什么"，不解释为什么）：
1. 选题策略：击中的痛点/痒点/爽点
2. 叙事结构：骨架、每部分目的、篇幅占比
3. 钩子设计：开头技巧和机制
4. 情绪曲线：读者情绪变化轨迹和关键转折点
5. 高传播力金句：句式结构分析
6. 爆款因素总结：3-5个关键词

**新增维度——论证路径（argumentativePath）**：
- 每段论证逻辑（如"引用权威→对比→结论"、"问题共鸣→原因分析→方案"）
- 记录每个段落的论证方式，帮助后续二创避免结构复刻

**新增维度——禁止表达（forbiddenExpressions）**：
- 原文5-10个最具辨识度的高光表达
- 二创必须完全规避这些表达

**新增维度——案例提取（caseStudies）**：
- protagonist、setting、story（50字内）、whyItWorks
- 至少1-3个案例

**新增维度——关键数据提取（keyDataPoints）**：
- data、context、field
- 至少1-3个数据点

**新增维度——金句提取（goldQuotes）**：
- 2-5条最具传播力的金句，50字以内

输出格式：JSON，严格遵循以下 Schema:
{
  "topicStrategy": { "painPoint": "string", "emotionalTrigger": "string", "targetAudience": "string", "whyItWorks": "string" },
  "narrativeStructure": [{ "sectionIndex": "number", "purpose": "string", "wordRatio": "number", "emotionMark": "string", "technique": "string", "argumentativePath": "string" }],
  "hookTechnique": { "type": "string", "mechanism": "string", "template": "string" },
  "emotionCurve": [{ "position": "number", "emotion": "string", "intensity": "number" }],
  "powerSentences": [{ "original": "string", "structure": "string", "whyPowerful": "string" }],
  "viralFactors": ["string"],
  "contentDensityScore": "number",
  "estimatedReadTime": "string",
  "forbiddenExpressions": [{ "text": "string", "reason": "string" }],
  "caseStudies": [{ "id": "string", "protagonist": "string", "setting": "string", "story": "string", "whyItWorks": "string" }],
  "keyDataPoints": [{ "id": "string", "data": "string", "context": "string", "field": "string" }],
  "goldQuotes": [{ "id": "string", "text": "string", "position": "string" }]
}
```

- [ ] **Step 3: 验证行数压缩到 ≤82 行**

Run: `wc -l src/prompts/templates/recreate/viral-deconstruction.system.md`
Expected: ≤82

- [ ] **Step 4: Commit**

```bash
git add src/prompts/templates/recreate/viral-deconstruction.system.md
git commit -m "refactor(prompt): conservative compression of viral-deconstruction system prompt"
```

---

## Task 5: 端到端验证

**Steps:**

- [ ] **Step 1: 构建项目**

Run: `cd "D:/myproject/内容系统v1/contentforge" && npm run build`

- [ ] **Step 2: 测试 topic-analysis prompt 渲染**

Run: `cd "D:/myproject/内容系统v1/contentforge" && node -e "import('./src/prompts/renderer.js').then(m => { import('./src/prompts/loader.js').then(l => { l.promptLoader.load('create', 'topic-analysis').then(t => { console.log('topic-analysis system length:', t.system.length, 'user length:', t.user.length); }); }); });"`

- [ ] **Step 3: 测试 topic-assignment prompt 渲染**

Run: 同上，验证加载无报错

- [ ] **Step 4: 运行 create E2E 测试**

Run: `cd "D:/myproject/内容系统v1/contentforge" && node dist/index.js create --keyword "AI" --no-interactive 2>&1 | head -50`
Expected: 流程正常完成

---

## 自检清单

- [ ] Task 1 后 topic-analysis.user.md 不含完整 JSON Schema
- [ ] Task 2 后 topic-assignment.user.md 不含完整 JSON Schema
- [ ] Task 3 后 dual-review.user.md 不含与 system 重复的审校标准说明
- [ ] Task 4 后 viral-deconstruction.system.md 行数 ≤82（原103行）
- [ ] 所有 prompt renderer 加载无报错
- [ ] E2E 测试正常完成
