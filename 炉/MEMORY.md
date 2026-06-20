# 炉 — 项目记忆

> 上下文恢复核心。任何时候接手，先读本文件。
> 维护规范：每次任务结束更新。

---

## 当前状态（2026-06-20）

- **项目阶段**：**v3 P0 全部完成**，可正式使用
- **下一步**：v3.x 扩展（跨设备同步 / 调度 / 飞书真实 API 完善）
- **实施进度**：
  - v1.0 ✅ / v1.1 ✅ / v1.1 收尾 ✅ / v1.2 ✅ / v1.3 ✅ / v1.4 ✅
  - v2 P0 飞书配置 ✅ / 阶段 2-3 学习 ✅ / Embedding ✅
  - **v3 P0 多模式（social / create / recreate）✅** 8 个 Phase 全部完成

---

## 快速验证命令

> v3 P0 完成。当前阶段：

```bash
# 全量测试（615+ passed, 1 xpassed）
PYTHONPATH=src python -m pytest

# v3 P0 三大模式烟雾测试（需配置 .env）
PYTHONPATH=src python -m lu.cli.create "AI 杠杆者反思" --dry-run --quiet
PYTHONPATH=src python -m lu.cli.social "AI 杠杆者反思" --platform weibo --dry-run
PYTHONPATH=src python -m lu.cli.recreate --from-file article.md --instruction "改写得更犀利" --dry-run

# 真实 API（.env 已配好）
PYTHONPATH=src python -m lu.cli.embedding embed "测试文本"
PYTHONPATH=src python -m lu.cli.embedding recall "AI" --top-k 3

# 自定义模型
lu model add --id my_m --name "我的模型" --definition "..."
lu model list
lu framework add --id my_f --name "..." --strategy chain --model-ids m1 m2

# 文档完整性
ls docs/         # 19+ .md
ls docs/decisions/  # 10 个 ADR（D-001 ~ D-010）
ls docs/development/  # v2 / v3 阶段方案
ls .env.example
```

---

## 当前进度

### 已完成

#### v1.x（v1.0 - v1.4）
- ✅ 阶段 0：基础设施（pyproject + config/loader + store/file_store + state/machine）
- ✅ 阶段 1：苏格拉底追问（questions + engine + output + learning）
- ✅ 阶段 2：思想模型（12 模型 + 4 框架 + 5 策略 + 选择器）
- ✅ 阶段 3：蓝图（designer + anchors + sections + models，47 测试）
- ✅ 阶段 4：草稿（models + section_prompt + generator，29 测试）
- ✅ 阶段 5：打磨（models + 9 dimensions + quality_scorer + suggester，49 测试）
- ✅ 阶段 6：沉淀（harvester + style_updater + models，26 测试）
- ✅ 阶段 7：流程集成（pipeline/orchestrator + CLI run + 274 测试）
- ✅ v1.1 核心 + 收尾（LLM provider + 持久化 + Obsidian + 续跑 + 反馈 + 飞书 hook）
- ✅ v1.2（TUI + 飞书 config sync）
- ✅ v1.3（爆款二创）
- ✅ v1.4（复盘 / 雷达 / 周报）

#### v2 P0
- ✅ 飞书配置（v1.2 已覆盖）
- ✅ 阶段 2-3 学习（SampleStore + Learner + Engine 集成）
- ✅ Embedding 语义匹配（智谱 → 英伟达 → OpenRouter fallback）

#### v3 P0（多模式架构）
- ✅ **Phase 1**：Orchestrator 模式化（3 模式 + 8 步状态机）
- ✅ **Phase 2**：social 模块（4 步全自动 + 微博/头条/推特）
- ✅ **Phase 3**：recreate 模块（链接/文档 + 改写指令，2 条件必须并存）
- ✅ **Phase 4**：CLI 整合（create/social/recreate + 旧命令 deprecation）
- ✅ **Phase 5**：Prism 12 标题 + Gap 分析 + TUI 全程介入（InteractiveTUIDecision）
- ✅ **Phase 6**：Critic 刺客/裂缝/分身 + 旧 run 数据迁移兼容
- ✅ **Phase 7**：飞书真实 API 集成（FeishuFeedbackSink + --feishu-feedback）
- ✅ **Phase 8**：自定义模型 CLI（lu model + lu framework add/list/remove）

### 待办（v3.x 候选）

- ⏳ 跨设备同步（飞书云文档备份 runs）
- ⏳ 调度（cron 定时跑）/ Webhook 触发
- ⏳ 飞书真实 API 完善（lark-cli 集成 + StyleProfile 实时同步）
- ⏳ 思考策略高级模式（iterate / recursive）
- ⏳ I-001 / I-002 / I-003 P1 规则细化（保留在 Issues，按需启动）

详见 `docs/14-TASKS.md`

---

## 关键决策索引

详见 `docs/decisions/D-*.md` + `docs/12-DECISION-LOG.md`

| ADR | 标题 | 状态 |
|-----|------|------|
| D-001 | 独立仓库策略（物理隔离） | ✅ 2026-06-15 |
| D-002 | 7 步循环 | ✅ 2026-06-15 |
| D-003 | 4 思想模型框架 + 5 种策略模式 | ✅ 2026-06-15 |
| D-004 | 8 项追问产出格式 | ✅ 2026-06-15 |
| D-005 | L5 三子项评分 | ✅ 2026-06-15 |
| D-006 | 配置化（YAML/飞书表格） | ✅ 2026-06-15 |
| D-007 | 4 内置框架 + 12 模型 | ✅ 2026-06-15 |
| D-008 | 苏格拉底追问 3 阶段学习机制 | ✅ 2026-06-15 |
| D-009 | Embedding 语义匹配选型 | ✅ 2026-06-18 |
| **D-010** | **v3 P0 多模式架构**（3 模式 + prompt_variant 分支） | ✅ 2026-06-20 |

---

## 已知卡点

无。

---

## 待用户决策

无 — v3 P0 收尾完成，可正式使用。

---

## 关键文档快速跳转

- 项目总览：[00-PROJECT-OVERVIEW](docs/00-PROJECT-OVERVIEW.md)
- 经验教训：[99-LESSONS-LEARNED](docs/99-LESSONS-LEARNED.md)
- 决策记录：[12-DECISION-LOG](docs/12-DECISION-LOG.md)
- ADR 索引：[docs/decisions/](docs/decisions/)
- 任务分解：[14-TASKS](docs/14-TASKS.md)
- v3 P0 架构：[D-010](docs/decisions/D-010-v3-p0-multi-mode.md)
- v3 P0 方案：[v2-p0-embedding-plan.md](docs/development/v2-p0-embedding-plan.md)
