# 炉 — 项目记忆

> 上下文恢复核心。任何时候接手，先读本文件。
> 维护规范：每次任务结束更新。

---

## 当前状态（2026-06-16）

- **项目阶段**：方案已对齐，文档已完成，legacy 快照已就绪
- **下一步**：进入 v1.0 MVP 实施
- **实施**：未开始（基础设施 + 阶段 1 苏格拉底）

---

## 快速验证命令

> v1 实施阶段才有验证命令。当前阶段：

```bash
# 文档完整性
ls docs/         # 应有 19 个 .md
ls docs/decisions/  # 应有 8 个 ADR
ls legacy/       # 源项目快照（待复制）
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
- ✅ 8 个 ADR（D-001 ~ D-008）全部完成

### 待办
- ⏳ v1.0 MVP 实施（phases 0-7，按 `docs/06-DEV-PLAN.md`）
  - 阶段 0：pyproject.toml + uv + config/loader + store/file_store + state/machine
  - 阶段 1：socratic/（questions + engine + output + learning）
  - 阶段 2：thinking_models/（4 框架 + 5 策略）
  - 阶段 3-7：blueprint / draft / polish / sediment / pipeline / CLI

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

---

## 已知卡点

无。

---

## 待用户决策

下一步进入哪条路径：
1. 复制源项目快照 → 进入 v1.0 MVP 实施
2. 暂停 / 回顾 / 补漏
3. 其他

---

## 关键文档快速跳转

- 项目总览：[00-PROJECT-OVERVIEW](docs/00-PROJECT-OVERVIEW.md)
- 经验教训：[99-LESSONS-LEARNED](docs/99-LESSONS-LEARNED.md)
- 决策记录：[12-DECISION-LOG](docs/12-DECISION-LOG.md)
- ADR 索引：[docs/decisions/](docs/decisions/)
- 任务分解：[14-TASKS](docs/14-TASKS.md)
