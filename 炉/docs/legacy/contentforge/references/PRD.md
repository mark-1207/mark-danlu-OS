# PRD.md


## 1. 产品概述

### 1.1 产品名称

ContentForge — AI 多平台内容生成工作流引擎

### 1.2 产品定位

一个基于多步骤 LLM 编排的内容生成系统，支持两大核心场景：

- **场景 A（原创生成）**：从关键词/主题出发，自动生成适配公众号、小红书、抖音三个平台的高质量原创文章

- **场景 B（爆款二创）**：输入一篇爆款文章，自动解构其爆款基因并生成高质量的差异化二创内容

### 1.3 核心价值

- 通过多步骤 Pipeline 替代单次 LLM 调用，显著提升内容质量

- 每一步中间产物可检查、可干预、可单独重做

- 平台策略与生成逻辑解耦，策略可独立迭代

- 支持批量运行，实现规模化内容生产

### 1.4 目标用户

- 内容创作者 / 自媒体运营者

- 内容营销团队

- MCN 机构

## 2. 功能需求

### 2.1 场景 A：关键词 → 三平台原创文章

#### 输入

- 关键词（如 “AI”）或主题描述（如 “个人成长”）

- 可选：目标受众描述、风格偏好、排除方向

#### 处理流程（6 步 Pipeline）

**Step 1 — 主题深挖**

- 输入：用户提供的关键词/主题

- 处理：围绕主题发散出 10-15 个子话题、痛点、热门切入角度

- 输出：结构化的主题分析报告（JSON）

- 输出字段：`sub_topics[]`, `pain_points[]`, `trending_angles[]`, `controversies[]`, `target_demographics[]`

**Step 2 — 三平台选题分配**

- 输入：Step 1 输出 + 三平台内容策略知识

- 处理：为三个平台分别选定差异化的切入角度

- 输出：三份选题卡片（JSON）

- 每份包含：`platform`, `angle`, `title_drafts[]`(3 个候选）, `target_audience`, `tone`, `word_count_range`, `content_type`

- 约束：三个平台的选题角度重合度不超过 30%

**Step 3 — 大纲生成（三路并行）**

- 输入：对应平台的选题卡片 + 平台策略模板

- 处理：生成详细的内容大纲

- 输出：结构化大纲（JSON）

- 公众号大纲：包含 hook 设计、3-5 个递进论点、案例位置标记、结尾升华方向

- 小红书大纲：包含人设开头、3-5 个干货点（每个点需具体到可执行）、总结金句

- 抖音大纲：包含 3 秒钩子设计、核心观点（仅 1 个）、极简案例、金句收尾

**Step 4 — 素材检索（可选，三路并行）**

- 输入：各平台大纲中的论点

- 处理：通过搜索 API 检索相关数据、案例、故事

- 输出：每个论点对应的 2-3 条素材

- 约束：三个平台的素材尽量不重复

**Step 5 — 全文生成（三路并行）**

- 输入：选题卡片 + 大纲 + 素材 + 平台写作人格 prompt

- 处理：按大纲逐段生成正文

- 输出：完整文章初稿

- 公众号：2000-3000 字

- 小红书：500-800 字

- 抖音：150-300 字

**Step 6 — 审校优化（三路并行）**

- 输入：初稿 + 平台审校标准

- 处理：平台适配性审查 + 质量优化 + 标题优化

- 输出：

  - 修改后的终稿

  - 5 个候选标题（含推荐排序）

  - 质量评分报告（标题吸引力/开头留存/内容价值/情绪调动/互动引导，各项 1-10 分）

  - 修改说明（改了什么、为什么改）

#### 最终输出

```json
{
  "keyword": "AI",
  "generated_at": "2026-03-28T22:00:00Z",
  "articles": [
    {
      "platform": "wechat",
      "title_options": ["...", "...", "...", "...", "..."],
      "recommended_title": "...",
      "content": "...(markdown格式全文)...",
      "word_count": 2500,
      "quality_score": { "title": 8, "hook": 9, "value": 8, "emotion": 7, "interaction": 7 },
      "meta": { "angle": "...", "audience": "...", "tone": "..." }
    },
    { "platform": "xiaohongshu", ... },
    { "platform": "douyin", ... }
  ],
  "intermediate_artifacts": {
    "topic_analysis": { ... },
    "topic_assignments": { ... },
    "outlines": { ... },
    "materials": { ... }
  }
}
```

### 2.2 场景 B：爆款文章 → 高质量二创

#### 输入

- 爆款文章全文（纯文本或 Markdown）

- 可选：目标平台、差异化方向偏好、风格偏好

#### 处理流程（5 步 Pipeline）

**Step 1 — 爆款解构分析**

- 输入：原文全文

- 处理：深度解剖原文的爆款基因

- 输出：爆款基因图谱（JSON）

- 字段：

  - `topic_strategy`: 击中的痛点/痒点/爽点

  - `target_audience`: 目标读者画像

  - `narrative_structure[]`: 叙事结构（每段的目的、篇幅占比、情绪标记）

  - `hook_technique`: 开头钩子技巧分析

  - `emotion_curve[]`: 情绪曲线关键节点

  - `power_sentences[]`: 高传播力金句及其句式结构

  - `viral_factors[]`: 爆款因素总结

  - `content_density_score`: 信息密度评分

**Step 2 — 差异化方向生成**

- 输入：爆款基因图谱

- 处理：生成 3-5 个差异化二创方向

- 输出：差异化方向列表（JSON）

- 每个方向包含：

  - `direction_name`: 方向名称

  - `perspective_shift`: 视角切换说明

  - `audience_shift`: 受众迁移说明

  - `content_shift`: 内容替换策略

  - `differentiation_score`: 差异度评分（1-10）

  - `feasibility_score`: 可行性评分（1-10）

- 自动选择：`differentiation_score * 0.6 + feasibility_score * 0.4` 最高的方向

**Step 3 — 新大纲生成**

- 输入：爆款基因图谱（仅结构部分） + 选定的差异化方向

- 处理：保留叙事骨架，用全新内容填充

- 输出：新大纲（JSON）

- 每个段落标注：对应原文哪个结构模块、新的论点/案例/表达方向

- ⚠️ 关键约束：不传入原文全文，只传入结构图谱

**Step 4 — 全文生成**

- 输入：爆款基因图谱（仅结构+情绪曲线） + 新大纲

- ⚠️ 关键约束：上下文中不包含原文全文（架构级防抄袭）

- 处理：按新大纲生成完整文章

- 输出：二创文章初稿

- 写作指令中明确禁止：

  - 复用原文任何完整句子

  - 使用相同的案例和数据

  - 使用相同的比喻和类比

**Step 5 — 双重审查**

- 输入：二创初稿 + 原文全文（此步骤需要对比）

- 处理 A — 原创度审查：

  - 逐段对比原文和二创文

  - 标记相似度过高的段落（阈值：连续 10 个以上相同/近义词）

  - 如有不达标段落 → 输出需重写的段落列表

- 处理 B — 爆款潜力评估：

  - 从 5 个维度评分：标题吸引力、开头留存率、内容价值感、情绪调动力、互动引导力

  - 与原文评分对比

  - 给出具体优化建议

- 条件分支：如果有不达标段落 → 回到 Step 4 仅重写标记段落 → 再次审查（最多循环 3 次）

- 输出：

  - 二创终稿

  - 原创度报告

  - 爆款潜力评分（与原文对比）

  - 修改日志

#### 最终输出

```json
{
  "original_title": "...",
  "generated_at": "2026-03-28T22:00:00Z",
  "recreation": {
    "title_options": ["...", "...", "...", "...", "..."],
    "recommended_title": "...",
    "content": "...(markdown格式全文)...",
    "word_count": 2200,
    "direction_used": { "name": "...", "perspective_shift": "...", ... },
    "quality_score": { "title": 8, "hook": 9, "value": 8, "emotion": 8, "interaction": 7 },
    "originality_report": {
      "overall_score": 9.2,
      "flagged_paragraphs": [],
      "rewrite_iterations": 1
    },
    "comparison_with_original": {
      "original_scores": { ... },
      "recreation_scores": { ... },
      "improvement_areas": ["..."],
      "regression_areas": ["..."]
    }
  },
  "intermediate_artifacts": {
    "viral_genome": { ... },
    "differentiation_directions": [ ... ],
    "selected_direction": { ... },
    "new_outline": { ... }
  }
}
```

### 2.3 通用功能需求

#### 2.3.1 批量执行

- 场景 A：支持输入多个关键词，批量生成（每个关键词 → 3 篇文章）

- 场景 B：支持输入多篇爆款文章，批量二创

- 并发控制：可配置最大并发数（默认 3），避免 API 限流

#### 2.3.2 中间产物持久化

- 每一步的输入和输出都保存到本地文件系统

- 目录结构：`output/{timestamp}_{keyword_or_title}/{step_name}.json`

- 支持从任意中间步骤恢复执行（断点续跑）

#### 2.3.3 配置化

- 模型选择：每一步可独立配置使用的模型（如分析步骤用 Claude，生成步骤用 GPT-4o）

- Prompt 模板：外部文件管理，支持热更新

- 平台策略：外部文件管理，支持热更新

- API 密钥：环境变量管理

#### 2.3.4 CLI 交互

- 命令行界面，支持以下命令：

  - `contentforge create --keyword "AI" --platforms wechat, xiaohongshu, douyin`

  - `contentforge recreate --input ./article.md --direction auto`

  - `contentforge recreate --input ./article.md --direction interactive`（交互式选择差异化方向）

  - `contentforge resume --run-id <id> --from-step 3`（断点续跑）

  - `contentforge batch --input ./keywords.txt --scenario create`

  - `contentforge config --show`（显示当前配置）

## 3. 非功能需求

### 3.1 性能

- 场景 A 单次执行（1 个关键词 → 3 篇文章）：< 5 分钟

- 场景 B 单次执行（1 篇二创）：< 3 分钟

- 批量执行时支持并发，吞吐量随并发数线性增长

### 3.2 可靠性

- API 调用失败自动重试（指数退避，最多 3 次）

- 中间产物持久化确保断点可恢复

- 每步执行结果包含 token 用量统计

### 3.3 可扩展性

- 新平台（如 B 站、知乎）只需添加平台策略文件和对应 prompt 模板

- 新场景只需定义新的 Pipeline 步骤序列

- 模型提供商可插拔（OpenAI / Anthropic / 本地模型）

### 3.4 成本控制

- 每次运行输出 token 用量和预估成本

- 支持配置每日/每月成本上限

- 素材检索步骤可选关闭以降低成本

## 4. 优先级排序

### P0（MVP，第一版必须实现）

- 场景 A 完整 Pipeline（6 步）

- 场景 B 完整 Pipeline（5 步）

- CLI 基本命令（create, recreate）

- 中间产物持久化

- 配置文件管理

### P1（第二版）

- 批量执行

- 断点续跑

- 素材检索集成（搜索 API）

- Token 用量统计和成本控制

### P2（第三版）

- 质量反馈闭环（人工评分 → 数据库 → 分析报告）

- 爆款素材库（持续积累爆款基因图谱）

- A/B 测试标题机制

- Web UI（可选）