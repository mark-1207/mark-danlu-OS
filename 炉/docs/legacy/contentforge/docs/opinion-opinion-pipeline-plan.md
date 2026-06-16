# Opinion Pipeline 实现计划

## 目标

新增第三种内容意图类型：**opinion（观点文）**，从"一个观点/想法"出发，经过证伪锤炼 → 标题确认 → 汇入现有 pipeline。

## 架构

```
用户输入观点/想法
    ↓
parseIntent 检测为 opinion 类型
    ↓
opinion-refine（HLR质检 + 证伪 + 锤炼 + 推荐标题）
    ↓
opinion-review（用户交互：确认论点、选标题、注入案例）
    ↓ ← 从这里汇入现有 pipeline
topic-analysis（跳过，opinion 文章不需要多角度发散）
topic-assignment（已有精炼论点，直接驱动）
outline（已有标题，直接生成）
material-search（不变）
content-generation（不变）
review（不变，集成 L1/L2 质检）
```

## 触发条件

| 条件 | 示例 |
|------|------|
| 以问号结尾 | "AI时代最大受益者是谁？" |
| 包含挑战词 | "凭什么""为什么""怎么可" |
| 包含讨论词 | "讨论""分析""聊聊""说说" |
| 短判断句（≤30字含判断词） | "AI时代最大受益者是资本家" |

## 新增文件

| 文件 | 说明 |
|------|------|
| `src/scenarios/opinion/types.ts` | RefinedOpinion/ConfirmedOpinion 类型 + Zod 验证 |
| `src/scenarios/opinion/index.ts` | runOpinion 入口 |
| `src/scenarios/opinion/steps/opinion-refine.ts` | HKR 质检 + 证伪 + 标题推荐 |
| `src/scenarios/opinion/ui/opinion-review.ts` | 用户确认交互 UI |
| `src/prompts/templates/opinion/opinion-refine.system.md` | 证伪 prompt |
| `src/prompts/templates/opinion/opinion-refine.user.md` | prompt 模板 |
| `tests/scenarios/opinion/opinion-flow.test.ts` | TDD 测试（22 个测试） |

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/cli/commands/skill.ts` | parseIntent 新增 opinion 分支，runSkill 新增 opinion 路由 |
| `src/cli/commands/create.ts` | cleanupIntermediateFiles 保留 confirmed-outline-* 和 outline-seed-material-* |
| `src/cli/commands/create.ts` | resumeFromOutline 恢复后立即 persist |
| `src/utils/sanitize.ts` | 支持中文标点（`：` `？`） |
| `docs/contentforge-user-manual.html` | 更新命令大全和快速入门 |
| `docs/contentforge-flow-for-beginners.html` | 更新流程图 |
| `docs/contentforge-opinion-pipeline.md` | 本文档 |

## HKR 质检标准

| 维度 | 含义 | 及格线 |
|------|------|--------|
| H (Happy) | 悬念感/吸引力 | 60 |
| K (Knowledge) | 信息量 | 60 |
| R (Resonance) | 情绪共鸣 | 60 |

## 证伪逻辑

1. 生成 2-3 个支撑证据
2. 生成 2-3 个已知反驳/反例
3. 锤炼后的论点要有立场、不中庸
4. 边界条件要明确

## 与现有 pipeline 的汇合点

opinion-review 完成后，向 context 写入：
- `confirmed-opinion` — 完整确认数据
- `topic-analysis` — 兼容格式（subTopics=[]）
- `confirmed-title-{platform}` — 用户确认的标题
- `outline-seed-material-{platform}` — 用户注入的案例

## TDD 测试（22 个，全部通过）

| 测试 | 验证 |
|------|------|
| T1-T8 | parseIntent opinion 检测逻辑 |
| T9-T12 | RefinedOpinion 类型验证 |
| T13-T15 | ConfirmedOpinion 类型验证 |
| T16-T19 | 文件名处理（中文标点） |
| T20-T22 | context 持久化验证 |

## 卡兹克 L1/L2 质检集成

**L1（禁词扫描）**：review 步骤完成后自动跑，命中直接替换，不阻塞流程。
**L2（风格检查）**：review 步骤完成后跑，生成结构化报告输出给用户参考。

### L1 禁用词表

```
说白了/意味着什么/本质上/换句话说/不可否认/综上所述/首先...其次...最后
```

### L2 风格检查项

- 开头是否从具体场景切入（不用宏大叙事）
- 节奏是否有长短句交替
- 是否使用推荐口语化词组（8-10 个）
- 是否有一句话说/段落独立成句制造断裂感
- 是否有自嘲或承认不足

## 后续计划

- [x] 实现 `--phase content --run-id` 续跑 opinion pipeline ✅
- [x] 实现 opinion 流程的断点续跑（resume 支持 opinion runId 前缀） ✅
- [x] L1 禁词扫描集成进 review 步骤 ✅
- [x] L2 风格检查集成进 review 步骤 ✅

## 实施状态（2026-06-02）

**Phase A + Phase B 全部完成**：
- parseIntent opinion 检测（22 个 TDD 测试）
- opinion-refine step（HKR 质检 + 证伪 + 标题推荐）
- opinion-review UI（用户确认）
- opinion pipeline 入口 + 汇入现有 create pipeline
- opinion --phase content --run-id 续跑支持
- L1 禁词扫描集成 review 步骤
- L2 风格检查集成 review 步骤

**端到端验证通过**：
- opinion intent 检测正确
- opinion-refine LLM 调用返回有效结构化输出
- opinion-review TUI 展示 HKR 分数/论点/标题
- 续跑流程 topic-assignment → outline → content → review 全跑通
- L1 扫描自动替换命中禁词（自动替换 1 处命中 + L2 报告 score=75）
- L2 风格检查生成结构化报告

**总测试数：270/270 passing**（其中 35 个 opinion 流程测试）

## 文档同步（迭代一致性）

| 文档 | 状态 | 位置 |
|------|------|------|
| opinion pipeline 计划 | ✅ 最新 | `docs/opinion-opinion-pipeline-plan.md` |
| 小白入门指南 | ✅ 含 opinion 流程 | `docs/contentforge-flow-for-beginners.html` |
| 用户操作手册 | ✅ 含 opinion 章节+FAQ | `docs/contentforge-user-manual.html` |
| MEMORY | ✅ 同步 opinion 流程 | `C:\Users\admin\.claude\projects\D--myproject\memory\projects_contentforge.md` |

**未来迭代时保持信息一致的规则**：
1. 修改 opinion 流程代码 → 更新 `docs/opinion-opinion-pipeline-plan.md` 的"实施状态"
2. 添加新的禁词/风格规则 → 更新 L1/L2 quality 模块 + 本文档"卡兹克 L1/L2 集成"章节
3. 修改触发词逻辑 → 更新本计划"触发条件"表 + 操作手册"触发条件"表
4. 修改输出 artifacts 路径 → 更新操作手册"输出 artifacts"代码块
5. 重大变更（接口/CLI） → 同步 MEMORY 文件

## 未来优化方向（待办）

| 优先级 | 项目 | 说明 |
|--------|------|------|
| 高 | L1 误报率调优 | 某些词在特定语境下不算"AI味"（如学术文章用"本质上"），需上下文判断 |
| 高 | opinion --phase refine | 在确认后但未生成内容前，提供"仅重新锤炼论点"模式 |
| 中 | opinion 多平台支持 | 当前仅 wechat，扩展到小红书/抖音时需要不同的口吻调整 |
| 中 | L2 规则可配置 | L1 禁词表和 L2 规则应可通过 config 文件自定义 |
| 中 | opinion 案例库 | 注入案例时支持从 ObsidianMaterialStore 自动检索相关案例 |
| 低 | 观点类型自动优化 | comparison/causal/judgment 用不同的 prompt 模板 |
| 低 | A/B 测试标题 | 自动生成 2 个版本的标题，让用户选最喜欢的 |
