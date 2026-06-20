# D-010: v3 P0 多模式架构

> 日期：2026-06-20 | 状态：采纳
> 关联：[v2 P0 Embedding 方案](../development/v2-p0-embedding-plan.md) + 用户决策 D1-D10

## 背景

v1.x 阶段，炉 (Lu) 走"单 run 7 步"流程，每篇文章独立生成。
v2 P0 阶段，加入 Embedding 跨 run 记忆，但**单条命题 → 单篇文章**的黑盒模式未变。

v3 P0 要解决：
- **不同场景用不同模式**（短内容 vs 长文 vs 二创）
- **自动化程度因场景而异**（社交全自动 / 原创 TUI / 二创 1 个决策点）
- **不替用户做主**：保留所有关键决策的可介入点

按用户决策 D1-D10 实施。

## 决策

### D-010.1: 3 种模式（social / create / recreate）

| 模式 | 触发场景 | 步数 | 自动化 | TUI 介入 |
|------|---------|------|--------|---------|
| **social** | 短内容（微博/头条/推特）| 4 步 | **100%** | 0% |
| **create** | 原创 8 步全流程（TUI 介入）| 8 步 | **0%** 关键决策 | 100% |
| **recreate** | 二创（链接/文档 + 改写指令）| 5 步 | 90% | 1 个 TUI 决策点 |

**理由**：
- 社交全自动 = 短内容场景，规模化产出，不需要用户决策
- 原创全 TUI = 关键决策密集（苏格拉底追问 / 12 标题选 1 / 蓝图 stance / 草稿 2 段一环）
- 二创 1 决策 = 改写方向确认，其他全自动

### D-010.2: prompt_variant 字符串分支

每个 step handler 内按 `prompt_variant` 字符串分支（"full" / "social_skip" / "recreate_*"），**不按 mode 写独立 handler**。

**理由**：
- 避免 step handler 数量爆炸（3 模式 × 8 步 = 24 handler → 8 handler × 3-4 个 variant 分支）
- 同一个 step 逻辑只在多处复用
- 新增模式只需添加 variant，不需重写所有 step

### D-010.3: 8 步统一状态机

| # | 步 | social | create | recreate |
|---|----|--------|--------|----------|
| 1 | 命题输入 | ✅ social | ✅ create | ✅ recreate_input |
| 2 | 苏格拉底追问 | ❌ skip | ✅ full | ✅ recreate_struct |
| 3 | 标题生成 (Prism) | ✅ social_title | ✅ full | ❌ recreate_direct（决策）|
| 4 | 蓝图设计 (CCOS) | ❌ skip | ✅ full | ❌ skip |
| 5 | Gap 决策 | ❌ skip | ✅ full | ❌ skip |
| 6 | 草稿生成 | ✅ social_short | ✅ full | ✅ recreate_draft |
| 7 | 质检 | ❌ skip | ✅ full + critic | ✅ recreate_l1only |
| 8 | 沉淀 | ✅ social_persist | ✅ full | ❌ recreate_persist（skip）|

**理由**：state machine 不动，mode 决定跳哪些 state。

### D-010.4: TUI 抽象协议

```python
class TUIDecision(Protocol):
    def decide_step1_input(self, proposition: str) -> TUIInput: ...
    def decide_step3_title(self, candidates: list[str]) -> TUIInput: ...
    # ... 7 个决策点

class AutoTUIDecision: ...  # 全接受（黑盒模式）
class InteractiveTUIDecision: ...  # rich.prompt（真 TTY 模式）
```

**理由**：
- TUI 是**可选的依赖**：非 TTY 环境（CI、单测）自动 fallback 到 AutoTUIDecision
- step handler 不依赖 rich，避免巨型 import
- 未来可加更多 TUI 实现（如 web TUI）

### D-010.5: 旧命令 deprecation 兼容

| 旧命令 | 新行为 |
|--------|--------|
| `lu run` | 转发到 `lu create` + deprecation warning |
| `lu viral` | deprecation warning + 提示改用 `lu create --reference` |
| `lu opinion` / `lu short` | 提示改用 `lu social` |
| `lu interactive` | 提示改用 `lu create`（TUI 是 create 的 --tui 标志）|

**理由**：
- 不破坏现有用户的命令行习惯
- 旧命令仍可用，给用户迁移时间
- deprecation warning 引导用户用新命令

### D-010.6: 数据迁移零成本

Context v3 字段（mode / candidate_titles / blueprint_title / gaps / recreate_* / social_* / critique_issues）**都有默认值**。旧 v1.x / v2 P0 的 runs/ 数据加载时自动补默认值，**不需要任何迁移工具**。

**理由**：
- 用户已跑的 runs 全部能加载
- 续跑 mode 校验：ctx.mode（默认 "create"）vs orchestrator.mode 一致才允许

## 架构图

```
                ┌────────────────────────────────────┐
                │  CLI: lu <subcommand>              │
                └──────────────┬─────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   ┌────▼────┐         ┌───────▼────┐         ┌───────▼────┐
   │  create │         │   social   │         │  recreate │
   │ 8 步    │         │ 4 步全自   │         │ 5 步 1 决 │
   │ TUI     │         │   动       │         │  策点     │
   └────┬────┘         └───────┬────┘         └───────┬────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                ┌──────────────▼─────────────────────┐
                │  Orchestrator.run(mode=...)         │
                │  for step_cfg in step_configs:      │
                │    _dispatch_step(step_cfg)         │
                └──────────────┬─────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   ┌────▼────┐         ┌───────▼────┐         ┌───────▼────┐
   │ _step1..│         │ _step1..   │         │ _step1..   │
   │ _step8  │         │ _step8     │         │ _step8     │
   │ variant=│         │ variant=   │         │ variant=   │
   │  full   │         │  social_*  │         │  recreate_*│
   └────┬────┘         └───────┬────┘         └───────┬────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
   ┌────▼────┐         ┌───────▼────┐         ┌───────▼────┐
   │ Prism 12│         │ 1维×3 +   │         │ 5段重写    │
   │ 标题    │         │ 启发式选   │         │ 保留原结构│
   │ Gap     │         │            │         │ 改写方向  │
   │ 6 维    │         │            │         │ L1 基础    │
   │ Critic  │         │            │         │            │
   └─────────┘         └────────────┘         └────────────┘
```

## 验证

- 全量测试：615 passed + 1 xpassed（mimo API 行为变化）
- 端到端：`lu create/social/recreate` 都跑通
- 8 Phase commits 全部 push
- D-010 ADR 同步记录
- MEMORY.md / 11-PROGRESS.md / 14-TASKS.md 更新

## 关联

- D-001 ~ D-009（前序决策）
- 9-ROADMAP-V2（v2.x 路线图）
- v2-p0-embedding-plan.md（v2 P0 方案）
- 06-DEV-PLAN.md（v1 开发计划）

## 后续

- 真实 TTY 端到端验证 InteractiveTUIDecision
- 真实 mimo API 行为变化跟踪（1 xfail 测试）
- v3.x 跨设备同步 / 调度 / Webhook
