# CCOS v2.0 认知增强集成方案

> 版本 v0.1 | 日期 2026-05-21 | 状态：方案阶段

---

## 一、背景与目标

### 现状

ContentForge 原创流程的大纲生成（OutlineWechatStep）基于 TopicAssignmentStep 输出的 TopicCard，包含 angle/title/tone 等字段，**缺乏明确的认知张力驱动**，每段落的论证路径由 AI 自由发挥，无法确保与大众预期路径产生差异。

### CCOS v2.0 带来的能力

CCOS（Content Cognitive Outline System）的核心价值：

| 能力 | 对 contentforge 的提升 |
|------|----------------------|
| **认知张力识别**（大众以为 vs 现实是） | 大纲生成有明确认知驱动，而非泛泛而谈 |
| **结构类型推荐**（认知升级型/问题拆解型/故事驱动型/信息重构型） | TopicAssignment 直接推荐最优结构，OutlineStep 不再自选 |
| **推进方式组合**（冲突/递进/案例/对比/拆解/情绪推进） | 论点推进有节奏设计 |
| **认知模块标签**（HOOK/CASE/EXPLAIN/MODEL/COUNTER...） | ContentStep 有明确的写作指令而非模糊描述 |
| **作者性注入**（复用 creative-preferences） | 大纲体现个人写作风格 |

### 目标

在 TopicAssignmentStep 和 OutlineWechatStep 中注入 CCOS 认知框架，使大纲生成从"描述性"升级为"指令性"。

---

## 二、已完成的改动

| 文件 | 改动 |
|------|------|
| `src/scenarios/create/types.ts` | TopicCardSchema 新增 `cognitiveTension`/`structureType`/`progressionMode`；WechatOutlineSchema 新增 `cognitiveTension` + `cognitiveModule`；新增 `CognitiveModuleSchema` / `CognitiveTensionSchema` |
| `src/prompts/templates/create/topic-assignment.system.md` | Schema 输出新增 3 个字段 |
| `src/prompts/templates/create/outline-wechat.user.md` | 增加"先提炼认知张力再生成大纲"的强制指令 |
| `src/prompts/templates/create/outline-wechat.system.md` | 增加认知模块设计表格 + 输出 Schema 扩展 |

**构建状态**：✅ 已通过 `npm run build`

---

## 三、待完成项

### 待完成 1：验证 Schema 变更后 LLM 输出稳定性

**问题**：TopicAssignmentStep 的 Schema 从 8 字段扩展到 11 字段（wechat/xiaohongshu/douyin 各新增 3 个），需要验证 LLM 是否能稳定输出新字段。

**验证方法**：
```bash
node dist/index.js skill "帮我写一篇关于职场年龄歧视的文章"
```
检查 output 中 `topic-assignment-snapshot.json` 是否包含 `cognitiveTension` / `structureType` / `progressionMode`。

**容灾方案**：如果 LLM 输出不稳定，将新字段改为 optional，不阻断流程。

---

### 待完成 2：OutlineWechatStep 读取 TopicCard 的 cognitiveTension

**当前状态**：`OutlineWechatStep.doExecute()` 读取 `assignments.wechat`，但未传递 `cognitiveTension` / `structureType` / `progressionMode` 给 prompt。

**需要修改**（`src/scenarios/create/steps/outline-generation.ts`）：
- 从 context 读取时，将 cognitiveTension/structureType/progressionMode 一并打包进 topicCard
- prompt 模板已更新，只需确保这些字段被传入

---

### 待完成 3：小红书/抖音 Outline Prompt 同步更新（可选）

当前只更新了 Wechat，Xiaohongshu 和 Douyin 的 Outline prompt 未同步认知张力指令。

---

### 待完成 4：ContentStep 消费 cognitiveModule 标签（后续）

当前 ContentStep 按大纲生成正文，但 cognitiveModule 标签仅作为参考字段存在，尚不参与实际生成指令。Phase 2 再推进。

---

## 四、实现计划

```
Step 1: 验证 Schema — 运行一次完整流程，检查 cognitiveTension 是否输出
        ↓
Step 2: 修 outline-generation.ts — 确保 cognitiveTension 等字段传入 prompt
        ↓
Step 3: 同步小红书/抖音 prompt（如需要）
        ↓
Step 4: 端到端测试 — 完整运行 create，观察大纲质量变化
        ↓
Step 5: 更新 SKILL.md + 文档（如需要）
```

### 优先级

- **P0**：Step 1 + Step 2（核心流程，必须）
- **P1**：Step 4（验证效果）
- **P2**：Step 3（次要平台）
- **P3**：Step 5（文档）

---

## 五、与现有方案的关系

| 现有方案 | 关系 |
|---------|------|
| 反馈系统（contentforge-content-evolution-plan.md） | 独立，CCOS 增强大纲质量，不依赖反馈数据 |
| 竞品分析（feedback-system-design.md） | 独立，TopicAssignmentStep 的 competitorInsights 已有 |
| CCOS v2.0（桌面文档） | 抽取 Layer 2/3/4/8 核心概念，不引入 Layer 0/1/7（成本高/不适用） |

---

## 六、不做什么

| 不做 | 理由 |
|------|------|
| Layer 0 七类追问 | contentforge 是自动化流程，增加交互不适合 |
| Layer 1 内容意图识别 | TopicAssignmentStep 已有 emotionalGoal，效果等同 |
| Layer 7 数字分身作者性注入 | buildPreferencePrompt() 已有基础，Phase 2 再整合 |
| 完整 14 项输出 | 过于复杂，仅取对大纲质量影响最大的字段 |
| Phase 4.6 Gap Analysis | MaterialSearchStep 已承担素材搜索职责，功能重叠 |