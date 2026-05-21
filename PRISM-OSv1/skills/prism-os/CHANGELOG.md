# PRISM-OS 更新日志

## 版本历史

---

### v1.0.9 (2026-05-21)

**状态**：开发中

#### 新增（RSS-Hunter × PRISM-OS 深度整合 → 选题情报员）

- **crack_queue v2.0 数据结构**：
  - 新增 `signals`（trend/emotion/contradiction/homogenization_alert）
  - 新增 `expression_angles`（创作者类型 + 表达入口 + 匹配度）
  - 新增 `creator_match`（growth_stage/sensitive_directions/match_score）
  - `priority_score` 增加 homogenization_penalty 因子

- **crack_hunter_wrapper prompt 升级**：
  - 从"判断裂缝"升级为"提炼 5 类认知信号"
  - signals：趋势/情绪/矛盾/同质化预警
  - expression_angles：为不同类型创作者生成表达入口

- **RSS-Hunter 输出改造**：
  - 不再写入 Obsidian，改为写入 crack_queue
  - 终端推送降级为每日简洁汇总
  - 新增 `prism_os.py queue` 子命令（--list/--tag/--dismiss）

- **PRISM-OS 接入层**：
  - `--from-queue`：队列浏览 + 多选合并进入主流程
  - `--match-queue`：输入时匹配队列，展示 signals/expression_angles
  - 正常输入被动提示：队列有相关裂缝时提示

#### 实施计划

| Phase | 内容 | 状态 |
|-------|------|------|
| A | crack_queue v2.0 + RSS-Hunter 输出改造 | 待开发 |
| B | `--from-queue` 入口 | 待开发 |
| C | `--match-queue` + 被动提示 | 待开发 |
| D | 数字分身扩展 + 归档功能 | 待开发 |

方案文档：`docs/development/RSS-Hunter-PRISM-OS-Integration-Plan.md`

---

### v1.0.8 (2026-05-20)

**状态**：当前版本

#### 新增（Phase 5.5）

- **文章抓取方案**：集成 autocli（`D:\myproject\内容系统v1\contentforge\autocli.exe`）
  - `scrape_article()` 支持微信公众号（`weixin download`）和通用网页（`read`）
  - `extract_key_content()` 用 LLM 提取关键段落和摘要
  - `scrape_and_import_material()` 完整抓取→入库流程
- **Obsidian 入库自动召回**：
  - `scan_vault` glob 改为 `**/*.md` 递归扫描子目录
  - 素材写入 `洞察库/`、`原子库/`（直接目录，非 rss-cracks 子目录）
  - 入库后下次 `recall_materials_by_module` 自动发现新文件
- **逐模块交互确认界面**：
  - `interactive_content_generation_workflow()` 逐模块生成流程
  - 支持 [回车]确认 / [r]重写(最多2次) / [e]编辑 / [q]退出
  - CLI 入口：`python prism_os.py generate "<标题>" --platform wechat --interactive`
- **修改记录用于风格学习**：
  - `record_modification` 持久化到 `data/modification_log.json`
  - `get_style_preferences()` 从修改记录学习：HOOK长度、CASE深度/视角、高频删/添词
  - `build_style_hints()` 将偏好转为 prompt hint
  - `generate_single_module` 每次生成自动注入风格偏好

#### 修复

- `scan_vault` 只扫描单层 `*.md`，改为递归 `**/*.md` 以发现子目录素材

---

### v1.0.7 (2026-05-19)

**状态**：已发布

- **Phase 4.5 CCOS v2.0**：认知推进流动态大纲（Layer 0-8，14项输出）
  - 新增 `cognitive_outline.py` — 认知模块流 + 势能曲线 + 双平台差异化
  - 新增 `ccos` CLI 命令：`python prism_os.py ccos "<标题>" --platform both`
  - Layer 0 认知对齐追问（七类追问）
  - 支持公众号/小红书双平台分别生成
- **Phase 4.6 Gap Analysis 增强**：新增 `thesis_summary` 字段，`generate_outlines()` 标记废弃

#### 优化

- **Phase 4.7 LLM 优化**：
  - Layer 2 三个 LLM 调用改为并行化（extract_core_problem / extract_cognitive_tension / infer_potential_directions）
  - `generate_dual_platform_outline` 双平台共享 Layer 2 结果（18次→12次）
  - `calculate_entropy` 熵值计算改为纯公式实现（1次→0次）
  - `recognize_content_goal` / `recognize_user_motivation` 规则版（扩充关键词表）
  - `_call_llm_raw` 修复 scene bug（设置 GATEWAY_SCENE=writing-cn）
  - 回退 `classify_topic_type` / `decide_progression_method` 到 LLM（规则版覆盖率不足）

#### 修复

- 修复 `cognitive_outline.py` 9个 LLM 调用无 Scene 的 bug
- 修复 `gap_analysis.py` 缺少 `thesis_summary` 字段问题

#### 测试

- 53项单元测试全部通过

---

### v1.0.6 (2026-05-14)

**状态**：当前版本

#### 新增

- **数字分身 Phase 3.5**：从历史选题学习思维特征（dimension_weights, style_keywords），自动筛选候选标题
- **反馈循环**：记录用户对分身推荐的接受/拒绝，计算匹配度，每 50 次触发校准
- **单元测试**：60 个测试覆盖 storage/embedding/prism_engine/cognitive_crack 纯逻辑函数

#### 修复

- `call_llm.py` API Key 从硬编码改为环境变量（KIMI_API_KEY, OPENROUTER_API_KEY）
- 删除重复的 OPENROUTER_API_KEY 定义和 refresh_openrouter_models() 调用
- 删除无用的 start-gateway.sh / stop-gateway.sh（引用不存在的 dist/http-server.js）

#### 更新

- `save_yaml()` 使用 JSON 序列化，修复扩展字段丢失问题
- `load_yaml()` 兼容新旧两种格式

---

### v1.0.5 (2026-05-08)

**状态**：已合并

#### 新增

- **三级 LLM Fallback 架构**：
  - Gateway（免费）→ Kimi（付费兜底）→ OpenRouter（付费备用）
  - Kimi 场景模型自动映射（reasoning/quality/writing-cn 等）
  - OpenRouter 模型顺序：gemini-2.0-flash-exp → claude-sonnet-4.6
- **意图识别增强**：支持话题疑问句隐式触发（为什么、是什么、如何等）
- **Kimi 模型分配**：
  - kimi-k2.6：reasoning、long-context
  - moonshot-v1-128k：quality、writing-cn/en、translation、summary、extraction
  - moonshot-v1-32k：fast
  - moonshot-v1-128k-vision-preview：multimodal

#### 修复

- Kimi kimi-k2 模型 404 问题 → 改用 moonshot-v1-128k
- Kimi kimi-k2-thinking 429 限流 → 改用 kimi-k2.6
- 意图识别对话题提问不触发的问题

#### 更新

- README.md：新增 LLM 三级 Fallback 架构说明
- call_llm.py：重写三级 fallback 逻辑

---

### v1.0.4 (2026-04-30)

**状态**：已合并

#### 新增

- 完整的用户使用手册 `MANUAL.md`，面向零基础用户

#### 修复

- 删除了 SKILL.md 中重复的"错误处理"章节

---

### v1.0.3 (2026-04-30)

**状态**：当前版本

#### 补充

- **苏格拉底网关**：补充输入类型分类（keyword/sentence/question）、target_emotion 提取、cognitive_crack 识别
- **棱镜引擎**：统一标题长度为 18-28 字，补充四维中文定义（认知裂缝/利益锚定/场景具象/反常识挑衅）
- **现实校验锚**：补充 trend_score 计算、综合评分公式 `score×0.5 + novelty×0.3 + trend×0.2`
- **相似度算法**：实现 `Jaccard×0.4 + Cosine×0.6` 计算
- **词汇指纹检测**：与现实校验锚集成，支持 cliche 检测和替换建议
- **PRISMError 异常类**：新增专用异常
- **safe_generate 函数**：完整错误处理结构
- **性能优化**：缓存机制、并行生成、API 限流重试

#### 更新

- `references/socratic_gateway.md`：补充完整实现规格
- `references/prism_engine.md`：更新四维定义
- `references/reality_anchor.md`：补充综合评分和算法
- `scripts/storage.py`：增加 cliche 检测、相似度计算、PRISMError 支持

---

### v1.0.2 (2026-04-30)

**状态**：已合并

#### 新增

- **V3 扩展**（Phase 7）：
  - `assassin_mechanism.md` - 刺客机制
  - `knowledge_topology.md` - 知识拓扑图谱
  - `prompt_evolution.md` - Prompt 自动变异
- **V4 扩展**（Phase 8）：
  - `cognitive_crack_hunter.md` - 认知裂缝捕捉
  - `digital_twin.md` - 数字分身
- **词汇指纹库**：`vocab_fingerprint.json`

#### 更新

- SKILL.md 新增 Phase 7 和 Phase 8
- README.md 更新版本覆盖（V1-V4）
- 部署检查清单新增 V3/V4 相关项

---

### v1.0.1 (2026-04-30)

**状态**：初始版本

#### 包含

- **核心模块**（V1 + V1.5 + V2）：
  - SKILL.md 主配置
  - README.md 项目说明
  - 3 个 Python 脚本（call_llm.py / search.py / storage.py）
  - 8 个参考文档（intent_recognition / socratic_gateway / prism_engine / reality_anchor / gap_analysis / logic_stress_test / cognitive_journey）
  - config/user_config.yaml.example 配置模板

#### 功能

| 模块 | 说明 |
|------|------|
| Phase 0 | 意图识别 + 追问确认 |
| Phase 1 | 苏格拉底网关（熵值计算） |
| Phase 2 | 棱镜引擎（四维生成） |
| Phase 3 | 现实校验锚（搜索查重） |
| Phase 4 | Gap Analysis + 双端大纲 |
| Phase 5 | 逻辑压力测试 + 认知旅程 |

---

## 文档目录

| 文件 | 说明 |
|------|------|
| `SKILL.md` | Skill 入口，核心配置 |
| `README.md` | 项目说明 |
| `MANUAL.md` | 用户使用手册 |
| `CHANGELOG.md` | 本文件 |
| `config/user_config.yaml.example` | 配置模板 |
| `references/*.md` | 各模块详细说明 |
| `scripts/*.py` | 工具脚本 |

---

## 迭代规范

### 版本号格式

```
major.minor.patch
```

| 位置 | 说明 |
|------|------|
| major | 主版本，不兼容变更 |
| minor | 次版本，新增功能（向后兼容） |
| patch | 补丁，bug 修复 |

### 提交规范

更新时记录：

```markdown
### x.y.z (YYYY-MM-DD)

**状态**：待发布/已发布

#### 新增
- 新增功能描述

#### 修复
- bug 修复描述

#### 更新
- 现有功能变更

#### 删除
- 已废弃功能移除
```

---

## 计划

| 版本 | 目标 | 状态 |
|------|------|------|
| v1.0.7 | Phase 4.5-4.7 CCOS + LLM优化 | ✅ 已完成 |
| v1.1.0 | Phase 5 内容生成（模块级生成，素材先行） | 开发中 |
| v1.2.0 | Phase 5.5 小红书版本 | 待开发 |
| v1.3.0 | Phase 6.0 互动数据闭环 | 待开发 |
| v2.0.0 | Web UI 界面 | 规划中 |

---

**最后更新**：2026-05-20