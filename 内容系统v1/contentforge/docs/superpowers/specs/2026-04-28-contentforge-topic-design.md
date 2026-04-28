# ContentForge Topic Skill — 竞品分析与内容素材体系

## 1. 目标与定位

**核心目标**：建立正向循环 — 竞品拆解 + 自产内容分析 → 反哺系统 → 高质量稳定输出

**服务优先级**：
1. 选题灵感（竞品爆款结构分析）
2. 碎片库增强（句式/段落提取）
3. 风格学习（个人写作画像）
4. 热点追踪（趋势感知）

---

## 2. 系统架构

### 2.1 分层设计原则

**飞书表格（管理视图）** = 内容入口，存储完整记录，人工查阅
**碎片库（系统视图）** = 语言素材，句式/段落，自动注入 prompt

关系：**分层存储，单向同步**

```
┌─────────────────────────────────────────────────────────────────┐
│                      飞书表格（主库）                              │
│  - 人工录入/编辑                                                  │
│  - 完整记录展示                                                   │
│  - 标签/状态/收藏管理                                            │
│  - AI 分析结果（角度、结构、洞察）                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 同步触发（用户确认）
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      碎片库（缓存）                                │
│  - 句式碎片（hook/transition/cta/power-line...）                │
│  - 段落碎片（opening/argument/emotional-peak...）               │
│  - 自动注入 prompt                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 碎片库角色

碎片库 = **缓存**，不是主库。

来源构成：
| 来源 | 说明 |
|------|------|
| `edited` | corpus/original/ 目录（用户改写产出） |
| `external` | corpus/external/ 目录（手动放入） |
| `crawled` | 飞书表格竞品抓取来源 |
| `manual` | 飞书表格手动录入来源 |

---

## 3. 飞书表格设计

### 3.1 表名：竞品素材库

### 3.2 字段定义

| 字段 | 类型 | 说明 |
|------|------|------|
| 原文标题 | 文本（主字段） | 文章标题 |
| 原始链接 | URL | 原文地址 |
| 平台 | 单选 | 微信公众号/知乎/B站/微博/Twitter/YouTube/小宇宙/其他 |
| 互动数据 | 文本 | 点赞/收藏/阅读（手动补充） |
| 内容摘要 | 文本 | AI 提取的核心观点 |
| 爆款结构 | 文本 | AI 提取的叙事结构 |
| 选题角度 | 文本 | AI 提取的切入角度 |
| 标签 | 多选 | 主题标签（职场/成长/效率/科技...） |
| 来源类型 | 单选 | 我的创作/竞品抓取/手动录入 |
| 收藏 | 单选 | 是/空（标记优质竞品） |
| 状态 | 单选 | 待分析/已分析/已入库 |
| 抓取时间 | 日期 | 自动记录 |
| 碎片提取时间 | 日期 | 碎片入库时自动记录 |

### 3.3 状态流转

```
录入链接/内容
       │
       ▼
┌─────────┐     AI 开始分析     ┌─────────┐
│ 待分析   │──────────────────▶│ 已分析  │
└─────────┘                     └────┬────┘
                                     │
                       用户确认碎片提取  │
                             ┌───────┘
                             ▼
                        ┌─────────┐
                        │ 已入库  │  ← 碎片已同步到 fragment-library.json
                        └─────────┘
```

### 3.4 收藏夹功能

收藏夹**不单独建表**，使用"收藏"字段筛选：

| 筛选条件 | 结果 |
|---------|------|
| 收藏 = 空 | 全部竞品 |
| 收藏 = 是 | 收藏的优质竞品 |

**用途**：
- 选题时优先读取收藏的竞品
- 碎片注入时收藏来源权重更高
- 导出收藏夹做专题分析

---

## 4. 抓取流程设计

### 4.1 CLI 命令

```bash
# 抓取单篇文章
contentforge topic scrape --url "https://mp.weixin.qq.com/s/xxx"

# 关键词搜索抓取
contentforge topic scrape --platform zhihu --keyword "职场成长"

# 热榜抓取（用户触发）
contentforge topic scrape --platform bilibili --hot --limit 20

# 播客内容抓取
contentforge topic scrape --platform xiaoyuzhou --podcast-id "xxx"

# 查看待分析列表
contentforge topic list --status pending

# 手动录入文章
contentforge topic add --title "文章标题" --content "文章内容" --platform wechat

# 碎片库同步
contentforge learn --sync-feishu

# 碎片 decay 通知
contentforge learn --decay --notify-feishu
```

### 4.2 同步处理流程（一次请求，用户确认后全部完成）

```
1. 抓取内容（autocli/opencli）
         │
         ▼
2. AI 结构分析（Kimi）
   - 内容摘要
   - 爆款结构
   - 选题角度
   - 标签提取
         │
         ▼
3. 更新飞书表格（状态 → 已分析）
         │
         ▼
4. 询问用户："是否提取碎片入库？"
         │
         ├─ 否 → 保持已分析状态，流程结束
         │
         └─ 是
            │
            ▼
5. 碎片提取
   - 句式碎片（hook/transition/cta/power-line/数据开头）
   - 段落碎片（opening/argument/emotional-peak/closing/case-study）
         │
         ▼
6. 同步到碎片库
   - source = crawled
   - sourceRecordId = 飞书表格记录 ID
   - 更新碎片提取时间
         │
         ▼
7. 更新飞书表格状态 → 已入库
```

### 4.3 支持的平台

| 平台 | 命令 | 认证 |
|------|------|------|
| 微信公众号 | `weixin download` | Cookie |
| 知乎文章 | `zhihu download` | Cookie |
| B站视频 | `bilibili video/hot` | Cookie |
| 小红书 | `xiaohongshu note/user` | Cookie |
| Twitter/X | `twitter article/timeline` | Cookie |
| YouTube | `youtube video/transcript` | Cookie |
| 小宇宙播客 | `xiaoyuzhou podcast/episode` | Public |
| Reddit | `reddit hot/search` | Public |
| Medium | `medium feed/search` | Public |
| 36氪/虎扑/V2EX | 热榜命令 | Public |

---

## 5. 碎片库增强

### 5.1 来源扩展

```typescript
type FragmentSource = 'edited' | 'external' | 'crawled' | 'manual';
// edited: corpus/original/ 来源
// external: corpus/external/ 来源
// crawled: 飞书表格抓取来源
// manual: 飞书表格手动录入来源
```

### 5.2 碎片记录扩展

```typescript
interface SentenceFragment {
  id: string;
  type: 'hook' | 'transition' | 'cta' | 'power-line' | 'rhetorical-question' | 'data-opener';
  text: string;
  structure: string;
  source: FragmentSource;
  sourceFile: string;        // 保留兼容
  sourceRecordId?: string;    // 新增：飞书表格记录 ID（crawled/manual 来源）
  platform: 'wechat' | 'xiaohongshu' | 'douyin' | 'universal';
  tags: string[];
  // decay tracking
  lastUsedAt?: string;
  useCount: number;
  decayLevel: 'active' | 'dormant' | 'expired';
}
```

### 5.3 碎片注入优先级

生成时碎片注入优先级（高→低）：
1. `edited` — 用户改写产出，最符合个人风格
2. `crawled` — 竞品抓取，经过筛选
3. `manual` — 手动录入
4. `external` — 外部参考

**收藏来源加权**：收藏的文章提取的碎片，额外 +20% 权重

### 5.4 Decay 通知

```bash
# 碎片 decay 时，通知用户哪些飞书记录来源的碎片被降权
contentforge learn --decay --notify-feishu
```

输出示例：
```
⚠️  以下竞品的碎片已进入 dormant 状态：
  - [已入库] "如何大量记录自己" (抓取时间: 2026-03-15)
  - [已入库] "AI时代的职场生存指南" (抓取时间: 2026-04-01)

建议：
  - 重新抓取更新内容
  - 或从飞书表格移除这些记录
```

---

## 6. 与创作流程集成

### 6.1 选题灵感（Create Step 1）

```typescript
interface TopicAnalysisInput {
  keyword: string;
  includeCompetitorInsights?: boolean;  // 新增，默认 false
  competitorTags?: string[];             // 按标签筛选
  favoritesOnly?: boolean;                // 仅使用收藏的竞品
}
```

输出时额外展示：
- 与关键词相关的竞品爆款角度
- 收藏竞品的差异化建议
- "这些角度已被竞品使用，建议差异化切入"

### 6.2 碎片注入（Create Step 5 / Recreate Step 4）

```typescript
// content-generation.ts
const loader = getFragmentLoader(corpusDir);

// 优先使用 edited + crawled + 收藏来源的碎片
const sentences = loader.getSentenceFragments(undefined, platform, 8, keywords);
const paragraphs = loader.getParagraphFragments(undefined, platform, 3, keywords);
```

---

## 7. 文件结构

```
contentforge/
├── src/
│   ├── cli/commands/
│   │   └── topic.ts              # CLI 命令入口
│   └── scenarios/topic/
│       ├── scraper.ts             # 抓取逻辑（autocli/opencli）
│       ├── analyzer.ts            # AI 结构分析
│       ├── extractor.ts           # 碎片提取
│       ├── feishu-sync.ts         # 飞书表格同步
│       ├── decay-notifier.ts      # Decay 通知
│       └── types.ts               # 类型定义
├── data/
│   └── compliance/                # 已有
└── output/
    └── corpus/
        ├── fragment-library.json  # 碎片库
        ├── fragment-manifest.json
        ├── original/              # 用户改写文章
        └── external/             # 外部参考（手动放入）
```

---

## 8. 实现优先级

| 阶段 | 功能 | 说明 |
|------|------|------|
| **Phase 1** | 抓取 + AI 分析 + 写入飞书 | 核心链路打通 |
| **Phase 2** | 碎片提取 + 碎片库同步（用户确认） | 扩展素材来源 |
| **Phase 3** | 选题时读取飞书竞品数据 | 增强原创选题 |
| **Phase 4** | 风格学习基于抓取内容 | 完善风格画像 |
| **Phase 5** | Decay 通知功能 | 维护闭环 |

---

## 9. 技术要点

### 9.1 工具依赖

| 工具 | 用途 | 状态 |
|------|------|------|
| autocli | 高速抓取引擎（Rust） | ✅ 已安装 |
| opencli | 浏览器控制/备选 | ✅ 扩展已连接 |
| lark-cli | 飞书表格读写（用户身份） | ✅ 已授权 |

### 9.2 错误处理

| 场景 | 处理方式 |
|------|---------|
| 抓取失败 | 提示用户手动录入内容 |
| AI 分析失败 | 保留内容，状态保持待分析，可重试 |
| 碎片提取失败 | 提示用户，已分析状态不受影响 |
| 飞书写入失败 | 回滚碎片库，提示重试 |

### 9.3 幂等性

- 同一 URL 重复抓取 → 更新现有记录（根据链接去重）
- 碎片重复提取 → 基于 text hash 去重

---

## 10. 待确认

暂无。当前方案已完整。
