# PRISM-OS 架构先行路线 — 完整设计方案

> 版本：1.0
> 日期：2026-05-08
> 作者：mark + Claude
> 状态：已确认，待开发

---

## 1. 背景与目标

### 1.1 现状

- PRISM-OS 是一个 8-Phase 的选题生成引擎，Phase 1-8 的设计已经完整
- 存在 4 个扩展方向（A/B/C/D）和 3 个能力缺口（Gap1/2/3）需要解决
- 系统目前是"被动响应"模式，无记忆、无学习、无主动发现能力

### 1.2 愿景

让 PRISM-OS 成为**有记忆、能学习、能主动发现选题的策划搭档**。

### 1.3 路径选择

**架构先行路线**——先构建元层能力（记忆机制 + 学习框架），再在此之上构建所有扩展功能。

---

## 2. 产品定位

| 维度 | 现状 | 目标 |
|------|------|------|
| 记忆 | 无，每次 session 从零 | 项目级上下文持久化，跨 session 恢复 |
| 学习 | 无，LLM 调用是盲发 | 偏好学习 + 校准反馈闭环 |
| 主动发现 | 无，刺客机制和裂缝捕捉不可用 | 信息源监控 + 主动推送 |
| 执行稳定性 | Gap3 导致输出不一致 | 运行时诊断 + 推理链回溯 |
| 验证 | 手动 | 自动验证 + Gap1 闭环 |

---

## 3. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    PRISM-OSv2 架构                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────────────────────────┐│
│  │ 信息源监控    │───▶│  Cognitive Crack Hunter (Phase 8)││
│  │ (国内外 RSS) │    │  发现裂缝 → 主动推送              ││
│  │             │    └─────────────────────────────────┘│
│  └─────────────┘                      │                 │
│                                        ▼                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │              自我增强层 (D)                          ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ ││
│  │  │ 记忆索引     │  │ 偏好学习    │  │ 推理链记录   │ ││
│  │  │ (本地文件)   │  │ (Gap2)      │  │ (Gap3)      │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘ ││
│  └─────────────────────────────────────────────────────┘│
│                          │                               │
│           ┌──────────────┼──────────────┐               │
│           ▼              ▼              ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │ 数字分身    │  │ Gateway    │  │ Socratic   │      │
│  │ (B+Gap2)   │  │ 可靠性      │  │ 诊断       │      │
│  │            │  │ (C+Gap1)   │  │            │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                          │                               │
│  ┌─────────────────────────────────────────────────────┐│
│  │              刺客机制 (A)                            ││
│  │  历史爆款逻辑反转 + 知识拓扑图谱 + Prompt变异        ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │              PRISM-OS 核心 (Phase 1-6)              ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 4. 四个扩展方向

### 方向 A：刺客机制 + 认知裂缝捕捉

**现状**：刺客机制需要 20 篇真实发布数据才触发，目前基本是不可用状态。认知裂缝捕捉需要主动监听信息源。

**目标**：信息源监控 + 主动发现选题机会，让系统从工具变成策划搭档。

### 方向 B：数字分身

**现状**：Skill 里有完整设计但未实现。

**目标**：学习创作者的思维模式，进行初步选题筛选，30 次交互后真正懂你。

### 方向 C：Gateway 可靠性

**现状**：10 个 scene 的映射已经设计好，但 gateway 本身的 fallback 逻辑、重试、超时、监控都还基础。

**目标**：提升整个系统的稳定性，特别是当上游 API 不稳定时。

### 方向 D：自我增强

**现状**：我无代码级持久记忆，每次 session 都要重新读文件。

**目标**：项目级上下文记忆 + 偏好学习 + 推理链记录，让每次对话都能从上次继续。

---

## 5. 三个能力缺口

| Gap | 描述 | 对应方向 |
|-----|------|---------|
| Gap1 | 无自动验证循环 | C（Gateway 可靠性） |
| Gap2 | 无偏好快速适应机制 | B（数字分身） |
| Gap3 | Socratic Gateway 执行参差不齐 | D（自我增强） |

---

## 6. 记忆层设计（对应 D）

### 6.1 数据存储

**位置**：每个项目独立的本地文件，存放在项目根目录的 `.claude/memory/` 下。

**文件结构**：

```
PRISM-OSv1/
├── .claude/
│   ├── memory/
│   │   ├── index.md              # 记忆索引（总入口）
│   │   ├── project_context.md    # 项目上下文
│   │   ├── decisions.md          # 关键决策记录
│   │   ├── preferences.md        # 用户偏好
│   │   └── reasoning_chains.md  # 推理链记录
│   └── logs/
│       ├── topic_log.yaml        # 选题历史
│       ├── calibration_log.json # 校准记录
│       └── llm_call_log.json     # LLM 调用日志
```

### 6.2 记忆文件模板

#### `.claude/memory/index.md`

```markdown
# 记忆索引

## 项目
- PRISM-OSv1: D:\myproject\PRISM-OSv1

## 当前上下文
上次:
当前:
卡点:

## 最近决策
- YYYY-MM-DD:
```

#### `.claude/memory/project_context.md`

```markdown
# 项目上下文

## 最后进度
完成阶段:
输出结果:

## 当前待处理
-

## 已知卡点
-

## 下次从哪里继续
```

#### `.claude/memory/decisions.md`

```markdown
# 关键决策记录

## 架构决策

### YYYY-MM-DD: [决策标题]
- **背景**:
- **决策**:
- **原因**:
- **替代方案考虑**:

## 根因分析（Bug/问题）
```

#### `.claude/memory/preferences.md`

```markdown
# 用户偏好

## 数字分身
digital_twin:
  total_interactions: 0
  last_calibration: null
  next_calibration_at: 30

## 维度权重
dimension_weights:
  reversal: 1.0
  micro_scene: 1.0
  systemic_flaw: 1.0
  bridge: 1.0

## 禁用词
banned_words:
  - "赋能"
  - "降维打击"
  - "破圈"
  - "必须知道"
  - "震惊"

## 校准历史
calibration_history: []
```

#### `.claude/memory/reasoning_chains.md`

```markdown
# 推理链记录

## Socratic Gateway 决策链
```

### 6.3 记忆写入规则

| 事件 | 写入哪个文件 |
|------|-------------|
| 用户明确说"这个方法的原因是 X" | `decisions.md` |
| 用户纠正了我的某个判断 | `decisions.md` + `preferences.md` |
| 完成 Phase X，输出了 Y | `project_context.md` |
| 用户连续多次选择 reversal | `preferences.md` |
| Socratic 输出了一个决策 | `reasoning_chains.md` |
| 数字分身做了筛选 | `preferences.md`（校准后） |

### 6.4 记忆读取规则

- 每次对话开始时，自动加载 `index.md` 到上下文
- 特定事件触发时，加载对应记忆文件

---

## 7. 数字分身 + 偏好适应设计（对应 B + Gap2）

### 7.1 数据结构

```yaml
# .claude/memory/preferences.md
digital_twin:
  total_interactions: 0
  last_calibration: null
  next_calibration_at: 30

dimension_weights:
  reversal: 1.0
  micro_scene: 1.0
  systemic_flaw: 0.8
  bridge: 1.0

selection_patterns:
  - trigger: "用户连续 3 次选择 reversal"
    action: "reversal += 0.2"
  - trigger: "用户拒绝了所有 micro_scene 候选"
    action: "micro_scene *= 0.5"

calibration_history: []
```

### 7.2 反馈学习循环

```
用户选择标题
    │
    ▼
数字分身记录：timestamp, candidate_index, dimension, was_selected
    │
    ├── 累计到达 30 次 ──▶ 触发强制校准
    │                        用户 review："这个筛选准吗？"
    │                        用户确认 / 调整权重
    │                        重置计数器
    │
    └── 每次选择后检查 pattern
            │
            ▼
        更新 dimension_weights
        （如果 reversal 被连续选择 3 次，reversal 权重 += 0.2）
```

### 7.3 校准触发（30 次固定）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【数字分身校准】

系统已完成 30 次筛选。以下是系统对你意图的理解：

维度偏好：
  reversal: 1.3（高于默认）
  micro_scene: 1.0
  systemic_flaw: 0.8
  bridge: 1.0

请确认：这个理解准确吗？

1. 准确，可以继续
2. 有些偏差，我想调整：___
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 7.4 权重累积规则

- 每连续选择某维度 N 次（N >= 3），该维度权重 += 0.2
- 权重上限：1.5
- 下限：0.5

---

## 8. Gateway 可靠性 + 自动验证设计（对应 C + Gap1）

### 8.1 自动验证机制

每次 LLM 调用后自动执行：
1. 检查 HTTP 响应状态码
2. 验证响应格式（是否包含 `choices[0].message.content`）
3. 检查 `finish_reason` 是否为 stop
4. 超时检测（默认 30s）
5. 记录到 `.claude/logs/llm_call_log.json`

验证失败时：
- 重试 1 次（指数退避：1s, 2s）
- 仍失败 → 返回结构化错误，不挂起主流程
- 错误写入诊断日志

### 8.2 验证日志格式

```json
{
  "timestamp": "2026-05-08T10:30:00Z",
  "scene": "reasoning",
  "duration_ms": 1234,
  "status": "success",
  "tokens": { "prompt": 120, "completion": 456, "total": 576 },
  "error": null
}
```

### 8.3 健康检查

- `GET /health` 每 60s 自检一次
- 连续 3 次失败 → 输出诊断报告
- 用户可以输入 `/prism-check` 手动触发健康检查

---

## 9. Socratic 诊断设计（对应 Gap3）

### 9.1 推理链记录格式

```yaml
# .claude/memory/reasoning_chains.md
- timestamp: 2026-05-08T10:00:00Z
  phase: "Socratic Gateway"
  input_type: "sentence"
  entropy_score: 0.72

  reasoning_chain:
    - step: "classify_input"
      result: "sentence"
      confidence: 0.95
    - step: "calculate_entropy"
      object_clarity: 0.6
      conflict_tension: 0.8
      fact_support: 0.7
      entropy_score: 0.72
    - step: "decision"
      decision: "pass"
      reason: "Entropy >= 2.5，命题有足够张力"

  user_feedback: null
```

### 9.2 运行时诊断交互

用户可以随时输入 `/prism-diagnostic` 查看最近一次 Socratic 推理链。

---

## 10. 认知裂缝捕捉 + 主动推送设计（对应 A）

### 10.1 信息源监控配置

```yaml
# .claude/config/info_sources.yaml
monitored_sources:
  # 国内
  - name: "知乎热榜"
    url: "https://rsshub.app/zhihu/hot"
    check_interval: "1h"
    priority: "high"
    region: "cn"

  - name: "微博热搜"
    url: "https://rsshub.app/weibo/hot/search"
    check_interval: "30min"
    priority: "high"
    region: "cn"

  - name: "36氪"
    url: "https://rsshub.app/36kr/feed"
    check_interval: "2h"
    priority: "medium"
    region: "cn"

  - name: "虎嗅"
    url: "https://rsshub.app/huxiu/rss"
    check_interval: "2h"
    priority: "medium"
    region: "cn"

  - name: "钛媒体"
    url: "https://rsshub.app/tmtpost/rss"
    check_interval: "2h"
    priority: "medium"
    region: "cn"

  - name: "少数派"
    url: "https://rsshub.app/sspai/rss"
    check_interval: "2h"
    priority: "low"
    region: "cn"

  - name: "IT之家"
    url: "https://rsshub.app/ithome/rss"
    check_interval: "1h"
    priority: "low"
    region: "cn"

  - name: "澎湃新闻"
    url: "https://rsshub.app/thepaper/rss"
    check_interval: "1h"
    priority: "medium"
    region: "cn"

  # 国际
  - name: "Hacker News"
    url: "https://rsshub.app/hacker-news/best"
    check_interval: "1h"
    priority: "high"
    region: "intl"

  - name: "TechCrunch"
    url: "https://rsshub.app/techcrunch/rss"
    check_interval: "2h"
    priority: "high"
    region: "intl"

  - name: "The Verge"
    url: "https://rsshub.app/theverge/rss"
    check_interval: "2h"
    priority: "medium"
    region: "intl"

  - name: "MIT Tech Review"
    url: "https://rsshub.app/technologyreview/rss"
    check_interval: "2h"
    priority: "medium"
    region: "intl"

  - name: "VentureBeat AI"
    url: "https://rsshub.app/venturebeat/ai"
    check_interval: "2h"
    priority: "medium"
    region: "intl"

  - name: "Wired"
    url: "https://rsshub.app/wired/rss"
    check_interval: "2h"
    priority: "low"
    region: "intl"

  - name: "Ars Technica"
    url: "https://rsshub.app/ars/rss"
    check_interval: "2h"
    priority: "low"
    region: "intl"

  - name: "Forbes"
    url: "https://rsshub.app/forbes/latest"
    check_interval: "2h"
    priority: "low"
    region: "intl"

  - name: "Reddit r/technology"
    url: "https://rsshub.app/reddit/r/technology"
    check_interval: "1h"
    priority: "medium"
    region: "intl"
```

### 10.2 RSS 监控架构

```
                    ┌─────────────────────────────┐
                    │   RSS Monitor (APScheduler) │
                    │   每 30min / 1h / 2h 扫描   │
                    └─────────────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
    ┌────────────┐           ┌────────────┐           ┌────────────┐
    │ 国内源列表  │           │ 国际源列表  │           │ 用户自定义  │
    │ (优先级高)  │           │ (优先级中)  │           │  (额外配置) │
    └────────────┘           └────────────┘           └────────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │  内容解析 + 去重     │
                         │  (标题/摘要提取)     │
                         └─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Crack Hunter       │
                         │  (调用 Phase 8 LLM)  │
                         └─────────────────────┘
                                    │
                           ┌───────┴───────┐
                           ▼               ▼
                    发现裂缝            无裂缝
                    (推送用户)          (沉默)
```

### 10.3 裂缝检测关键机制

- **去重**：用 `published_date + title` 做 bloom filter，避免重复推送
- **频率控制**：每个 source 独立计时，不同学源的检查间隔可不同
- **置信度阈值**：只有 `confidence > 0.75` 才推送
- **Cooldown**：推送后 30 天内同一 source 不再推送相同裂缝类型

### 10.4 主动推送格式

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【PRISM-OS 主动发现】

💡 检测到认知裂缝

共识：XXX
现实：XXX

裂缝类型：数据裂缝 | 置信度：88%

建议选题方向：
1. ...
2. ...

是否基于这个裂缝生成标题？（yes/no）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 10.5 刺客机制触发条件

- 历史发布数据 ≥ 20 篇
- 距上次刺客提醒 > 30 天
- 检测到历史爆款命题可以被逻辑反转

---

## 11. 历史爆款存储（飞书多维表格）

### 11.1 飞书多维表格信息

- **名称**：PRISM-OS 爆款选题库
- **Token**：`QVz9byNH0auzRis9KeDcUoe3nZf`
- **链接**：https://my.feishu.cn/base/QVz9byNH0auzRis9KeDcUoe3nZf
- **表格 ID**：`tblOoR71Q3DSa33t`

### 11.2 字段结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 标题 | 文本 | 历史发布的标题 |
| 发布日期 | 日期 | YYYY-MM-DD |
| 阅读量 | 数字 |  |
| 互动量 | 数字 | 点赞+在看+收藏 |
| 内容方向 | 单选 | reversal / micro_scene / systemic_flaw / bridge |
| 核心论点 | 文本 | 一句话概括 |
| 命题逻辑 | 文本 | 这个标题背后的推理逻辑 |
| 是否已反转 | 单选 | 是 / 否 / 待处理 |
| 反转策略 | 单选 | 前提质疑 / 数据更新 / 视角切换 / 时效性挑战 |
| 备注 | 文本 |  |

### 11.3 维护规则

- PRISM-OS 在 Phase 6（Persistence）时，写入每次生成的候选和用户选择的标题
- 用户手动补充历史爆款的数据（阅读量、互动量等）
- 当刺客机制触发时，PRISM-OS 从这张表读取"命题逻辑"字段进行反转

---

## 12. 测试用例

### 12.1 单元测试用例

#### 记忆层测试

| 用例 | 输入 | 预期输出 |
|------|------|---------|
| 记忆写入-决策 | 用户说"这个设计的原因是 X" | `decisions.md` 写入新条目，带 timestamp |
| 记忆写入-偏好 | 用户拒绝了 3 个 micro_scene 标题 | `preferences.md` 中 micro_scene 权重 *= 0.5 |
| 记忆恢复 | 新 session 开始，加载 index | `project_context.md` 内容加载到上下文 |
| 记忆索引更新 | 完成新任务 | `index.md` 中 `当前上下文` 自动更新 |

#### 数字分身测试

| 用例 | 输入 | 预期输出 |
|------|------|---------|
| 权重累积 | 用户连续选择 3 次 reversal | reversal 权重 = 1.0 + 0.2*3 = 1.6，上限 1.5，实际 1.5 |
| 强制校准触发 | 第 30 次选择完成 | 弹出校准界面，计数器重置 |
| 校准精度 | 用户确认准确 | `calibration_log.json` 记录 accuracy |
| 初筛 | 用户请求生成标题 | 数字分身先过滤一轮，输出带 `digital_twin_confidence` |

#### Gateway 验证测试

| 用例 | 输入 | 预期输出 |
|------|------|---------|
| 成功调用 | 正常 LLM 调用 | 响应写入 `llm_call_log.json`，status=success |
| 重试 | 第一次超时 | 1s 后重试，仍失败返回错误，不挂起主流程 |
| 超时记录 | 调用超过 30s | status=timeout，写入 error 字段，生成诊断报告 |
| 健康检查 | `curl localhost:3000/health` | `{"status":"ok","version":"0.1.0"}` |

#### Socratic 诊断测试

| 用例 | 输入 | 预期输出 |
|------|------|---------|
| 推理链记录 | Socratic 执行一次决策 | `reasoning_chains.md` 写入完整推理链 |
| 诊断查看 | 用户输入 `/prism-diagnostic` | 输出最近一次推理链，支持用户反馈 |
| 诊断反馈 | 用户说"这个熵值计算不对" | 记录 `user_feedback`，供后续分析 |

#### 认知裂缝捕捉测试

| 用例 | 输入 | 预期输出 |
|------|------|---------|
| 裂缝发现 | RSS 返回一条新内容 | 调用 Crack Hunter，输出裂缝分析或沉默 |
| 主动推送 | 检测到裂缝（confidence > 0.75） | 推送消息给用户，等待 yes/no |
| 推送频率控制 | 上次推送距今 < 30 天 | 抑制重复推送，标记 cooldown |

### 12.2 集成测试用例

| 用例 | 步骤 | 预期结果 |
|------|------|---------|
| 完整偏好学习循环 | 1. 生成 12 个候选<br>2. 用户选第 3 个（reversal）<br>3. 重复 3 次<br>4. 查看权重变化 | reversal 权重从 1.0 变为 1.5（累积到上限） |
| Gateway 故障降级 | 1. 启动 gateway<br>2. 用错误 key 触发 OpenRouter 失败<br>3. 验证 fallback 切到 Gemini | 响应走 fallback，最终返回结构化结果 |
| 校准后数字分身筛选 | 1. 完成 30 次交互<br>2. 用户校准：reversal -= 0.2<br>3. 下次生成后数字分身初筛 | 筛选结果与校准后的权重一致 |
| 认知裂缝全流程 | 1. RSS 抓取新内容<br>2. Crack Hunter 分析<br>3. 发现裂缝，推送<br>4. 用户 yes<br>5. 进入 PRISM-OS 生成 | 选题基于裂缝内容生成 |

---

## 13. 分阶段实施计划

```
阶段 0：基础设施（记忆层 + 诊断）
阶段 1：偏好学习 + Gateway 验证
阶段 2：数字分身 + 校准
阶段 3：信息源监控 + 主动推送
阶段 4：刺客机制 + 知识拓扑
```

### 阶段 0：基础设施（约 1 周）

**目标**：建立记忆层和推理链记录基础设施

**交付物**：
- `.claude/memory/` 目录结构和文件模板
- 记忆索引读写工具
- 推理链记录工具
- `/prism-diagnostic` 命令

**文件清单**：
```
.claude/
├── memory/
│   ├── index.md
│   ├── project_context.md
│   ├── decisions.md
│   ├── preferences.md
│   └── reasoning_chains.md
├── utils/
│   ├── memory_writer.py
│   ├── memory_reader.py
│   └── reasoning_chain.py
└── logs/
    └── llm_call_log.json
```

### 阶段 1：偏好学习 + Gateway 验证（约 1 周）

**目标**：Gap1 和 Gap2 的核心机制落地

**交付物**：
- 偏好权重累积逻辑
- LLM 调用自动验证 + 重试 + 日志
- 健康检查脚本
- `/prism-check` 命令

**文件清单**：
```
scripts/
├── memory_writer.py
├── memory_reader.py
├── call_llm.py              # 修改：加验证、重试、日志
└── health_check.py
```

### 阶段 2：数字分身 + 校准（约 1 周）

**目标**：B + Gap2 完成

**交付物**：
- 数字分身初筛模块
- 30 次强制校准界面
- 校准精度记录

### 阶段 3：信息源监控 + 主动推送（约 1 周）

**目标**：A 的信息源部分完成

**交付物**：
- RSS 监控脚本（定时任务）
- 认知裂缝分析 pipeline
- 主动推送触发机制

**文件清单**：
```
scripts/
├── rss_monitor.py
├── feed_parser.py
└── crack_hunter_wrapper.py
.claude/
└── config/
    └── info_sources.yaml
```

### 阶段 4：刺客机制 + 知识拓扑（约 1 周）

**目标**：A 完成

**交付物**：
- 刺客机制（历史爆款逻辑反转）
- 知识拓扑图谱
- Prompt 变异引擎

---

## 14. 技术依赖

| 依赖 | 用途 |
|------|------|
| Python 3.8+ | 记忆工具、偏好学习、RSS 监控 |
| Node.js 16+ | Gateway HTTP 服务 |
| PyYAML | YAML 文件读写 |
| feedparser | RSS 解析 |
| requests | HTTP 调用 |
| APScheduler | 定时任务（RSS 监控） |
| 飞书多维表格 API | 爆款选题库读写 |

---

## 15. 风险与限制

| 风险 | 说明 | 应对 |
|------|------|------|
| 记忆文件过大 | 长期运行后 index.md 膨胀 | 定期归档旧记录到 `archive/` 目录 |
| 偏好学习偏差 | 用户偏好突然变化，权重累积过度 | 设权重上限（1.5）和校准机制 |
| RSS 源失效 | 监控的 RSS 链接过期 | 日志记录抓取失败，继续尝试 |
| 校准打扰 | 30 次强制校准可能打断用户节奏 | 校准可延迟，下次触发时提醒 |
| 认知裂缝误报 | 主动推送的消息不准确 | 设高阈值（confidence > 0.75），并标注置信度 |
| RSSHub 公共实例不稳定 | 公共 RSSHub 可能限流或不可用 | 建议自建 RSSHub 或使用付费 RSS 服务 |

---

## 16. 不在本方案范围

- 多用户 / 多账号支持
- 云端记忆同步
- 移动端推送
- 语音输入/输出
- 校准次数可配置化

---

## 17. 已确认决策清单

| 编号 | 决策项 | 选择 |
|------|--------|------|
| 1 | 记忆层存储位置 | 本地文件（`.claude/memory/`） |
| 2 | 数字分身校准方式 | 强制校准（每 30 次） |
| 3 | Socratic 诊断方式 | 运行时诊断（用户主动查看） |
| 4 | 认知裂缝信息源 | 监控固定信息源（RSS） |
| 5 | 历史爆款存储 | 飞书多维表格 |
| 6 | RSS 监控实现 | APScheduler 定时任务 |
| 7 | 实施路径 | 架构先行路线（阶段 0→4） |
