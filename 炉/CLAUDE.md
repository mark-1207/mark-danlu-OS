# 炉 — ContentForge × PRISM-OS 融合项目

## 目标

融合两个源项目的能力，构建新一代内容生产引擎。

## 源项目（不要动，只读 + 引用）

- **ContentForge** — `D:\myproject\内容系统v1\contentforge`（TypeScript）
  - 多平台内容生成（公众号/小红书/抖音）| 6 步 create / 5 步 recreate / opinion / short
  - 17 个 CLI 子命令 | 飞书 3 表 + Obsidian 素材库 | 六维质量 + L1/L2 检查
  - LLM 链：openai(mimo) → kimi → anthropic，Embedding：zhipu → openai → tavily → google

- **PRISM-OS** — `D:\myproject\PRISM-OSv1`（Python）
  - 13 phases Pipeline：Intent → Gateway → Prism(4 维 × 3 = 12 标题) → CCOS(14 项大纲) → Gap → 刺客/裂缝/数字分身 → Narrate
  - 认知澄清驱动的内容蓝图生成 | LLM 3 级 fallback：Kimi → NVIDIA NIM → OpenRouter

## 工作流

- 方案/设计 → `docs/`
- 代码迁移 → `src/`（待定）
- 测试 → `tests/`（待定）
- 计划 → `plans/`

## 暂定原则

- 暂不删/改源项目，融合在 炉 里做（必要时回到源项目提交）
- TDD + 端到端验证
- 直推 main，单 PR 完整提交
- 每次 commit 前确保可跑 + 测试通过

## 关键决策待定

1. 融合方向（吸收 / 桥接 / 重写）
2. 技术栈统一（TS 单边 / Python 单边 / 双语混部）
3. 阶段拆分与里程碑
