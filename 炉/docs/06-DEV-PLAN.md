# 06 — 开发计划

> 版本：v1.0 草稿 | 状态：方案已对齐
> 维护：每里程碑复盘一次，更新工期/优先级

## 1. 总览

### 1.1 v1 路线图

| 版本 | 名称 | 核心 | 状态 |
|------|------|------|------|
| v1.0 | MVP | 7 步循环 + 苏格拉底 + 思想模型 + 6 维评分 + L5 三子项 | 已完成 |
| v1.1 | LLM+持久化+Obsidian | + 真实 LLM provider + 运行持久化 + Obsidian 素材库写入 | 实施中 |
| v1.2 | TUI+飞书基础 | + TUI 交互 + 灵感池 + 反馈数据 | 待启动 |
| v1.3 | 爆款二创 | + ViralGenome 拆解 | 待启动 |
| v1.4 | 复盘/雷达 | + 周报/雷达/复盘 | 待启动 |

### 1.2 时间预算

| 阶段 | 内容 | 工期估算 |
|------|------|----------|
| **当前** | v1.1：LLM provider + 持久化 + Obsidian | 1 周 |
| v1.0 | 核心 7 步实现 | 2-3 周 |
| v1.1 | L5 三子项（已在 v1.0 实现） | - |
| v1.2 | TUI + 飞书基础 | 1-1.5 周 |
| v1.3 | 爆款二创 | 1-2 周 |
| v1.4 | 复盘/雷达/周报 | 1-2 周 |

> 注：v1 实施前必须 19 个文档 + legacy + decisions 完整。

---

## 2. v1.0 MVP 详细任务

### 2.1 阶段 0：基础设施（3 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 复制 ContentForge 代码到 `docs/legacy/contentforge/` | 0.5 天 | P0 | ⏳ |
| 复制 PRISM-OS 代码到 `docs/legacy/prismos/` | 0.5 天 | P0 | ⏳ |
| 初始化 Python 项目（pyproject.toml / uv） | 0.5 天 | P0 | ⏳ |
| 配置 ruff / mypy / pytest | 0.5 天 | P0 | ⏳ |
| 写 8 个 ADR（D-001 ~ D-008） | 1 天 | P0 | ✅ 已完成 |

**TDD 步骤**：
1. 写 `test_config_loader.py`（失败）→ 实现 `config/loader.py`
2. 写 `test_file_store.py`（失败）→ 实现 `store/file_store.py`
3. 写 `test_state_machine.py`（失败）→ 实现 `state/machine.py`

### 2.2 阶段 1：苏格拉底追问（3-4 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 实现 `socratic/questions.py`（6 问模板） | 0.5 天 | P0 | ⏳ |
| 实现 `socratic/engine.py`（追问主循环） | 1 天 | P0 | ⏳ |
| 实现 `socratic/output.py`（8 项产出格式化） | 0.5 天 | P0 | ⏳ |
| 实现 `socratic/learning.py`（3 阶段学习） | 1 天 | P1 | ⏳ |
| 实现 `socratic/ui/`（TUI 交互） | 0.5 天 | P0 | ⏳ |
| 端到端测试（mock LLM） | 0.5 天 | P0 | ⏳ |

**关键 TDD 测试**：
- `test_socratic_engine_ask_q1_first` — 第一次问 Q1
- `test_socratic_engine_q1_vague_triggers_followup` — 含糊触发追问
- `test_socratic_output_8_fields_complete` — 8 项产出完整
- `test_socratic_learning_phase1_user_says_stop` — 阶段 1 用户说停

### 2.3 阶段 2：思想模型（3-4 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 写 `config/thinking_models/models.yaml`（12 模型卡片） | 0.5 天 | P0 | ⏳ |
| 写 `config/thinking_models/frameworks.yaml`（4 框架） | 0.5 天 | P0 | ⏳ |
| 实现 `thinking_models/registry.py`（YAML 加载） | 0.5 天 | P0 | ⏳ |
| 实现 `thinking_models/framework_selector.py` | 0.5 天 | P0 | ⏳ |
| 实现 `thinking_models/model_runner.py`（5 种 strategy） | 1.5 天 | P0 | ⏳ |
| 端到端测试 | 0.5 天 | P0 | ⏳ |

**关键 TDD 测试**：
- `test_framework_selector_chooses_decision_analysis_for_choice_topic` — 选 framework
- `test_model_runner_chain_executes_in_order` — chain 顺序
- `test_model_runner_parallel_executes_concurrently` — parallel 并行
- `test_model_runner_nested_executes_layered` — nested 嵌套
- `test_model_runner_divergent_then_convergent` — 发散→收敛

### 2.4 阶段 3：蓝图（2-3 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 实现 `blueprint/designer.py`（CCOS 14 项映射） | 1 天 | P0 | ⏳ |
| 实现 `blueprint/anchors.py`（Anti-AI 锚点池） | 0.5 天 | P0 | ⏳ |
| 实现 `blueprint/sections.py`（8 段选择） | 0.5 天 | P0 | ⏳ |
| 实现 `blueprint/ui/`（TUI 段位选择） | 0.5 天 | P0 | ⏳ |
| 端到端测试 | 0.5 天 | P0 | ⏳ |

**关键 TDD 测试**：
- `test_blueprint_designer_maps_14_items` — 14 项映射
- `test_blueprint_anchors_pool_complete` — 锚点池完整
- `test_blueprint_sections_recommend_by_content_type` — 按内容类型推荐

### 2.5 阶段 4：草稿（2-3 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 实现 `draft/section_prompt.py`（每段 prompt 构建） | 1 天 | P0 | ⏳ |
| 实现 `draft/generator.py`（每段独立生成） | 1 天 | P0 | ⏳ |
| 写 prompt 模板（8 段 × 1 套） | 0.5 天 | P0 | ⏳ |
| 端到端测试 | 0.5 天 | P0 | ⏳ |

**关键 TDD 测试**：
- `test_section_prompt_includes_style_fingerprint` — 风格指纹注入
- `test_section_prompt_includes_forbidden_list` — 必避免注入
- `test_section_prompt_includes_anti_ai_anchors` — 锚点注入
- `test_draft_generator_section_failure_retries` — 单段失败重试

### 2.6 阶段 5：打磨（2-3 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 实现 `polish/dimensions/6_old.py`（6 维评分） | 1.5 天 | P0 | ⏳ |
| 实现 `polish/quality_scorer.py`（多维度调用） | 0.5 天 | P0 | ⏳ |
| 实现 `polish/suggester.py`（修复建议） | 0.5 天 | P0 | ⏳ |
| 端到端测试 | 0.5 天 | P0 | ⏳ |

**关键 TDD 测试**：
- `test_quality_scorer_6_dimensions_independent` — 6 维独立
- `test_quality_scorer_returns_passed_threshold` — 7.5 阈值
- `test_suggester_generates_actionable_suggestions` — 建议可执行

### 2.7 阶段 6：沉淀（1-2 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 实现 `sediment/harvester.py`（产物提取） | 0.5 天 | P0 | ⏳ |
| 实现 `sediment/style_updater.py`（画像更新） | 0.5 天 | P0 | ⏳ |
| 端到端测试 | 0.5 天 | P0 | ⏳ |

### 2.8 阶段 7：流程集成（2-3 天）

| 任务 | 工期 | 优先级 | 状态 |
|------|------|--------|------|
| 实现 `pipeline/orchestrator.py`（7 步调度） | 1 天 | P0 | ⏳ |
| 实现 `pipeline/steps/`（7 个 step） | 1 天 | P0 | ⏳ |
| 实现 `cli/commands/run.py`（CLI 入口） | 0.5 天 | P0 | ⏳ |
| 端到端测试（真实 LLM 跑通 1 篇） | 0.5 天 | P0 | ⏳ |

**关键里程碑**：
- 阶段 7 完成 = v1.0 MVP 完成
- 可演示：从命题输入到沉淀回写完整跑通

### 2.9 v1.0 总工期

- **总工期估算**：12-18 天（单人）
- **依赖**：19 个文档 + legacy + decisions 完整
- **风险**：LLM 调用成本/质量波动 → 用 mock + 小样本验证

---

## 3. v1.1 L5 评分

### 3.1 任务

| 任务 | 工期 | 状态 |
|------|------|------|
| 实现 `polish/dimensions/观点锐度.py` | 0.5 天 | ⏳ |
| 实现 `polish/dimensions/思想模型应用.py` | 0.5 天 | ⏳ |
| 实现 `polish/dimensions/事实准确性.py` | 0.5 天 | ⏳ |
| 集成到 quality_scorer | 0.5 天 | ⏳ |
| 端到端测试 | 0.5 天 | ⏳ |

**总工期**：2-3 天

---

## 4. v1.2 飞书基础

### 4.1 任务

| 任务 | 工期 | 状态 |
|------|------|------|
| 写 lark-cli 调用封装 | 0.5 天 | ⏳ |
| 实现灵感池（写入） | 0.5 天 | ⏳ |
| 实现反馈数据（读取） | 0.5 天 | ⏳ |
| 端到端测试 | 0.5 天 | ⏳ |

**总工期**：1.5-2 天

---

## 5. v1.3 Obsidian

### 5.1 任务

| 任务 | 工期 | 状态 |
|------|------|------|
| 实现 `store/obsidian.py`（写入案例/金句/洞察） | 1 天 | ⏳ |
| 写 Obsidian 模板（Case / Quote / Insight） | 0.5 天 | ⏳ |
| 端到端测试 | 0.5 天 | ⏳ |

**总工期**：2-3 天

---

## 6. v1.4 爆款二创

### 6.1 任务

| 任务 | 工期 | 状态 |
|------|------|------|
| 实现 `recreate/viral_deconstruction.py`（ViralGenome 拆解） | 1 天 | ⏳ |
| 实现 `recreate/differentiation.py`（差异化） | 0.5 天 | ⏳ |
| 实现 `recreate/draft.py`（重写） | 0.5 天 | ⏳ |
| 端到端测试 | 0.5 天 | ⏳ |

**总工期**：2-3 天

---

## 7. 任务依赖图

```
v1.0 MVP:
  阶段 0（基础设施）
    ↓
  阶段 1（苏格拉底）
    ↓
  阶段 2（思想模型）
    ↓
  阶段 3（蓝图）
    ↓
  阶段 4（草稿）
    ↓
  阶段 5（打磨 - 6 维）
    ↓
  阶段 6（沉淀）
    ↓
  阶段 7（流程集成）
    ↓
  v1.0 完成
    ↓
  v1.1（L5）→ v1.2（飞书）→ v1.3（Obsidian）→ v1.4（爆款二创）
```

---

## 8. 风险与缓解

### 8.1 技术风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| LLM 质量波动 | 评分不达标 | 严格 prompt + 多次采样选最优 |
| 8 维度评分实现复杂 | 超期 | 1.0 先 6 维，1.1 加 L5 |
| 思想模型 strategy 难实现 | 超期 | 1.0 先支持 chain + parallel，nested/divergent 后置 |

### 8.2 进度风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 单人开发 | 进度慢 | 砍 v1.4 爆款二创到 v2 |
| LLM 成本失控 | 资金 | 设置单篇调用预算 |
| 测试覆盖不足 | 质量差 | 阶段 0 强制 80% |

---

## 9. 验收清单

### 9.1 v1.0 MVP 验收

- [ ] 19 个文档 + legacy + decisions 完整
- [ ] 8 个 ADR 写完
- [ ] 核心模块测试覆盖率 ≥ 80%
- [ ] 端到端测试通过（mock + 真实 LLM 各 1 篇）
- [ ] CLI 可用：`炉 run "命题"` 全流程跑通
- [ ] 8 维度评分 ≥ 7.5（mark 亲自验收）
- [ ] 必避免列表命中 ≤ 2/篇
- [ ] 7 步全跑时间 ≤ 10 分钟

### 9.2 v1.1+ 验收

每个版本独立验收：
- 功能跑通
- 测试通过
- 端到端验证
- mark 验收

---

## 10. 关联文档

- PRD：[01-PRD](01-PRD.md)
- 架构：[02-ARCHITECTURE](02-ARCHITECTURE.md)
- 模块设计：[03-MODULE-DESIGN](03-MODULE-DESIGN.md)
- 测试方案：[07-TEST-PLAN](07-TEST-PLAN.md)
- 里程碑：[13-MILESTONES](13-MILESTONES.md)
- 任务分解：[14-TASKS](14-TASKS.md)
