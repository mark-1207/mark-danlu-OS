# ContentForge Topic Phase 4 — 竞品风格报告

## 1. 目标与定位

**核心目标**：`learn --include-competitor` 在增量分析竞品数据后，生成竞品风格摘要报告，写入 `output/corpus/competitor-style-report.md`，供市场调研参考。

**设计原则**：竞品内容仅作市场参考，**不混入**个人风格 Profile。Profile 只能从用户自己和外部参考文章中学习，竞品数据是外部市场情报，两者严格分离。

**服务场景**：用户执行 `learn --include-competitor` 时，读取飞书竞品库（analyzed/stored 状态）→ AI 分析 → 输出风格报告。

---

## 2. 设计决策

### 2.1 竞品 vs Profile 隔离

| 数据来源 | 写入位置 | 用途 |
|----------|----------|------|
| 用户改写（edited） | fragment-library.json + styleProfile | 个人风格画像 |
| 外部参考（external） | fragment-library.json + styleProfile | 个人风格画像 |
| 竞品（analyzed/stored） | competitor-style-report.md | 市场参考，不进 Profile |

**Why**：如果把竞品风格混入 Profile，生成内容会潜移默化地向竞品靠拢，失去差异化。

---

## 3. 流程设计

### 3.1 命令扩展

```bash
# 原有
node dist/index.js learn

# 新增 flag
node dist/index.js learn --include-competitor
```

`--include-competitor` 为独立步骤，在 `--stats` / `--list` 等现有模式互斥。

### 3.2 执行流程

```
learn --include-competitor
         │
         ▼
Step A: 读缓存（Phase 3 competitor-cache）
         ├─ 缓存命中且未过期 → 直接用缓存记录
         └─ 缓存过期或缺失 → 读飞书 analyzed/stored 记录（最多10条）
         │
         ▼
Step B: AI 分析竞品集合
         ├─ 读取字段：标题、选题角度、爆款结构、平台、收藏
         └─ 输出：竞品风格摘要 + 结构偏好
         │
         ▼
Step C: 写入 competitor-style-report.md
         │
         ▼
Step D: 继续原有 learn 增量分析（如有 external/edited）
```

### 3.3 竞品数据读取（复用 Phase 3 缓存）

`competitor-cache.ts` 的 `fetchCompetitiveRecords()` 已实现：
- 筛选 `状态 === 'analyzed' || 'stored'`
- 按 `收藏优先 + 抓取时间倒序` 取 top 10
- 字段：`原文标题 / 选题角度 / 爆款结构 / 平台 / 收藏`

Phase 4 直接调用 `fetchCompetitiveRecords()`，不重复读飞书。

---

## 4. 输出结构

### 4.1 competitor-style-report.md

```markdown
# 竞品风格报告

> 生成时间：2026-04-29T14:30:00Z  
> 数据来源：飞书竞品素材库（analyzed/stored，共 N 条）  
> 缓存状态：命中 / 未命中

---

## 一、整体市场风格概述

（AI 根据竞品集合归纳的整体风格倾向：话题类型、情绪基调、叙事节奏）

---

## 二、结构偏好分析

### 2.1 常见开头模式

（归纳 top 3 开头句式/角度）

### 2.2 主流叙事结构

（归纳最常见的内容框架，如：问题+案例+结论 / 情绪递进+高潮+行动 等）

### 2.3 结尾/CTA 模式

（归纳常见收尾方式）

---

## 三、内容角度分布

| 角度类型 | 出现频次 | 代表标题 |
|----------|----------|----------|
| AI焦虑恐慌 | 高（5条） | xxx |
| 职场应用 | 中（3条） | xxx |

---

## 四、高绩效内容特征

（收藏: true 的记录中，提炼高互动内容的共同特征）

---

## 五、差异化机会建议

（基于以上分析，AI 给出的差异化切入建议）

---

## 六、原始数据摘要

### 收藏内容（Top 5）

| 标题 | 平台 | 角度 |
|------|------|------|
| ... | ... | ... |

### 最新抓取（Top 5）

| 标题 | 平台 | 时间 |
|------|------|------|
| ... | ... | ... |
```

---

## 5. 缓存策略

### 5.1 复用 Phase 3 缓存

Phase 4 **不独立建缓存**，直接调用 `competitor-cache.ts` 的：
- `readCache(keyword)` — 读 Phase 3 写入的竞品聚合缓存
- `isCacheExpired(keyword, cachedAt)` — 判断是否过期

**但是**：Phase 3 缓存是针对特定 keyword 的，Phase 4 的竞品报告是**全库视角**（不看 keyword），所以：
- Phase 4 不走 `readCache(keyword)`
- Phase 4 每次直接从 `fetchCompetitiveRecords()` 读飞书（最多10条）
- Phase 4 自己写一个 `output/corpus/competitor-style-report-meta.json` 记录元数据（生成时间、来源记录数）

### 5.2 报告过期策略

- 每次 `learn --include-competitor` 都重新生成报告（轻量操作）
- 如报告存在且飞书数据无更新（`fetchCompetitiveRecords` 返回记录数 == meta 中记录数 且时间未变），可跳过 AI 调用（可选优化）

---

## 6. 错误处理

| 场景 | 处理 |
|------|------|
| 飞书读取失败 | 报错退出，提示检查网络/凭证 |
| 竞品库为空（0条记录） | 警告提示"竞品库暂无 analyzed/stored 记录"，报告标记为空状态 |
| AI 分析失败 | 写入原始数据摘要部分，跳过分析部分，写入错误备注 |
| 报告写入失败 | 报错退出（报告是核心产出，不可静默失败） |

---

## 7. 实现清单

| 任务 | 文件 |
|------|------|
| 扩展 `learn.ts` CLI | `src/cli/commands/learn.ts` — 新增 `--include-competitor` option |
| 实现竞品报告生成器 | `src/scenarios/topic/competitor-style-report.ts` — 新建 |
| 扩展 `learn.ts` runLearn | 调用报告生成器 |
| 报告写入 | `output/corpus/competitor-style-report.md` |
| 元数据写入 | `output/corpus/competitor-style-report-meta.json` |

---

## 8. 文件结构

```
src/
├── cli/commands/learn.ts                    # 扩展：--include-competitor
└── scenarios/topic/
    ├── competitor-cache.ts                  # 复用：fetchCompetitiveRecords()
    └── competitor-style-report.ts           # 新增：竞品报告生成

output/corpus/
├── fragment-library.json                    # 已有
├── competitor-style-report.md               # 新增：竞品风格报告
└── competitor-style-report-meta.json        # 新增：报告元数据
```

---

## 9. 阶段依赖

- Phase 1 ✅：抓取 + AI 分析 + 写入飞书
- Phase 2 ✅：碎片提取 + 碎片库同步
- Phase 3 ✅：选题时注入竞品洞察
- **Phase 4（本文）**：`learn --include-competitor` 生成竞品风格报告
- Phase 5（📋 待启动）：Decay 通知功能