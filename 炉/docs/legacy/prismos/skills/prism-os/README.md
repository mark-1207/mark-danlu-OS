# PRISM-OS

> 认知澄清与选题生成引擎 — 把模糊意图变成可执行的文章大纲

**版本**: 1.4.0

## 版本覆盖

| 代号 | 版本 | 状态 |
|------|------|------|
| V1 苏格拉底 + V2 棱镜 + V3 现实校验 | v1.0.1–v1.0.6 | ✅ |
| V1.5 Gap + 双端大纲 | v1.0.7 | ✅ |
| NVIDIA NIM + 熵值规则 | v1.0.8–v1.0.10 | ✅ |
| V2 逻辑压力 + 认知旅程 + HKR | v1.1.0–v1.2.0 | ✅ |
| V3 刺客 + 知识拓扑 + 数字分身 | v1.2.x | ✅ |
| Phase 6.0 数据反馈闭环（飞书） | v1.3.0 | ✅ |
| Calibration 接入 narrate | v1.3.1 | ✅ |
| **v1.1 模块：系列模式 + 张力/覆盖/风格/密度** | **v1.4.0** | **✅** |
| 方向选择标准化 | v1.4.0 | ✅ |
| LLM 调用优化（B1-B3 节省 ~18 calls）| v1.4.0 | ✅ |
| 决策点 UX 增强（⭐ 推荐 + 💡 差异说明）| v1.4.0 | ✅ |

## 5 秒快速开始

```bash
python scripts/prism_os.py run "为什么说AI时代下，裁员会变成一种常态化存在的潜规则"
```

## v1.4 新能力一览

- **系列模式**（`--series`）：锚点跑完后规划 3 篇后续标题，写完用 `mark_written` 标状态
- **方向选择**（决策点 1.5）：网关 pass 后展示 2-3 个切入角度 + 差异说明（LLM 生成）让你做有依据的选择
- **决策点 ⭐ 推荐**：所有决策点用规则标推荐选项（你不再需要盲选）
- **LLM 优化**：30 → ~12 calls per run（~60% 降幅），含 Logic 12→1 合并的 3 层防御
- **质量 L5+L6**：风格指纹 + 密度检查自动接入 quality_check

## 文档导航

| 文档 | 看什么 |
|------|--------|
| [README.md](./README.md)（本文） | 项目门面 + 版本覆盖 |
| [MANUAL.md](./MANUAL.md) | 真人操作手册：8 触发源命令、5 决策点 UI、6 类 FAQ |
| [SKILL.md](./SKILL.md) | 事实源：完整工作流 + 5 决策点 + 5 已知缺口 |
| [CLAUDE.md](./CLAUDE.md) | AI 必读红线：5 铁律 + 5 缺口 if-then |
| [CHANGELOG.md](./CHANGELOG.md) | 版本演进日志 |
| [references/v1.1-modules.md](./references/v1.1-modules.md) | v1.1 六模块详情 |
| [references/v1.1-llm-optimization.md](./references/v1.1-llm-optimization.md) | LLM 调用优化详情 |
| [references/v1.1-ux-enhancements.md](./references/v1.1-ux-enhancements.md) | 决策点 UX 增强详情 |
| [references/decision-points.md](./references/decision-points.md) | 5 个决策点完整规范 |
