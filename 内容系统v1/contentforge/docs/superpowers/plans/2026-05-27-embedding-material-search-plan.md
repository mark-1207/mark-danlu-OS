# ContentForge: Embedding 语义素材匹配

## Context

当前 `material-search` 只用 Tavily/Serper/Bing 关键词搜索。关键词匹配不靠谱——搜"中年白领失业"漏掉"35岁互联网人被迫转行"，搜"AI焦虑"漏掉"ChatGPT让设计师失业"。

已就绪的 embedding 基础设施：
- `src/utils/embedding.ts` — `computeEmbedding`（小米primary → Google fallback，自动缓存）+ `cosineSimilarity` + `SIMILARITY_THRESHOLD = 0.80`
- 素材文件存于 `D:\myproject\内容系统v1\contentforge\output\corpus\`（Case/Atom/Insight）

**目标**：创建 `ObsidianMaterialStore`，对 Obsidian 素材库建 embedding index，大纲 case slot 语义匹配，返回相似素材注入 content-generation。

---

## 架构设计

```
material-search (doExecute)
    │
    ├─ 关键词搜索（Tavily/Serper/Bing）→ extractMaterials() → LLM 提取 → Web素材
    │
    └─ ObsidianMaterialStore（新增）
         │
         ├─ buildIndex()  启动时扫描 corpus/ 下所有 .md 文件
         │                   读取 frontmatter.tags + 正文前200字
         │                   调用 computeEmbedding() 批量建索引
         │                   持久化到 corpus/material-embeddings.json
         │
         ├─ search(query, topK=3)  当 case slot 有搜索需求时
         │                   嵌入 query → cosine similarity 排序
         │                   返回 topK 条 + similarity score
         │
         └─ mergeResults(webMaterials, semanticMatches)
                          合并两个通道，去重后注入 allMaterials
```

### ObsidianMaterialStore 接口

```typescript
// src/scenarios/create/steps/obsidian-material-store.ts

interface MaterialDoc {
  id: string;           // 文件名（无扩展名）
  filePath: string;
  tags: string[];       // frontmatter.tags
  platform?: 'wechat' | 'xiaohongshu' | 'douyin';
  content: string;       // 正文前200字
  embedding: number[];   // 预计算好的向量
  lastUpdated: string;
}

class ObsidianMaterialStore {
  private index: MaterialDoc[] = [];
  private indexPath = 'output/corpus/material-embeddings.json';

  async buildIndex(): Promise<number>;  // 扫描 corpus/ → 嵌入 → 写文件，返回条目数
  async loadIndex(): Promise<void>;     // 从文件加载（避免每次重新嵌入）
  async search(query: string, topK?: number): Promise<Array<MaterialDoc & { similarity: number }>>;
  async searchByTag(tag: string, topK?: number): Promise<MaterialDoc[]>;
}
```

### 数据流（完整 pipeline）

```
Step 3: outline ×3平台并行 → context 写入 case slot 文本
    │
Step 4: material-search（修改）
    │
    ├─ web通道：关键词搜索 → LLM 提取 → webMaterials[]
    │
    └─ obsidian通道（新增）
         │  对每个 case slot 文本：
         │  → computeEmbedding(slotText)
         │  → cosineSimilarity × corpus index
         │  → 按相似度排序，返回 topK
         │
    └─ mergeResults(webMaterials, semanticMatches)
         → 去重（URL 精确匹配）
         → 写入 context.allMaterials 前
         → 注入 content-generation

Step 5: content ×3平台并行
    │  allMaterials 包含 web + obsidian 两个来源
    │
    └─ 内容生成时优先使用带 similarity score 的素材
```

### 素材格式（corpus 目录结构）

```
output/corpus/
├── material-embeddings.json    # 向量索引（自动生成）
├── case-library/               # 案例库
│   ├── 2026-05-20-中年失业转型.md
│   └── 2026-05-21-AI设计师失业.md
├── insight-library/            # 洞察库
└── atom-library/              # 原子库
```

每个素材文件 frontmatter：

```yaml
---
id: 2026-05-20-中年失业转型
title: 中年失业转型：从大厂到自由职业
platform: wechat
tags: [职场, 中年危机, 转型, AI影响]
type: case
createdAt: 2026-05-20
---
```

---

## 实施计划

### Phase A: ObsidianMaterialStore

**新增文件：** `src/scenarios/create/steps/obsidian-material-store.ts`

| 函数 | 职责 |
|------|------|
| `buildIndex()` | 扫描 corpus/*.md → 读 frontmatter + content前200字 → 批量 computeEmbedding → 写 material-embeddings.json |
| `loadIndex()` | 从文件加载索引（buildIndex 后的快速路径）|
| `search(query, topK)` | 嵌入 query → cosine × 所有 doc → 排序 → topK |
| `searchByTag(tag, topK)` | 按 tag 过滤 → search |

**持久化格式：** `output/corpus/material-embeddings.json`
```json
{
  "version": 1,
  "builtAt": "2026-05-27T...",
  "docs": [
    {
      "id": "2026-05-20-中年失业转型",
      "filePath": "output/corpus/case-library/2026-05-20-中年失业转型.md",
      "tags": ["职场", "中年危机"],
      "platform": "wechat",
      "content": "...",
      "embedding": [0.123, -0.456, ...],
      "lastUpdated": "2026-05-20"
    }
  ]
}
```

### Phase B: material-search 集成

**修改文件：** `src/scenarios/create/steps/material-search.ts`

在 `doExecute()` 中，`extractMaterials` 调用后：
1. 初始化 `ObsidianMaterialStore`，调用 `loadIndex()` 或 `buildIndex()`
2. 对每个 case slot 文本调用 `search(slotText, topK=3)`
3. 合并 webMaterials + semanticMatches，去重
4. 在结果中标记 `source: 'obsidian'` vs `source: 'web'`

**配置项**（在 config/contentforge.yaml）：
```yaml
search:
  enabled: true
  obsidianEnabled: true        # 新增：是否启用 Obsidian 语义匹配
  obsidianIndexPath: output/corpus/material-embeddings.json
  obsidianTopK: 3             # 每个 slot 返回多少条
  obsidianThreshold: 0.80    # cosine similarity 阈值
```

### Phase C: CLI 命令（可选，可跳过）

```bash
# 重建素材向量索引
node dist/index.js create build-material-index
```

### Phase D: TDD 测试

| 测试 | 验证 |
|------|------|
| T17 | buildIndex 扫描 corpus/ 下 .md 文件并写入索引 |
| T18 | loadIndex 从文件加载并恢复 docs |
| T19 | search 返回按 similarity 排序的结果 |
| T20 | searchByTag 按 tag 过滤 |
| T21 | material-search 合并 web + obsidian 结果 |
| T22 | 重复素材去重（URL 精确匹配） |

### Phase E: E2E 验收

```bash
# 准备素材文件
echo "---
id: test-1
title: AI时代设计师失业案例
platform: wechat
tags: [AI, 设计, 失业]
type: case
---" > output/corpus/case-library/test-case.md

# 重建索引
node dist/index.js create build-material-index

# 查看索引内容
cat output/corpus/material-embeddings.json | jq '.docs | length'

# 端到端跑 material-search（需 API key）
# 验证 obsidian 素材出现在 allMaterials 中
```

---

## 设计原则

1. **静默降级** — Obsidian 素材库为空或 embedding API 失败时，只用关键词搜索，不报错
2. **批量嵌入** — buildIndex 时用 Promise.all 批量请求，避免逐个阻塞
3. **自动刷新** — 索引文件比素材文件旧时自动 rebuild（mtime 比对）
4. **不侵入 existing flow** — material-search 默认 disabled，不破坏现有 pipeline

---

## 复用现有代码

- `src/utils/embedding.ts` — `computeEmbedding` + `cosineSimilarity` + `SIMILARITY_THRESHOLD`
- `src/scenarios/create/steps/material-search.ts` — 入口，不改核心流程，只增加 obsidian 分支
- `src/scenarios/create/types.ts` — Material 类型（已有 `source` 字段可复用）

---

## Status: PLANNED（2026-05-27）