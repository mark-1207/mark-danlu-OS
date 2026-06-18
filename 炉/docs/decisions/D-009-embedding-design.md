# D-009: Embedding 语义匹配选型

> 日期：2026-06-18 | 状态：采纳
> 关联：[v2 P0 Embedding 方案](../development/v2-p0-embedding-plan.md) / [v2 规划 §4](../09-ROADMAP-V2.md)

## 背景

v1.x 的 7 步流程是"单次 LLM 闭环"：每次 run 独立完成 7 步，不感知历史。
v2 P0 引入 Embedding 语义匹配，让流程在动笔前能看到自己历史上的相关命题 / 案例 / 金句 / 洞察。

三个使用场景：
1. 跨命题主题聚合（"杠杆者"标签下的所有案例/金句/洞察）
2. 智能召回（Step 3 蓝图设计前注入相关 past materials）
3. 命题相似度检测（避免重复命题）

## 决策

### D-009.1: OpenAI-compatible 协议作为统一抽象

**选**：实现 `OpenAIEmbeddingProvider`，与现有 `lu.llm.providers.OpenAIProvider` 同协议风格。
任何支持 `/v1/embeddings` 端点的服务（OpenAI / NVIDIA NIM / OpenRouter）都能直接接入。

**理由**：
- 用户已注册 NVIDIA（102 免费模型）+ OpenRouter（25+ 免费模型），未来切 provider 零代码改动
- 智谱 / Tavily / Google 是 v2 路线图列出的备选，本期不实现（key 不可用）
- OpenAI-compatible 协议已成事实标准

**未选**：
- ❌ 智谱 zhipu embedding-3：用户的免费 key 列表中无
- ❌ 专用 SDK（cohere / voyage）：增加依赖，未必免费
- ❌ 自建本地模型（sentence-transformers）：体积大、首次运行慢

### D-009.2: JSONL + numpy 作为 v2 P0 索引方案

**选**：每条 embedding 写一行 JSONL，cosine 相似度用 numpy 算。

**理由**：
- 简单：复用现有 SampleStore / Obsidian 写入模式
- 可读：JSONL 可直接 `cat` / `grep` 调试
- 足够：v2 P0 数据量预估 < 10k 条记录，O(n) 扫描毫秒级

**未选**：
- ❌ Chroma / LanceDB / Weaviate：增加外部依赖，部署复杂
- ❌ SQLite + 自定义索引：复杂度高、收益小（v2 P0 阶段数据量小）
- ❌ HNSW / FAISS：杀鸡用牛刀

### D-009.3: chain 失败时 warn-and-skip，不阻塞主流程

**选**：所有 embedding 调用失败时（API 错误 / 网络断 / key 失效），
返回空结果 + 跳过写入，但主流程（Orchestrator.run）继续跑完。

**理由**：
- embedding 是辅助能力，不能成为主流程的硬依赖
- 真实生产环境 embedding API 偶发失败很常见
- 与 v1.x LLM 行为一致（LLMError 时主流程中断）形成对比：
  LLM 是核心依赖 → 必失败；embedding 是增强 → 可降级

**未选**：
- ❌ 硬失败：embedding 失败时整个 run 失败 → 用户体验差
- ❌ 静默完全跳过：可能让用户不知道功能被禁用 → 选 warn-and-skip 加日志

### D-009.4: 召回阈值 / 相似提示阈值是启发式初始值

**选**：recall_threshold=0.7，similar_warning_threshold=0.9。后续根据真实数据校准。

**理由**：
- v2 P0 没有真实运行数据可校准
- 0.7 是 NLP 社区常用 cosine 阈值
- 0.9 提示"几乎重复"是经验值
- 阈值在 EmbeddingHook 构造时显式传入，配置化

### D-009.5: Orchestrator 集成点是可选的

**选**：`Orchestrator.run(..., embedding_hook=None)`，不传 hook 时 v1.x 行为完全不变。

**理由**：
- 向后兼容 v1.1/v1.2/v1.3/v1.4 的所有 CLI 入口
- 不传 hook 时不创建 index 文件、不调用 embedding API
- 测试可以独立验证有/无 hook 两种路径

## 架构图

```
        ┌─────────────────────────────────────────────┐
        │  Orchestrator.run(proposition, ..., hook)   │
        └──────────────────┬──────────────────────────┘
                           │
        ┌──────────────────┼───────────────────────────────┐
        │                  │                                │
   Step 2 done       Step 3 start                      Step 7 done
        │                  │                                │
   hook.find_similar  hook.recall_materials         hook.record_materials
   hook.record_prop   ↓ (注入 BlueprintDesigner prompt)
        ↓                  ↓
   propositions.jsonl  materials.jsonl (recall → Blueprint)
```

## 验证

- 单元 / 集成 / 端到端：91 个 embedding 测试 + 全量 465 测试通过
- 向后兼容：所有 v1.x 测试零修改通过
- chain 失败：6 个失败注入测试（chain 抛错）全部不阻塞主流程

## 关联

- D-001 独立仓库策略
- D-002 7 步循环
- D-006 配置化（YAML / 飞书表格）
- D-008 苏格拉底 3 阶段学习

## 后续

- 真实 API 联调：用户配置 OPENAI_API_KEY / NVIDIA_API_KEY 后跑通端到端
- 索引清理：v2.x 加 TTL / 按需重索引
- 阈值校准：积累 100+ run 后用真实数据回测
