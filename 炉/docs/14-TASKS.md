# 14 — 任务分解（Tasks）

> 详细任务分解。状态：⏳ 待办 / 🚧 进行中 / ✅ 完成 / ❌ 阻塞。
> 维护：任务变化时更新。

---

## 当前阶段：v1 实施前文档收尾

### 文档撰写

- [x] ✅ 00-PROJECT-OVERVIEW.md
- [x] ✅ 01-PRD.md
- [x] ✅ 02-ARCHITECTURE.md
- [x] ✅ 03-MODULE-DESIGN.md
- [x] ✅ 04-DATA-MODEL.md
- [x] ✅ 05-DEV-CONVENTIONS.md
- [x] ✅ 06-DEV-PLAN.md
- [x] ✅ 07-TEST-PLAN.md
- [x] ✅ 08-DEPLOY.md
- [x] ✅ 09-ROADMAP-V2.md
- [x] ✅ 10-LONG-TERM-PLAN.md
- [x] ✅ 11-PROGRESS.md
- [x] ✅ 12-DECISION-LOG.md
- [x] ✅ 13-MILESTONES.md
- [x] ✅ 14-TASKS.md（本文）
- [x] ✅ 15-ISSUES.md
- [x] ✅ 16-RELEASE-CHECKLIST.md
- [x] ✅ 17-TECH-DEBT.md
- [x] ✅ 99-LESSONS-LEARNED.md
- [x] ✅ MEMORY.md（项目根）
- [x] ✅ README.md（项目根）

### ADR 撰写

- [x] ✅ D-001：独立仓库策略
- [x] ✅ D-002：7 步循环
- [x] ✅ D-003：4 思想模型框架 + 5 策略模式
- [x] ✅ D-004：8 项追问产出
- [x] ✅ D-005：L5 三子项
- [x] ✅ D-006：配置化（YAML/飞书表格）
- [x] ✅ D-007：4 内置框架 + 12 模型
- [x] ✅ D-008：苏格拉底 3 阶段学习

### Legacy 复制

- [ ] ⏳ 复制 ContentForge 到 `docs/legacy/contentforge/`
- [ ] ⏳ 复制 PRISM-OS 到 `docs/legacy/prismos/`

---

## v1.0 MVP 实施

### 阶段 0：基础设施（3 天）

- [ ] ⏳ 初始化 Python 项目（pyproject.toml / uv）
- [ ] ⏳ 配置 ruff / mypy / pytest
- [ ] ⏳ 实现 `config/loader.py`
- [ ] ⏳ 实现 `store/file_store.py`
- [ ] ⏳ 实现 `state/machine.py`
- [x] ✅ 写 8 个 ADR（D-001 ~ D-008）
- [ ] ⏳ 复制源项目到 `legacy/`

### 阶段 1：苏格拉底追问（3-4 天）

- [ ] ⏳ 实现 `socratic/questions.py`（6 问模板）
- [ ] ⏳ 实现 `socratic/engine.py`（追问主循环）
- [ ] ⏳ 实现 `socratic/output.py`（8 项产出）
- [ ] ⏳ 实现 `socratic/learning.py`（3 阶段学习）
- [ ] ⏳ 实现 `socratic/ui/`（TUI）
- [ ] ⏳ 端到端测试（mock LLM）

### 阶段 2：思想模型（3-4 天）

- [x] ✅ 写 `config/thinking_models/models.yaml`（12 模型）
- [x] ✅ 写 `config/thinking_models/frameworks.yaml`（4 框架）
- [x] ✅ 实现 `thinking_models/registry.py`（YAML 加载）
- [x] ✅ 实现 `thinking_models/framework_selector.py`（关键词匹配）
- [x] ✅ 实现 `thinking_models/strategies.py`（5 策略：chain/parallel/nested/divergent_then_convergent/condition）
- [x] ✅ 端到端测试（42 个 thinking_models 测试 + 117 个全量测试全过）

### 阶段 3：蓝图（2-3 天）

- [x] ✅ 实现 `blueprint/designer.py`（CCOS 14 项映射 + LLM 注入）
- [x] ✅ 实现 `blueprint/anchors.py`（Anti-AI 锚点池构建 + 段位分配）
- [x] ✅ 实现 `blueprint/sections.py`（核心 5 段 + 5 种内容类型推荐可选）
- [x] ✅ 实现 `blueprint/models.py`（SectionRole / Case / DataPoint / Quote / AntiAIAnchors / Section / Blueprint）
- [ ] ⏳ 实现 `blueprint/ui/`（TUI — 推迟到 v1.1）
- [x] ✅ 端到端测试（47 个蓝图测试 + 全量 164 测试无回归）

### 阶段 4：草稿（2-3 天）

- [ ] ⏳ 实现 `draft/section_prompt.py`
- [ ] ⏳ 实现 `draft/generator.py`
- [ ] ⏳ 写 prompt 模板
- [ ] ⏳ 端到端测试

### 阶段 5：打磨（2-3 天）

- [ ] ⏳ 实现 `polish/dimensions/6_old.py`
- [ ] ⏳ 实现 `polish/quality_scorer.py`
- [ ] ⏳ 实现 `polish/suggester.py`
- [ ] ⏳ 端到端测试

### 阶段 6：沉淀（1-2 天）

- [ ] ⏳ 实现 `sediment/harvester.py`
- [ ] ⏳ 实现 `sediment/style_updater.py`
- [ ] ⏳ 端到端测试

### 阶段 7：流程集成（2-3 天）

- [ ] ⏳ 实现 `pipeline/orchestrator.py`
- [ ] ⏳ 实现 `pipeline/steps/`
- [ ] ⏳ 实现 `cli/commands/run.py`
- [ ] ⏳ 端到端测试（真实 LLM 跑通 1 篇）

---

## v1.1+ 任务

详见 [09-ROADMAP-V2](09-ROADMAP-V2.md) + [06-DEV-PLAN](06-DEV-PLAN.md)。

---

## 任务依赖

```
阶段 0 → 阶段 1 → 阶段 2 → 阶段 3 → 阶段 4 → 阶段 5 → 阶段 6 → 阶段 7
```

---

## 维护规范

- 状态：⏳ 待办 / 🚧 进行中 / ✅ 完成 / ❌ 阻塞
- 阻塞时记录原因在 [15-ISSUES](15-ISSUES.md)
- 完成时更新 [11-PROGRESS](11-PROGRESS.md)
- 优先级：P0 / P1 / P2（见 [06-DEV-PLAN](06-DEV-PLAN.md)）
