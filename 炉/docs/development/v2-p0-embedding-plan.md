# v2 P0 — Embedding 语义匹配方案

> 状态：方案草稿 v1 | 日期：2026-06-18
> 路径：v2 P0 第 3 项（飞书配置 ✅、阶段 2-3 学习 ✅、Embedding ⏳）
> 工期估算：1-1.5 周

---

## 1. 目标

把 7 步流程从"单次 LLM 调用闭环"升级为"跨 run 的语义记忆"，让每篇文章在动笔前能看到自己历史上的相关命题 / 案例 / 金句 / 洞察。

### 1.1 三个使用场景

| 场景 | 触发 | 用途 |
|------|------|------|
| **跨命题主题聚合** | 用户回顾 / 复盘 | "杠杆者" 标签下历史所有相关材料 |
| **智能召回** | Step 3 蓝图设计前 | 给 LLM 注入相关 past cases / quotes / insights |
| **命题相似度检测** | Step 2 追问完成后 | 提示用户"这题和 2026-05-XX 的 X 命题 92% 相似，是否继续？" |

### 1.2 验收标准

- 蓝图 prompt 注入召回素材（top-k=3, threshold ≥ 0.7）
- 命题相似度 ≥ 0.9 触发提示
- 全量测试 374 → ≥ 404（新增 ≥ 30 embedding 测试），全绿
- Embedding 调用支持 fallback，单 provider 失败不阻塞

---

## 2. 范围

### 2.1 in scope

- `src/lu/embedding/` 模块：types / providers / chain / index / recall / factory
- OpenAI-compatible embedding provider（覆盖 OpenAI / NVIDIA NIM / OpenRouter）
- 本地 JSONL 索引（`data/embeddings/`，运行时数据不入库）
- Orchestrator 集成：Step 2 后记录 + 相似度提示，Step 3 前召回
- CLI：`lu embed`（单文本 embedding）/ `lu recall`（top-k 召回）
- 单元测试 + 端到端测试（mock httpx）

### 2.2 out of scope

- ❌ 智谱 / Tavily / Google embedding（roadmap 列出但用户免费 key 列表中无；后续 v2.x 可加）
- ❌ 真正的向量数据库（chromadb / lancedb）—— 用 JSONL + numpy 足够 v2 P0
- ❌ 跨设备 embedding 索引同步（依赖 v2 P0 飞书配置之后）
- ❌ Embedding 索引增量更新后台任务（v2.x 评估）

---

## 3. 架构

### 3.1 模块结构

```
src/lu/embedding/
├── __init__.py        # 暴露 EmbeddingChain / EmbeddingIndex / recall / types
├── types.py           # EmbeddingResult / EmbeddingProvider Protocol
├── providers.py       # OpenAIEmbeddingProvider（OpenAI-compatible，含 NVIDIA NIM）
├── chain.py           # EmbeddingChain（多 provider fallback，复用 LLMChain 模式）
├── factory.py         # EmbeddingFactory（从 env 构造 chain）
├── index.py           # EmbeddingIndex（JSONL 追加写 + cosine recall）
└── recall.py          # recall_materials(query, index, kind=None, top_k=3, threshold=0.7)
```

### 3.2 索引存储

```
data/embeddings/
├── materials.jsonl      # 素材库：{id, kind, text, source, tags, ts, embedding}
│                        # kind: case | quote | insight | proposition
└── propositions.jsonl   # 命题历史：{proposition, ts, run_id, embedding}
```

每行一条 JSON，`embedding` 为 list[float]。

### 3.3 Provider 链

- 默认 primary：OpenAI `text-embedding-3-small`（1536 维）
- 默认 fallback：本地 hash-based pseudo embedding（v1 应急；保证链路不断）
- 用户可配 `LU_EMBEDDING_BASE_URL` / `LU_EMBEDDING_API_KEY` / `LU_EMBEDDING_MODEL` 切到 NVIDIA NIM / OpenRouter

### 3.4 Orchestrator 集成点

```
Step 1: 命题输入
    ↓
Step 2: 苏格拉底追问 → refined_proposition
    ↓
【新增 2.5】embedding_recall_hook:
    - 算 refined.embedding
    - 查 propositions.jsonl，cosine ≥ 0.9 → 警告（不阻塞）
    - 写入 propositions.jsonl
    ↓
Step 3: 蓝图设计
    ↓
【新增 3.5】embedding_recall_hook:
    - 算 refined.embedding
    - 查 materials.jsonl，kind in {case, quote, insight}，cosine ≥ 0.7 → top-3
    - 注入到 blueprint prompt
    ↓
Step 4-7: 不变
```

### 3.5 数据流

```
RefinedProposition ──embed()──→ vector
                              ↓
            ┌─────────────────┼─────────────────┐
            ↓                 ↓                 ↓
   propositions.jsonl    相似度提示     materials.jsonl 召回 top-3
            ↓                                  ↓
       跨 run 历史                       Blueprint prompt
```

---

## 4. TDD 步骤

### 4.1 阶段 0：types + provider（先 red）

| 测试 | 验证 |
|------|------|
| `test_embedding_types_protocol` | `EmbeddingProvider` Protocol 存在 |
| `test_embedding_result_fields` | `EmbeddingResult` 字段完整 |
| `test_openai_embedding_provider_call_ok` | 调 `/v1/embeddings` 解析返回 |
| `test_openai_embedding_provider_401_raises_auth` | 鉴权失败 → `LLMError(code="AUTH")` |
| `test_openai_embedding_provider_429_raises_rate_limit` | 限流 → `LLMError(code="RATE_LIMIT")` |
| `test_openai_embedding_provider_empty_key_raises` | 启动时 key 为空直接抛错 |

### 4.2 阶段 1：chain + factory

| 测试 | 验证 |
|------|------|
| `test_embedding_chain_first_success` | primary 成功直接返回 |
| `test_embedding_chain_fallback` | primary 抛错 → fallback 接住 |
| `test_embedding_chain_all_fail_raises` | 全部失败抛最后一个错 |
| `test_embedding_factory_from_env_default` | 默认 OpenAI 链 |
| `test_embedding_factory_from_env_nvidia` | 设 `LU_EMBEDDING_BASE_URL` 切到 NVIDIA |
| `test_embedding_factory_no_key_raises` | 无 key 时抛错 |

### 4.3 阶段 2：index + recall

| 测试 | 验证 |
|------|------|
| `test_embedding_index_add_and_count` | add 增加 count |
| `test_embedding_index_persist` | 重新构造仍能读到 |
| `test_embedding_index_recall_top_k` | recall 返回 top-k，按相似度降序 |
| `test_embedding_index_recall_threshold_filter` | threshold=0.7 滤掉低分 |
| `test_embedding_index_recall_kind_filter` | `kind="case"` 只返 case |
| `test_cosine_similarity_identical_is_one` | 同向量 = 1.0 |
| `test_cosine_similarity_orthogonal_is_zero` | 正交 = 0.0 |
| `test_cosine_similarity_dim_mismatch_raises` | 维度不一致抛错 |

### 4.4 阶段 3：orchestrator 集成

| 测试 | 验证 |
|------|------|
| `test_orchestrator_records_proposition_embedding` | run 完写入 propositions.jsonl |
| `test_orchestrator_warns_on_similar_proposition` | 相似 ≥ 0.9 触发 warning（不阻塞） |
| `test_orchestrator_recall_injects_into_blueprint_prompt` | Step 3 prompt 包含召回素材 |
| `test_orchestrator_disabled_when_no_chain` | 不传 chain 时退化（不写入不召回） |

### 4.5 阶段 4：CLI

| 测试 | 验证 |
|------|------|
| `test_cli_embed_text` | `lu embed "text"` 输出向量长度 |
| `test_cli_recall_text` | `lu recall "text" --top-k 3` 输出 top-3 素材 |
| `test_cli_recall_kind_filter` | `--kind case` 只返 case |

**预计新增测试**：~30 个（types 2 + provider 4 + chain 3 + factory 3 + index/recall 8 + orchestrator 4 + CLI 3 + 杂项 3）

---

## 5. 集成计划

### 5.1 配置加载

- `config/defaults.yaml` 增加：
  ```yaml
  embedding:
    primary: openai
    model: text-embedding-3-small
    dimension: 1536
    recall_top_k: 3
    recall_threshold: 0.7
    similar_warning_threshold: 0.9
  ```
- `lu.embedding.factory.EmbeddingFactory.from_config(config, env)` 构造 chain

### 5.2 Orchestrator 改造

- `Orchestrator` 增加可选字段 `embedding_chain: EmbeddingChain | None = None`
- 新增方法 `_post_socratic_recall(refined, store, log)` 和 `_pre_blueprint_recall(refined, store, log)`
- 不传 chain 时：原行为完全不变（向后兼容 v1.x CLI）

### 5.3 CLI

- `cli/embed.py`：`lu embed <text>` 输出 `[dim=1536] [-0.0123, 0.4567, ...]`
- `cli/recall.py`：`lu recall <text> [--top-k N] [--kind case|quote|insight|proposition]`
- `cli/run.py` 注册 subparser

### 5.4 依赖

- 新增：`numpy>=1.26`（cosine + 向量运算）
- 已用：`httpx` / `pydantic` / `pyyaml`

---

## 6. 验证

### 6.1 单元 / 集成

- 全部新测试通过（~30）
- 全量回归：374 + 30 = 404 测试全绿
- `ruff check src/lu/embedding tests/test_embedding*.py` 0 issue
- `mypy src/lu/embedding` strict 模式 0 error

### 6.2 端到端

- `--dry-run` 模式：embedding chain 用 echo provider（返回固定 1536 维全 0 向量）
- 真实模式：用户配置 `LU_EMBEDDING_API_KEY` 后 `lu run "命题"` Step 2 后 propositions.jsonl 增长

### 6.3 文档

- `docs/11-PROGRESS.md` 加 v2 P0 Embedding 阶段
- `docs/14-TASKS.md` 更新状态
- `MEMORY.md` 推到 v2 P0 Embedding
- 写 `docs/decisions/D-009-embedding-design.md`（ADR 选型记录）

---

## 7. 任务分解

| # | 任务 | 工期 | 状态 |
|---|------|------|------|
| 1 | 写 `embedding/types.py` + tests | 0.1 天 | ⏳ |
| 2 | 写 `embedding/providers.py` + tests | 0.3 天 | ⏳ |
| 3 | 写 `embedding/chain.py` + tests | 0.2 天 | ⏳ |
| 4 | 写 `embedding/factory.py` + tests | 0.2 天 | ⏳ |
| 5 | 写 `embedding/index.py` + tests | 0.3 天 | ⏳ |
| 6 | 写 `embedding/recall.py` + tests | 0.2 天 | ⏳ |
| 7 | 写 `config/defaults.yaml` + loader 扩展 | 0.2 天 | ⏳ |
| 8 | Orchestrator 集成 + tests | 0.3 天 | ⏳ |
| 9 | `cli/embed.py` + `cli/recall.py` + tests | 0.2 天 | ⏳ |
| 10 | D-009 ADR + 文档更新 | 0.2 天 | ⏳ |
| 11 | E2E + commit + push | 0.3 天 | ⏳ |

**总工期**：~2.5 天实际工作量（1-1.5 周含 review/调整）

---

## 8. 风险与权衡

| 风险 | 缓解 |
|------|------|
| NVIDIA NIM / OpenRouter embedding 是否真免费 | v1 暂不锁 provider，OpenAI-compatible 协议 + 用户自配 URL |
| Embedding 索引膨胀 | v1 不清理；v2.x 加 TTL / 按需重索引 |
| Recalled 素材污染 prompt 质量 | top-3 + 0.7 threshold + prompt 中明确标注为"参考素材" |
| Orchestrator 改动破坏 v1.1 行为 | 嵌入 chain 可选，不传时完全退化 |
| 真实 LLM 失败阻塞流程 | chain fallback 链 + 全部失败时 warn-and-skip（不抛错） |

---

## 9. 关联文档

- [09-ROADMAP-V2 §4 Embedding 语义匹配](../09-ROADMAP-V2.md)
- [02-ARCHITECTURE §2 7 步流程](../02-ARCHITECTURE.md)
- [06-DEV-PLAN](../06-DEV-PLAN.md)
- ContentForge `src/providers/embedding/`（设计参考）
