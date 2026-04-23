# contentforge-revision 设计方案

> 日期：2026-04-23
> 状态：已批准

## 核心定位

解决"生成不满意怎么办"的痛点。用户可在 `create`/`recreate` 完成后发起增量修订，通过 TUI 选元素 + 自由对话打磨内容，满意后自动进入审查流程。

## 触发时机

- **显式**：`node dist/index.js revise <runId>`
- **自动**：`create`/`recreate` 完成后询问"满意吗？[y/n/r]"，用户按 `r` 进入 revision

## 完整流程

```
create/recreate 完成
      ↓
生成后询问："这版满意吗？[y/n/r]"
      ↓
用户按 r → 进入 revision pipeline（新 runId，parentRunId = 原始生成）
      ↓
Step R0: TUI 选择修订元素（标题/hook/正文/CTA/案例/金句，可多选）
      ↓
Step R1: 自由对话 → AI 理解指令 → 执行修订
      ↓
展示修订结果 + appliedTriggers 日志
      ↓
询问："这版可以吗？[y/n]"
  y → 持久化到原 runId lineage，进入 review-optimization
  n → 继续 R1（循环）
```

## 修订元素（内容级）

| 元素 | 说明 | 跨平台 |
|------|------|--------|
| `title` | 标题 | 是（可按平台独立改） |
| `hook` | 开头 1-3 段 | 是 |
| `body` | 正文段落（用户可指定位置） | 是 |
| `cta` | 结尾召唤 | 是 |
| `example` | 案例替换 | 是 |
| `power-sentence` | 金句补插 | 是 |

每轮 revision 可在同一元素上叠加（如"hook 再更有冲击力一点"）。

## 版本模型

- **原 runId** (`<original-runId>/revisions/`)：
  - `revisions/manifest.json` — 版本列表（父版本 hash、appliedTriggers、时间戳）
  - `revisions/v1.md`, `v2.md`... — 各版本内容快照（只保留最终确认版）
- **新 runId**（`<new-runId>/`）：当前活动版本，含 `parentRunId` 指向原始 runId

CLI 命令：
- `revise --list <runId>` — 查看版本列表
- `revise --revert <runId>:<version>` — 回退到指定版本

## 上下文恢复

从 `parentRunId` 恢复完整 context：
- `topic-analysis-confirmed`（含 excludeDirections）
- `topic-assignment-confirmed`
- `outline-{platform}` 各平台大纲
- `viral-genome`（recreate 场景）
- `fragment-library` 相关碎片

## 与 review-optimization 的衔接

用户确认后自动进入 `review-optimization`，无需重新触发 create/recreate pipeline。

## TUI 交互设计

### 元素选择（TUI）

```
╔════════════════════════════════════════╗
║  Revision — 选择要修订的元素           ║
╠════════════════════════════════════════╣
║  [×] 标题 (title)           3个平台     ║
║  [ ] Hook (开头)            3个平台     ║
║  [ ] 正文 (body)            3个平台     ║
║  [ ] CTA (结尾召唤)         3个平台     ║
║  [ ] 案例 (example)         3个平台     ║
║  [ ] 金句 (power-sentence)   3个平台     ║
╠════════════════════════════════════════╣
║  ↑↓ 移动  空格 选中  回车 确认        ║
╚════════════════════════════════════════╝
```

### 自由对话

```
已选中：标题(wechat)、Hook(xiaohongshu)

请说明要怎么改（直接描述，比如"标题更有冲击力，hook 更短更有劲"）：
> hook 再精炼一点，第一句换成问题
```

## 架构要点

- `RevisionPipeline` 独立于 `CreatePipeline`/`RecreatePipeline`，三者并列
- 共用 `context` 层、共享 `fragment-library`
- `LocalRewriteStep` 的 `appliedTriggers` 增量改写机制可复用
- 历次 appliedTriggers 传入 prompt，防止 AI 重复犯错
- 版本只持久化最终确认版，中间版本不存储

## 数据流

```
[原始生成 runId]
     │
     │ parentRunId
     ↓
[Revision runId v1] → 用户确认
     │                   ↓
     │              [原始 runId/revisions/] 持久化 lineage
     │                   ↓
     │              [review-optimization]
     │
[Revision runId v2] → 用户继续改...
```

## CLI 接口

```bash
# 从生成结果进入修订
node dist/index.js create --keyword "AI"    # 完成后按 r
node dist/index.js recreate --input x.md     # 完成后按 r

# 显式修订
node dist/index.js revise <runId>

# 版本管理
node dist/index.js revise --list <runId>
node dist/index.js revise --revert <runId>:v2
```
