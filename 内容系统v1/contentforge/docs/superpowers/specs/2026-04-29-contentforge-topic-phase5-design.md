# ContentForge Topic Phase 5 — 碎片健康报告

## 1. 目标与定位

**核心目标**：`learn --decay` 在执行衰减扫描后，生成结构化碎片健康报告，替代当前只打印数字的简陋输出。

**服务场景**：用户跑 `learn --decay` 后，自然看到一份有决策价值的健康报告 —— 碎片库缺什么、该补什么。

---

## 2. 当前 vs 目标输出

### 2.1 当前 `--decay` 输出

```
🔄 碎片 decay 扫描完成
扫描前状态: active: X  dormant: X  expired: X
本次更新:   新增 dormant: X  新增 expired: X
扫描后状态: active: X  dormant: X  expired: X
```

只有数字，没有判断。

### 2.2 目标输出（结构化报告）

```
📊 碎片健康报告

整体健康度: ██████░░░░ 62% (156/252)
状态: ⚠️ 良好，但 dormant 比例偏高

── 衰减分布 ─────────────────────────────
active   156 (62%)  ████████████████
dormant   71 (28%)  ████████
expired   25 (10%)  ███

── 类型健康度 ───────────────────────────
句式碎片:
  hook              23  [████████████] active
  transition        18  [████████░░░░] ⚠️ 3 dormant
  cta               12  [██████░░░░░░] ⚠️ 4 dormant 2 expired
  power-line         9  [████░░░░░░░░] 🔴 3 dormant 2 expired

段落碎片:
  opening           31  [████████████████] active
  argument          28  [██████████████░░] ⚠️ 2 dormant
  emotional-peak    19  [██████████░░░░░] ⚠️ 5 dormant 1 expired
  closing           16  [████████░░░░░░] ⚠️ 3 dormant 1 expired

── 来源衰减对比 ──────────────────────────
edited   89  active: 67 (75%)  dormant: 16 (18%)  expired: 6 (7%)
external  163  active: 89 (55%)  dormant: 55 (34%)  expired: 19 (12%)

── 烧坏碎片 (使用≥5次) ───────────────────
  5个碎片因过度使用已标记为 dormant，建议重写或替换

── 行动建议 ─────────────────────────────────
1. [高] power-line 碎片严重不足（仅9个，且40%已过期），建议从 external 文章补充
2. [中] emotional-peak 段落偏少，建议补充情绪递进类案例
3. [低] cta 碎片有2个已过期，可从高互动 external 文章提取
4. [通知] 5个"烧坏"碎片，建议下次 create 时手动排除或重写
```

---

## 3. 设计要点

### 3.1 健康度评分

```
healthScore = (active / total) * 100
```

| 评分 | 状态词 | 说明 |
|------|--------|------|
| 80-100 | 优秀 | 碎片库活跃，无需干预 |
| 60-79 | 良好 | 基本健康，部分类型可补充 |
| 40-59 | ⚠️ 预警 | 多类碎片衰减，需要补充 |
| 0-39 | 🔴 告警 | 碎片库接近枯竭，生成质量将受影响 |

### 3.2 行动建议生成规则

建议由代码规则生成，不走 LLM（轻量、可解释）：

| 条件 | 建议 |
|------|------|
| 某类型碎片 total < 5 | 数量不足，建议补充 |
| 某类型 dormant ratio > 50% | 该类型大量衰减 |
| 有烧坏碎片（useCount ≥ 5）| 烧坏碎片需重写替换 |
| external 衰减比 edited 快 | external 来源质量不稳定 |
| expired ratio > 20% | 过期碎片过多，建议清理 |

### 3.3 与现有 `--decay` 的关系

**不改变现有 `--decay` 的逻辑**，只在输出端扩展：

- `--decay` 现在打印 6 行数字
- 改为打印结构化报告（仍是纯文本 CLI 输出）
- 数据来源完全复用现有的 `getDecayStats()` / `getStats()` / `getAllSentences()` / `getAllParagraphs()`

---

## 4. 实现清单

| 任务 | 文件 |
|------|------|
| 实现碎片健康报告生成函数 | `src/fragment-library/decay-report.ts`（新建） |
| 扩展 `runLearn` 的 `--decay` 分支 | `src/cli/commands/learn.ts` |
| 更新描述 | `.action()` 的 description |

---

## 5. 文件结构

```
src/fragment-library/
├── analyzer.ts          # 已完成
├── fragment-store.ts    # 已完成，含 getDecayStats() / decayFragments()
├── decay-report.ts      # 新增：报告生成
└── types.ts             # 已完成

src/cli/commands/learn.ts  # 扩展：--decay 改为输出报告
```

---

## 6. 阶段依赖

- Phase 1 ✅
- Phase 2 ✅
- Phase 3 ✅
- Phase 4 ✅
- **Phase 5（本文）**：`learn --decay` 输出结构化健康报告
- Phase 6（📋 待启动）：Decay 通知功能（通知只是形式，Phase 5 报告型是当前最优解）