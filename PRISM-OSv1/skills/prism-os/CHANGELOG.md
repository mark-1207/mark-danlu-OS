# PRISM-OS 更新日志

## 版本历史

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
| v1.0.5 | LLM 三级 Fallback + 意图识别增强 | 待发布 |
| v1.0.6 | 用户手册完善 | 待发布 |
| v1.1.0 | V3 刺客机制优化 | 待开发 |
| v1.2.0 | V4 数字分身完善 | 待开发 |
| v2.0.0 | Web UI 界面 | 规划中 |

---

**最后更新**：2026-05-08