# 5 个决策点完整规范（v1.4）

> SKILL.md § 决策点规范的详细外置。统一源。

## 总览

| 决策点 | Phase | 选项 | ⭐ 推荐逻辑 | UI 增强 |
|--------|-------|------|------------|---------|
| **0.5** | Gateway（clarify）| 回答追问 / skip | — | — |
| **1** | Prism | 1-12 / d / r / q | sort_score 最高 | 解除 50 字截断 + ⭐ |
| **1.5** | DirectionSelect | 1-N / skip | 第 1 个 | ⭐ + 💡 差异说明（LLM）|
| **2** | CCOS | c / r / q | c（默认）| — |
| **3** | Gap | 1 / 2 / 3 / q | readiness 阈值 | ⭐ |

## 决策点 0.5 — 苏格拉底追问

**位置**：`phases/gateway.py:_format_clarification_prompt`

**触发**：`gateway_result["status"] == "need_clarification" and config.interactive`

**UI 原文**：
```
━━━ 苏格拉底追问 ━━━
  1. <question_1>
  2. <question_2>
  ...
可选方向（参考）：
  1. <direction_1>
  2. <direction_2>
━━━━━━━━━━━━━━━━━━━━
请直接回答上述问题（也可以 skip 跳过）:
> 
```

**选项**：
- 用户回答追问 → 状态变 "answered"，重新跑网关
- `skip` / 空回车 → 跳过澄清，直接进入 Phase 1.5

**为什么 UX 不加强**：问题本身自解释，加 meta 是噪声

## 决策点 1 — 候选标题选择

**位置**：`phases/prism.py:_format_title_prompt`

**触发**：`prism_phase` execute() 完成后 + `interactive=True` + `len(candidates) > 1`

**UI 原文（v1.4 增强）**：
```
━━━ 候选标题列表 ━━━
[维度覆盖] ✓ reversal(2) ✗ contrarian(0)
缺失: contrarian

  1. ✓ 35 岁程序员，焦虑的不是 AI ⭐ 推荐
     HKR=0.50 | 张力=4 | reversal | opinion_assertion
     字数: 22 | 最高相似度: 0.00
     理由: 挑战"35岁必焦虑"的常识假设...
  ...
  12. ⚠️ 另一个标题
     HKR=0.30 | ...
━━━━━━━━━━━━━━━━━━━━
请选择:
  1-12  选择该编号标题（直接进入 CCOS）
  d      进入深度模式（对命题做 9 维拆解 + 生成 5 个深度标题）
  r      补生成缺失维度的标题
  q      退出
```

**选项**：
- `1-12` — 选该编号标题 → 进入 CCOS
- `d` — 进入深度模式（9 维拆解 + 5 深度标题）
- `r` — 补生成缺失维度（基于 coverage report）
- `q` — 退出 run

**⭐ 规则**：sort_by_score 最高（第一个 = 最高）

**v1.4 增强**：
- 解除 `rationale[:50]` 截断（显示完整理由）
- 第一个标题加 ` ⭐ 推荐` 标记

**stdin fallback**：⚠️ GAP-3 — stdin 不可用时静默默认选第 1 个

## 决策点 1.5 — 方向选择（v1.4 新增）

**位置**：`phases/direction_select.py:_format_prompt`

**触发**：`gateway_result["status"] == "ready_for_generation"` + `config.interactive` + `directions` 非空

**UI 原文（v1.4）**：
```
━━━ 切入方向选择 ━━━
  1. AI 让某些职业消失（失业焦虑） ⭐
     💡 聚焦被替代的恐惧视角，与其他方向的乐观基调形成对比
  2. AI 时代新职业机会
     💡 侧重红利与机会捕捉，强调如何抓住
  3. 职业选择方法论转变
     💡 聚焦方法论层面，强调旧方法失效的判断
━━━━━━━━━━━━━━━━━━━━
请选择切入方向（输入编号，或 skip 用原命题继续）:
```

**选项**：
- `1-N` — 选该方向 → `state.direction_selected` → prism thesis 注入"切入角度：..."
- `skip` / `q` — 跳过（不阻断，用原命题继续）
- 无效输入 — 继续（不阻断）

**⭐ 规则**：第 1 个方向（默认推荐）

**v1.4 增强**：
- 1 次 LLM 生成 N 句差异说明（~30 字/方向）
- 第一个方向加 ⭐ 标记
- 实现：`socratic_gateway.generate_direction_differences(thesis, directions)`

## 决策点 2 — CCOS 大纲审核

**位置**：`scripts/prism_os.py` `_format_ccos_review`

**触发**：`ccos_review=True`（默认）+ `interactive=True` + CCOS 完成

**UI 原文**：
```
━━━ CCOS 大纲审核 ━━━
  标题: ...
  模块流: HOOK → CASE → EXPLAIN → MODEL → COUNTER → ...
  B1 检查: HOOK ✓ MODEL ✓ COUNTER 缺 ...
  B2 检查: surface ✓ implication ✓ ...
━━━━━━━━━━━━━━━━━━━━
请选择:
  [c] 继续（使用此大纲）
  [r] 重新生成
  [q] 退出
> 
```

**选项**：
- `c` / 空回车 — 接受大纲，继续
- `r` — 重新生成（CCOS 重跑）
- `q` — 退出 run

**⭐ 规则**：c（继续）是默认

**stdin fallback**：⚠️ GAP-4 — stdin 不可用时静默默认继续

## 决策点 3 — Gap 素材缺口处理

**位置**：`phases/gap.py:_format_gap_prompt`

**触发**：`run` 主干 Phase 4.5 后 + `interactive=True`

**UI 原文（v1.4）**：
```
━━━ Gap 决策 ━━━
  score: 0.30（较小）
  readiness: 50%
  ⚠️ 就绪度 50% < 30%（或 threshold），建议补充素材
  缺失证据:
    1. 案例
    2. 数据
━━━━━━━━━━━━━━━━━━━━
请选择: [1] 补充素材 [2] 调整大纲 [3] 直接生成 [q] 退出（⭐ = [2]）
```

**选项**：
- `[1]` 补充素材
- `[2]` 调整大纲（重新生成 CCOS）
- `[3]` 直接生成（继续，不补素材）
- `[q]` 退出

**⭐ 规则（v1.4）**：
- `readiness >= 70%` → ⭐ = `[3]`（就绪度高，材料够用）
- `readiness < 70%` → ⭐ = `[2]`（先调整大纲再补素材更高效）

## 决策点退出路径（v1.0 补完）

每个决策点必须支持 `q` 退出。**状态回滚规则**：

| 决策点 | `q` 行为 | 数据写入 |
|--------|----------|----------|
| 0.5（追问）| 跳过澄清 | state.gateway 含 user_clarification |
| 1（选标题）| 退出 run | state 不写入 |
| 1.5（方向）| skip = 跳过（不退出 run）| state.direction_selected = "" |
| 1.5（深度模式内）| 退出 run | state 不写入 |
| 2（CCOS 审核）| 退出 run | state 不写入 |
| 3（Gap 决策）| 退出 run | state 不写入 |

## 命令循环（决策点 1 deep 模式子命令）

- `1-5` — 选择深度标题
- `m` / `more` — 重新生成 5 标题
- `w N` — 查看 N 号 why 完整分析
- `b` / `back` — 回退到广度候选
- `q` / `quit` / `exit` — 退出 run

## 命令循环（决策点 1 Prism 广度）

- `1-12` — 选择
- `d` — 进入深度模式
- `r` — 补生成缺失维度
- `q` — 退出
