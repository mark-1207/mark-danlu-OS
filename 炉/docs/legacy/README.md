# Legacy Source Projects

> 源项目代码快照。**只读参考**，不在此目录修改。
> 物理隔离：源项目 + 炉 独立迭代，不双向同步。

---

## ContentForge（TypeScript / Node.js）

**源路径**：`D:\myproject\内容系统v1\contentforge`
**复制日期**：2026-06-16
**版本**：当前 main 分支
**大小**：13 MB（已剔除 `.git` / `node_modules` / `dist` / `output` / `pnpm-lock.yaml` / `.env*` / `*.log`）

### 核心能力
- 多平台内容生成（公众号 / 小红书 / 抖音）
- 6 步 create / 5 步 recreate / opinion / short 子命令
- 17 个 CLI 子命令
- 飞书 3 表 + Obsidian 素材库
- 六维质量评分（温度 / 热度 / 深度 / 厚度 / 情绪曲线 / 知识迁移）+ L1 / L2
- LLM 链：openai(mimo) → kimi → anthropic
- Embedding：zhipu → openai → tavily → google

### 炉 借鉴方向
- 多平台适配 → `炉` 1.x 暂不实现，保留 v3+ 长期规划
- 六维评分 → `炉` v1.0 继承（见 `03-MODULE-DESIGN.md` Step 6）
- LLM 链 / Embedding → `炉` v1.0 简化版（见 `02-ARCHITECTURE.md` 第 1.3 节）

---

## PRISM-OS（Python 3.11）

**源路径**：`D:\myproject\PRISM-OSv1`
**复制日期**：2026-06-16
**版本**：当前 main 分支
**大小**：25 MB（已剔除 `.git` / `__pycache__` / `*.pyc` / `.env*` / `*.log`）

### 核心能力
- 13 phases Pipeline：Intent → Gateway → Prism(4 维 × 3 = 12 标题) → CCOS(14 项大纲) → Gap → 刺客/裂缝/数字分身 → Narrate
- 认知澄清驱动的内容蓝图生成
- LLM 3 级 fallback：Kimi → NVIDIA NIM → OpenRouter
- rss-hunter sibling skill
- 数字分身 / 刺客 / 裂缝 三大特征

### 炉 借鉴方向
- 苏格拉底追问 → `炉` v1.0 核心（见 `02-ARCHITECTURE.md` Step 2 + D-004 + D-008）
- 4 维 × 3 标题 → `炉` 改造为 4 思想模型框架（见 D-003 / D-007）
- CCOS 14 项 → `炉` Blueprint 字段映射（见 `02-ARCHITECTURE.md` 第 2.3 节）
- Gap Analysis → `炉` 蓝图阶段的素材就绪度

---

## 维护规范

- 本目录只读，不在此修改任何源文件
- 源项目有重大更新时，**人工评估**是否需要重新快照
- 重新快照前，先确认炉当前不依赖即将变动的代码
- 涉及 .env / API key 的源项目文件一律不复制

## 排除清单

复制时已剔除：
- `.git/` — git 历史
- `node_modules/` — npm 依赖（CF 体积大头）
- `dist/` — 构建产物
- `output/` — 运行时输出
- `__pycache__/` — Python 缓存
- `*.pyc` / `*.log` — 临时文件
- `.env*` — **敏感配置**（API key / Feishu token）
- `pnpm-lock.yaml` — 锁文件（按需再生成）

## 关联

- 决策依据：[D-001 独立仓库策略](../decisions/D-001-独立仓库策略.md)
- 借鉴映射：`/docs/00-PROJECT-OVERVIEW.md` 第七节
