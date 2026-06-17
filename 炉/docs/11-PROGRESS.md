# 进度日志（Progress Log）

> 每阶段完成后更新一次。格式：日期 / 阶段名 / 做了什么 / 学到什么 / 接下来做什么。

---

## 阶段 1：项目初始化 + 方案对齐（2026-06-13 ~ 2026-06-16）

### 做了什么
- 初始化 炉 项目（CLAUDE.md / .gitignore）
- 深度理解 ContentForge（TypeScript）+ PRISM-OS（Python）
- 6 层面方案对齐（边界/目标/架构/模块/技术/文档）
- 19 个文档清单敲定
- 8 个核心日常更新文档确认
- v2 / 长期规划拆分
- 经验教训沉淀清单（F1-F11 + D1-D9 + P1-P14 + 规则 0）
- 写 `00-PROJECT-OVERVIEW.md`
- 写 `99-LESSONS-LEARNED.md`
- 写 `MEMORY.md` + `README.md`
- 写 `01-PRD.md`（产品需求文档）
- 写 `02-ARCHITECTURE.md`（架构设计）
- 写 `03-MODULE-DESIGN.md`（模块设计）
- 写 `04-DATA-MODEL.md`（数据模型）
- 写 `05-DEV-CONVENTIONS.md`（开发规范）
- 写 `06-DEV-PLAN.md`（开发计划）
- 写 `07-TEST-PLAN.md`（测试方案）
- 写 `08-DEPLOY.md`（部署方案）
- 写 `09-ROADMAP-V2.md`（v2 规划）
- 写 `10-LONG-TERM-PLAN.md`（长期规划）
- 写 `12-DECISION-LOG.md`（决策日志）
- 写 `13-MILESTONES.md`（里程碑）
- 写 `14-TASKS.md`（任务分解）
- 写 `15-ISSUES.md`（问题清单）
- 写 `16-RELEASE-CHECKLIST.md`（发布清单）
- 写 `17-TECH-DEBT.md`（技术债务）
- 写 `decisions/D-001` ~ `D-008` 8 个 ADR

### 学到什么
- "不要直接给方案"是最重要的 1 条（用户反复强调）
- 物理隔离原则：源项目+新项目独立迭代
- 配置化优先：避免硬编码
- 文档先于代码：方案对齐后再实施

### 接下来
- 复制源项目代码快照到 `legacy/`（contentforge + prismos）
- 文档完整 ✅ → 进入 v1.0 MVP 实施
- 按 `docs/06-DEV-PLAN.md` 推进 phases 0-7

### 状态
✅ 已完成

---

## 阶段 2：思想模型（2026-06-16）

### 做了什么
- 写 `config/thinking_models/models.yaml`（12 个模型卡片：杠杆者/第一性原理/逆向思维/系统思维/JTBD/奥卡姆剃刀/反共识/因果链/5Why/类比/反馈回路/二阶效应）
- 写 `config/thinking_models/frameworks.yaml`（4 框架：问题解构 chain / 决策分析 parallel / 系统思考 nested / 创新突破 divergent_then_convergent）
- 扩展 `config/loader.py` 的 `ThinkingModel` schema（新增 `prompt_hint` 和 `avoid` 字段）
- 实现 `thinking_models/registry.py`（YAML 加载 + 按 id 查询 + 迭代 + KeyError）
- 实现 `thinking_models/strategies.py`（5 策略 + `get_strategy` 工厂 + `ModelOutput`/`StrategyContext`/`StrategyResult` 数据类）
- 实现 `thinking_models/framework_selector.py`（关键词匹配，按 yaml 顺序 first match wins，无匹配回退 problem_decomposition）
- 写 3 个测试文件，共 42 测试：strategies (21) + registry (13) + selector (8)

### 学到什么
- LLM 注入用 `Callable[[str], str]` 模式，让策略逻辑可独立测试、不依赖真实 LLM
- prompt 构建模板在所有策略间复用（`_build_prompt`），保证提示风格一致
- divergent_then_convergent 用 `len(models)//2` 切分；当总长 1 时 mid=1 避免 degenerate
- condition 策略接受 `StrategyContext` 或单独 `route`，向后兼容 `proposition` 字符串

### 接下来
- 阶段 3：蓝图（blueprint/designer + anchors + sections + TUI）
- 阶段 4-7：草稿 / 打磨 / 沉淀 / 流程集成 + CLI

### 状态
✅ 已完成（117/117 测试通过）

---

## 阶段 3：蓝图（2026-06-16）

### 做了什么
- 实现 `blueprint/models.py`：SectionRole 枚举（核心 5 + 可选 8 = 13）+ Case/DataPoint/Quote + AntiAIAnchors + Section + Blueprint
- 实现 `blueprint/designer.py`：BlueprintDesigner.design（LLM 注入 + CCOS 9 项映射 + JSON 容错）
- 实现 `blueprint/sections.py`：SectionSelector（核心 5 段固定 + 5 种内容类型推荐可选 + select 不改入参）
- 实现 `blueprint/anchors.py`：AnchorPool.build（从 refined 提取 contrarian + insight）+ assign（按 role 分配 must_have）

### 学到什么
- LLM 注入沿用 Phase 2 的 Callable[[str], str] 模式
- `model_copy(update=...)` 是 Pydantic v2 的不变量更新方式
- 段位顺序是叙事流硬约束（钩子→反共识→案例→思考→收尾）
- Anti-AI 锚点的 must_have 是"prompt 素材"，不是"输出约束"

### 接下来
- 阶段 4：草稿生成（draft/section_prompt + generator）
- 阶段 5-7：打磨 / 沉淀 / 流程集成 + CLI

### 状态
✅ 已完成（164/164 测试通过）

---

## 阶段 4：草稿（2026-06-17）

### 做了什么
- 实现 `draft/models.py`：Draft 数据模型
- 实现 `draft/section_prompt.py`：SectionPromptBuilder（6 块注入）
- 实现 `draft/generator.py`：DraftGenerator（每段独立 LLM + 重试 2 次）
- 修复 `config/loader.py` ForbiddenTerm 校验器

### 学到什么
- Pydantic v2 `mode="before"` 验证器需要处理已构造对象分支
- 重试模式：解析失败 N 次后跳过
- 字数用字符数，避免分词器依赖

### 接下来
- 阶段 5：打磨
- 阶段 6-7：沉淀 + 流程集成 + CLI

### 状态
✅ 已完成（193/193 测试通过）

---

## 阶段 5：打磨（2026-06-17）

### 做了什么
- 实现 `polish/models.py`：DimensionScore + QualityReport + FixSuggestion
- 实现 `polish/dimensions.py`：9 个维度 dataclass（6 维 + L5 三项）
- 实现 `polish/quality_scorer.py`：QualityScorer 串行评分
- 实现 `polish/suggester.py`：FixSuggester 只为未通过维度生成建议

### 学到什么
- 维度用 dataclass + Callable 字段
- passed 用 @property 计算
- LLM 失败默认 5.0 + details 记 error
- 修复建议只给 failed 维度

### 接下来
- 阶段 6：沉淀
- 阶段 7：流程集成 + CLI

### 状态
✅ 已完成（242/242 测试通过）

---

## 阶段 6：沉淀（2026-06-17）

### 做了什么
- 实现 `sediment/models.py`：Insight + DiffResult + Harvested
- 实现 `sediment/harvester.py`：LLM 提取 + difflib 对比（短段落 < 10 字进 forbidden_candidates）
- 实现 `sediment/style_updater.py`：forbidden 去重合并

### 学到什么
- difflib.SequenceMatcher.get_opcodes() 输出 (tag, i1, i2, j1, j2)
- 短段落作为 forbidden 候选：经验值 10 字以内
- StyleProfile 用 model_copy(update=...) 保持不变性

### 接下来
- 阶段 7：流程集成（orchestrator + steps + CLI）

### 状态
✅ 已完成（268/268 测试通过）

---

## 阶段 7：流程集成（2026-06-17）

### 做了什么
- 实现 `pipeline/models.py`：Context Pydantic 模型（聚合 7 步产出 + 状态机字段）
- 实现 `pipeline/orchestrator.py`：Orchestrator 7 步串联（命题→追问→蓝图→段位→草稿→质检→沉淀）
- 实现 `cli/run.py`：极简 CLI（`python -m lu.cli.run "命题" --dry-run`）
- 写 2 个测试文件，共 6 测试：orchestrator (4) + CLI (2)

### 学到什么
- Step 3 蓝图设计含 4 个子步骤：framework 选择 → 策略执行 → 蓝图生成 → 锚点分配
- v1 CLI 仅支持 --dry-run（echo LLM），真实 LLM 推迟到 v1.1
- Orchestrator 用 dataclass 注入所有依赖，保持每阶段模块独立

### 接下来
- v1.1：真实 LLM 接入 / Obsidian 写入 / TUI

### 状态
✅ 已完成（274/274 测试通过）

---

## v1.1：LLM + 持久化 + Obsidian（2026-06-17）

### 做了什么
- 实现 `src/lu/llm/`：OpenAIProvider + LLMChain（重试 + fallback）
- Orchestrator 集成 FileStore：每步持久化 Context 到 `runs/<run_id>/context.json`
- 实现 `sediment/obsidian_writer.py`：cases/quotes/insights 写入 Obsidian vault
- CLI 增加 `--provider` / `--model` / `--runs-dir` / `--obsidian-vault` 参数
- 新增 5 个测试文件：llm_provider (5) + llm_chain (5) + orchestrator_persistence (2) + obsidian_writer (5) + cli_provider (5)

### 学到什么
- LLMChain.call 保持 `Callable[[str], str]` 签名，兼容现有模块注入
- FileStore 作为可选参数传入 Orchestrator，不传时 v1.0 行为不变
- Obsidian 写入作为 CLI 后处理，不侵入沉淀模块核心逻辑
- `--echo-llm` 现在默认走 echo LLM，可独立使用

### 状态
✅ 已完成（298/298 测试通过）

---

## v1.1 收尾：续跑 + 反馈 + 飞书 hook（2026-06-17）

### 做了什么
- Orchestrator 支持 `--resume` / `--from-step`（每步跳过已完成的）
- 实现 `src/lu/feedback/`：Feedback 模型 + FeedbackStore 追加写
- 实现 `src/lu/feishu/`：FeedbackSink 协议 + LocalJsonlSink 本地占位
- CLI 增加 `--feedback-note` / `--feedback-path` / `--resume` / `--from-step`
- 新增 4 个测试文件：orchestrator_resume (3) + feedback_store (7) + feishu_local_sink (5) + cli_feedback (2)

### 学到什么
- 续跑用 `_state_index` 辅助比较，state 越靠后数字越大
- FileStore.load(run_id, key, type) 用 Pydantic 反序列化
- `FeedbackSink` 用 `Protocol + runtime_checkable`，v2.x 直接换实现
- sink 失败不应阻塞本地写入（异常隔离）

### 接下来
- v1.2：TUI 交互 / 飞书真实 API / 爆款二创

### 状态
✅ 已完成（315/315 测试通过）

---

## v1.2：TUI + 飞书 config sync（2026-06-17）

### 做了什么
- 实现 `src/lu/tui/`：`make_ask_user/yes_no`（rich.prompt）+ `select_sections_interactive`
- 实现 `src/lu/cli/interactive.py`：`lu interactive` 子命令（TUI 全流程）
- 实现 `src/lu/feishu/client.py`：FeishuBitableClient（lark-cli subprocess 包装）
- 实现 `src/lu/feishu/style_profile.py`：StyleProfile ↔ Bitable 序列化
- 实现 `src/lu/cli/config.py`：`lu config pull/push/sync` 子命令
- CLI run.py 注册 `interactive` / `config` 子命令
- 新增 6 个测试文件：tui_prompts (4) + tui_sections (3) + cli_interactive (2) + feishu_client (5) + feishu_style_profile (2) + cli_config (7)

### 学到什么
- TUI 不改 `SocraticEngine` 接口，仅替换 `ask_user/yes_no` 回调
- 段位 TUI 直接构造 sections，不依赖 `SectionSelector.select`（避免 monkey-patch 递归）
- 飞书 client 用 lark-cli subprocess，不引入 Python SDK
- `lu config` 子命令需 2 级 subparser：`config → pull/push/sync`

### 接下来
- v1.3：爆款二创（ViralGenome）
- v1.4：复盘/雷达/周报

### 状态
🚧 进行中（338/338 测试通过）
