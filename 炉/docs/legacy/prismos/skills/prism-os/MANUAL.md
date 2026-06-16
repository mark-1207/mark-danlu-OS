# PRISM-OS 使用手册

> 面向真人操作员的实操手册（命令示例、UI 文本、FAQ）
>
> 流程规范以 [SKILL.md](./SKILL.md) 为准；AI 红线以 [CLAUDE.md](./CLAUDE.md) 为准

**版本**: 1.4.0

---

## 1. 这是什么 / 不适合什么

### 这是什么

PRISM-OS 是一个**选题 → 标题 → 大纲 → 缺口 → 草稿**的完整引擎。你给它一个模糊意图，它会：

1. 评估意图质量（熵值 + HKR）
2. 生成多角度候选标题
3. 校验现实竞争度
4. 生成 CCOS 双端大纲
5. 检查素材缺口
6. （可选）生成文章草稿

### 不适合什么

- 闲聊、问技术问题、做其他项目
- 单纯翻译、润色既有文章
- 不带创作意图的事实查询

---

## 2. 快速开始（5 步）

```bash
# 1. 装依赖
pip install requests pyyaml numpy

# 2. 配 API Key（最少配一个，4 级 Fallback 顺序：Kimi → NVIDIA → Gateway → OpenRouter）
export KIMI_API_KEY=sk-xxx
# 或
export NVIDIA_API_KEY=nvapi-xxx

# 3. 进入 skill 目录
cd skills/prism-os

# 4. 跑完整流程
python scripts/prism_os.py run "你的命题"

# 5. 按提示在 3 个决策点选标题 / 审大纲 / 处理缺口
```

---

## 3. 8 触发源命令速查

| 触发源 | 命令 | 适用场景 | 注意事项 |
|--------|------|----------|----------|
| 🔌 手动 `run` | `python scripts/prism_os.py run "<命题>"` | 日常完整流程 | **唯一推荐入口** |
| 🔌 队列消费 | `python scripts/prism_os.py run --from-queue` | 从 crack_queue 选裂缝喂给 run | 先 `python scripts/prism_os.py queue --list` 看队列 |
| 🔌 队列匹配 | `python scripts/prism_os.py run "<命题>" --match-queue` | 跑 run 时同步展示相关裂缝 | 仅展示，不进入主流程 |
| 🔌 自然语言短触发 | `python scripts/prism_os.py "<一段话>"` | 不想打 `run` 子命令时 | 第一个参数不是命令名时自动走 run |
| 🔌 HTTP listen | `python scripts/prism_os.py listen` | 接入 Claude Code / 第三方 | 默认端口 7654，interactive=False |
| 🔌 Windows 计划任务 | `powershell setup_scheduler.ps1` | Phase 6.0 数据闭环每日同步 | 仅跑 metrics sync+score，**不触发 run** |
| 🔌 刺客机制 | `python scripts/prism_os.py run "..."`（内部触发）/ `python scripts/assassin.py cron_check` | 累计 20+ 篇发布数据后 | 距上次刺客提醒需 > 30 天 |
| 🔌 主动推送 | 文档超前，**当前未实现** | — | 计划 v1.4.0+ |

### 3.1 常用 `--flag`

| Flag | 作用 |
|------|------|
| `--format` / `-f` | 格式化输出（可读报告） |
| `--no-ext` | 跳过 Phase 4-8（仅 Phase 0-3） |
| `--no-interactive` | 跳过决策点（默认选第一个 / 默认继续）— 调试用 |
| `--skip-gateway` | 跳过 Phase 1 苏格拉底网关（调试用） |
| `--clarification "<text>"` | 一次跑通网关追问（避免 need_clarification 阻塞） |
| `--no-ccos-review` | 跳过 CCOS 大纲人工审核（默认开启） |
| `--from-queue` | 从 crack_queue 选裂缝进入主流程 |
| `--match-queue` | 跑 run 时匹配并展示相关裂缝 |
| `--series` | 跑完后追加 M3b 系列模式（规划 3 篇后续标题） |
| `--series-action <yes\|no\|save-all>` | 系列模式动作：`save-all` 跳过交互直接全存 |

---

## 4. 5 决策点 UI 文本（v1.4）

完整流程在 5 个位置会暂停等你输入。完整规范（含行为、退出路径、⭐ 推荐规则）见 [references/decision-points.md](./references/decision-points.md)。

### 🚦 决策点 0.5（Phase 1 → 1.5）：苏格拉底追问（仅 clarify 路径）

```
━━━ 苏格拉底追问 ━━━
  1. <问题 1>
  2. <问题 2>
  ...
可选方向（参考）：
  1. <方向 1>
  2. <方向 2>
━━━━━━━━━━━━━━━━━━━━
请直接回答上述问题（也可以 skip 跳过）:
> 
```

- 输入回答 → 状态变 "answered"，重新评估网关
- `skip` / 空回车 → 跳过澄清，进入 Phase 1.5

### 🚦 决策点 1.5（Phase 1 → 1.7）：方向选择（v1.4 新增）

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

- 输入 `1`-`N` → 选该方向，注入 prism thesis（`原命题（切入角度：方向 N）`）
- `skip` / `q` / 空回车 → 跳过（不阻断），用原命题继续
- 第一个方向标 ⭐（默认推荐）

### 🚦 决策点 1（Phase 3.5 → 4.5）：候选标题选择

```
━━━ 候选标题列表 ━━━
[维度覆盖] ✓ reversal(2) ✗ contrarian(0)
缺失: contrarian

  1. ✓ 35 岁程序员，焦虑的不是 AI ⭐ 推荐
     HKR=0.50 | 张力=4 | reversal | opinion_assertion
     字数: 22 | 最高相似度: 0.00
     理由: 挑战"35岁必焦虑"的常识假设（完整理由，无截断）
  ...
━━━━━━━━━━━━━━━━━━━━
请选择:
  1-12  选择该编号标题（直接进入 CCOS）
  d      进入深度模式（对命题做 9 维拆解 + 生成 5 个深度标题）
  r      补生成缺失维度的标题
  q      退出
```

- `1`-`N` → 选该编号
- `d` → 进入深度模式（每个标题加 archetype 中文标签 + 描述）
- `r` → 补生成缺失维度
- `q` → 退出
- 第一个标 ⭐（sort_score 最高）

### 🚦 决策点 2（Phase 4.5 → 4.6）：CCOS 大纲审核

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

- `c` 或回车 → 继续
- `r` → 用同样标题重生成 CCOS
- `q` → 退出

### 🚦 决策点 3（Phase 4.6）：Gap 素材缺口处理

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

- `1` / `2` / `3` → 选对应操作
- `q` → 退出
- ⭐ 推荐：readiness ≥ 70% → [3]，< 70% → [2]

---

## 4.5 系列模式（v1.4 新增）

`--series` 在 `run` 跑完后追加"规划 3 篇后续标题"。锚点 = 刚选中的 T1。

### 完整流程

```bash
# 1. 跑锚点 T1
python scripts/prism_os.py run "AI 时代 35 岁程序员焦虑" --series

# 主流程跑完后，会进入系列模式：
#   适配性分析（5 维 LLM + 硬规则）
#   → 不适合：打印原因，结束
#   → 适合：生成 3 个后续标题（带 positioning: deepen/expand/contrarian）
#   → 用户选 1-3 / s（全存）/ m（重生成）/ q（跳过）

# 2. 跑后续 T2 / T3
python scripts/prism_os.py run "T2 命题"
python scripts/prism_os.py mark_written --series-id <sid> --slot 2  # 标 T2 已写

python scripts/prism_os.py run "T3 命题"
python scripts/prism_os.py mark_written --series-id <sid> --slot 3  # 标 T3 已写
# 全部 slot 都 written → series.status = "complete"
```

### 非交互模式

```bash
python scripts/prism_os.py run "命题" --series --series-action save-all
# 跳过交互，直接生成 + 全存到 topic_log
```

### 硬规则（覆盖 LLM）

- `time_sensitivity >= 4`（时效新闻）→ 强制 unsuitable
- `depth_potential <= 2`（命题太浅）→ 强制 unsuitable

### 冲突豁免

`conflict_detect` 同 `series_id` 的历史项不计入命题撞车（同一系列内不冲突）。

---

## 5. 5 已知缺口的"用户视角"解读

PRISM-OS `run` 命令当前有 5 个已知小毛病，已记录在 [SKILL.md](./SKILL.md) § 已知代码缺口 和 [CLAUDE.md](./CLAUDE.md)。简要解读：

### GAP-1：`run` 不解析 `--platform`

**你会看到**：跑 `run "..." --platform wechat`，平台参数被吞，CCOS 仍然生成双端大纲。

**怎么办**：先跑 `run` 拿到候选标题，再单独跑 `python scripts/prism_os.py ccos "<标题>" --platform wechat`。

### GAP-2：`run` 跑完不接力 `narrate`

**你会看到**：跑完 `run`，日志停在"刺客机制"，但**没出文章**。

**怎么办**：手动再跑 `python scripts/prism_os.py narrate "<标题>" --platform wechat --quality-check`。

### GAP-3：决策点 1 stdin 不可用静默选 1

**你会看到**：在后台跑 `run`、或 stdin 被重定向时，提示出现但没法输入，**日志里会直接写"使用默认第一个候选"**。

**怎么办**：前台交互跑 `run`，显式输入编号。

### GAP-4：决策点 2 stdin 不可用静默继续

**你会看到**：同 GAP-3，但发生在 CCOS 审核环节。

**怎么办**：同上。

### GAP-5：决策点 3 不在 `run` 主干

**你会看到**：跑 `run` 完没看到 Gap 决策的提示。

**怎么办**：手动跑 `python scripts/prism_os.py gap "<thesis>"`。

---

## 6. API 密钥 4 级 Fallback

PRISM-OS 按以下顺序尝试 LLM provider，第一个可用就停：

| 优先级 | Provider | 适用模型 | 环境变量 |
|--------|----------|----------|----------|
| 1 | Kimi（月之暗面） | moonshot-v1-128k | `KIMI_API_KEY` |
| 2 | NVIDIA NIM | meta/llama-3.1-70b-instruct 等 | `NVIDIA_API_KEY` |
| 3 | Gateway | — | `GATEWAY_API_KEY` |
| 4 | OpenRouter | qwen/deepseek/gemma/mistral/llama 等多模型 | `OPENROUTER_API_KEY` |

**最少配一个**就能跑，推荐 Kimi 或 NVIDIA。

### 搜索 API

`Phase 3 现实校验锚` 调搜索 API 查重：

| Provider | 配置项 |
|----------|--------|
| 自建 SearXNG | `SEARCH_API_URL` + `SEARCH_API_KEY` |
| Tavily | `TAVILY_API_KEY` |

无搜索 API 时，Phase 3 优雅降级：保留所有原始候选，标记为"未校验"。

---

## 7. 6 类 FAQ

### Q1：跑 `run` 后什么都没出？

**A**：检查：
1. 熵值是否 < 0.3（被 blocked）——看 stderr 日志
2. 触发是不是 false ——看 stderr 日志
3. 候选标题是不是 0 个 ——看 stderr 日志

### Q2：标题质量不行怎么办？

**A**：当前棱镜引擎 prompt 已知风格偏 AI 化，详见 [SKILL.md](./SKILL.md) § 5 已知缺口。可手动改 `scripts/prism_engine.py` 的 prompt 模板，或等待 v1.3.2 重构。

### Q3：CCOS 大纲生成超时？

**A**：CCOS 默认生成双端（wechat + xiaohongshu）共 14 项输出，单次 LLM 调用量大。检查 `OPENROUTER_API_KEY` 是否配了支持长上下文的模型。

### Q4：Windows 计划任务跑不起来？

**A**：
1. 确认 `python` 在 PATH 里
2. 确认 `scripts/metrics_sync_wrapper.bat` 路径正确
3. 看 `logs/metrics_sync.log` 错误日志

### Q5：跑出来 HKR 分数都很低（< 0.5）怎么办？

**A**：HKR 是内容价值预评估，分数低说明：
- H（愉悦度）= 0：话题缺少趣味性
- K（知识增量）= 0：话题没新知
- R（共鸣）= 0：没具体场景/人称

调整输入文本，加入具体人名、场景、案例即可提升。

### Q6：想跑历史已经存过的命题怎么办？

**A**：在 `data/topic_log.yaml` 里能找到历史记录。直接复制 thesis 跑 `run "<thesis>"` 即可，刺客机制会自动跑（如果距上次刺客提醒 > 30 天且数据样本够）。

---

## 8. 文件结构

```
skills/prism-os/
├── README.md           # 本目录门面（你正在看）
├── MANUAL.md           # 本文档（实操手册）
├── SKILL.md            # 事实源（流程 + 触发表 + 决策点 + 缺口）
├── CLAUDE.md           # AI 必读红线
├── CHANGELOG.md        # 版本演进日志
├── config/             # 配置文件
│   ├── digital_twin.yaml
│   ├── feishu_config.yaml
│   └── user_config.yaml
├── data/               # 运行时数据
│   ├── topic_log.yaml
│   ├── metrics_snapshot.yaml
│   ├── feedback_calibration.yaml
│   └── embedding_cache.json
├── references/         # Phase 详解 / Prompts / 模板
├── scripts/            # 14 个 .py
└── tests/              # 单元测试
```

---

## 9. 快速验证

```bash
# 健康检查（应输出 14 个脚本 + version）
python scripts/prism_os.py --help 2>&1 | head -3

# 跑一次最小测试
python scripts/prism_os.py run "测试" --no-ext --no-interactive

# 跑测试套件
python -m pytest tests/ -v
```

---

## 8. v1.0 新增功能

### 8.1 人设持久化（M1）

PRISM-OS 会从 `skills/prism-os/data/personas.yaml` 加载你的"人设"，并在 4 个 phase 注入：
- 棱镜（Phase 2）：身份/受众写入 prompt
- 数字分身（Phase 3.5）：用 topic_domains 软过滤
- CCOS（Phase 4.5）：作者性字段优先
- Narrate（Phase 5+）：风格指纹注入

**编辑人设：** 修改 `data/personas.yaml` 的 `default` 段，commit，下次 run 即生效。

```bash
# 用默认人设跑
python prism_os.py run "AI 焦虑" --no-interactive

# 检查当前人设
python -c "from persona import load; p = load('default'); print(p['identity_role'])"
```

### 8.2 标题深度模式（M2）

选完标题后，如果 12 候选都不够锐，输入 `d` 进入深度模式：

```bash
python prism_os.py run "AI 时代 35 岁程序员为什么焦虑" --no-interactive
# 在决策点 1 输入: d

# 深度模式内命令:
#   1-5   选择该编号标题
#   m     重新生成 5 个
#   w N   查看 N 号的 why
#   b     回退到广度候选
#   q     退出
```

### 8.3 冲突检测（M3）

每次 `run` 在 Phase 1.5 自动检测 3 类冲突（全部 warn 放行，不阻断）：
- A 命题撞车（> 0.6）
- B 角度撞车（> 0.55）
- C 受众疲劳（30 天内 ≥ 5）

冲突报告在 stderr 显示，**不影响 run 流程**。

### 8.4 大纲质量检查（M7 + M8）

CCOS 决策点 2 审核时自动显示：
- **B1**：8 模块检查（HOOK 缺失会阻断）
- **B2**：4 层兑现（仅在走了深度模式后显示）

```
[B1 8 模块检查]
  ✓ HOOK 必备
  ✓ MODEL 必备（≥1 个）
  ⚠ COUNTER 推荐（缺失）
  ⚠ BOUNDARY 推荐（缺失）
  ✓ 节奏正常

[B2 4 层兑现检查]
  ⚠ 未兑现层: deeper_meaning, universal_value
  兑现度: 0.50/1.0
```

**所有 warning 不阻断**——输入 `c` 接受，`r` 重生成，`q` 退出。

---

**版本**: 1.4.0 | 最后更新：2026-06-10
