# 炉 — 项目记忆

> 上下文恢复核心。任何时候接手，先读本文件。
> 维护规范：每次任务结束更新。

---

## 当前状态（2026-06-18）

- **项目阶段**：v2 P0 Embedding 已完成，待 commit + push
- **下一步**：commit → push origin main
- **实施进度**：
  - v1.0 ✅ / v1.1 ✅ / v1.1 收尾 ✅ / v1.2 ✅ / v1.3 ✅ / v1.4 ✅
  - v2 P0 飞书配置 ✅ / 阶段 2-3 学习 ✅ / **Embedding ✅**

---

## 快速验证命令

> v1+v2 实施阶段。当前阶段：

```bash
# 全量测试（465/465）
PYTHONPATH=src python -m pytest

# v1 dry-run 烟雾测试
PYTHONPATH=src python -m lu.cli.run "测试命题" --dry-run

# v2 P0 embedding 烟雾测试（.env 已从兄弟项目同步真实 key，CLI 自动加载）
PYTHONPATH=src python -m lu.cli.embedding embed "测试文本"
PYTHONPATH=src python -m lu.cli.embedding recall "测试" --top-k 3

# 如无 .env，复制 .env.example 后填入 key
cp .env.example .env

# 文档完整性
ls docs/         # 应有 19+ 个 .md
ls docs/decisions/  # 应有 9 个 ADR（D-001 ~ D-009）
ls docs/development/  # v2 阶段方案
ls .env.example  # 存在
```

---

## 当前进度

### 已完成
- ✅ 炉 项目初始化（CLAUDE.md / .gitignore）
- ✅ ContentForge + PRISM-OS 深度理解
- ✅ 6 层面方案对齐（边界/目标/架构/模块/技术/文档）
- ✅ 19 个文档清单敲定
- ✅ 8 个核心日常更新文档确认
- ✅ v2 / 长期规划拆分
- ✅ 经验教训沉淀清单（F1-F11 + D1-D9 + P1-P14 + 规则 0）
- ✅ 19 个项目文档全部完成
- ✅ 9 个 ADR（D-001 ~ D-009）全部完成
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
- ✅ v2 P0 飞书配置（v1.2 已覆盖）
- ✅ v2 P0 阶段 2-3 学习（SampleStore + Learner + Engine 集成）
- ✅ v2 P0 Embedding 语义匹配（91 新增测试，465/465 全量通过）

### 待办
- ⏳ commit + push v2 P0 Embedding
- ⏳ v2.x：飞书真实 API / 自定义模型 / 高级策略模式 / 跨设备同步

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
| D-009 | Embedding 语义匹配选型（OpenAI-compatible + JSONL + warn-and-skip） | ✅ 2026-06-18 |

---

## 已知卡点

无。

---

## 待用户决策

无 — 继续按 DEV-PLAN 推进阶段 3-7。

---

## 关键文档快速跳转

- 项目总览：[00-PROJECT-OVERVIEW](docs/00-PROJECT-OVERVIEW.md)
- 经验教训：[99-LESSONS-LEARNED](docs/99-LESSONS-LEARNED.md)
- 决策记录：[12-DECISION-LOG](docs/12-DECISION-LOG.md)
- ADR 索引：[docs/decisions/](docs/decisions/)
- 任务分解：[14-TASKS](docs/14-TASKS.md)
