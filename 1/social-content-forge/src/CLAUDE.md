# Src 模块概览

Social Content Forge 的核心处理模块目录。

## 目录结构

```
src/
├── extractor/      # 内容提取（URL/搜索/素材）
├── analyzer/       # 内容理解（原子块+解码）
├── evaluator/     # 质量评估（六维度+诊断）
├── adapters/      # 平台适配器
│   ├── wechat/    # 微信公众号
│   ├── xiaohongshu/ # 小红书
│   └── twitter/   # Twitter/X
├── llm/           # LLM路由
└── db/            # SQLite操作
```

## 数据流

```
输入 → Extractor → Analyzer → Evaluator → [Adapter] → 输出
                ↓           ↓
           atoms.json   evaluation.json
                                        ↓
                                  Feishu Sync
```

## 平台适配器接口

每个适配器需实现：

```typescript
interface PlatformAdapter {
  name: string;           // 'wechat' | 'xiaohongshu' | 'twitter'
  targetLength: number;   // 目标字数

  /**
   * 将原子内容块适配为平台格式
   */
  adapt(atoms: ContentAtom[], context: ContentContext): Promise<AdaptedContent>;

  /**
   * 自检清单
   */
  checklist(content: AdaptedContent): CheckResult;
}
```

## LLM路由配置

```typescript
const LLM_ROUTING = {
  evaluation: 'claude',     // 质量评估
  wechat: 'claude',         // 微信公众号
  xiaohongshu: 'claude',    // 小红书
  twitter: 'deepseek',      // Twitter
  search: 'deepseek'        // 资料搜索
};
```

## SQLite 表结构

```sql
-- 内容表
CREATE TABLE content (
  id TEXT PRIMARY KEY,
  source_type TEXT,
  source_url TEXT,
  title TEXT,
  created_at TEXT,
  status TEXT,
  overall_score REAL
);

-- 原子块表
CREATE TABLE atoms (
  id TEXT PRIMARY KEY,
  content_id TEXT,
  type TEXT,
  content TEXT,
  viral_elements TEXT,
  created_at TEXT
);

-- 平台输出表
CREATE TABLE outputs (
  id TEXT PRIMARY KEY,
  content_id TEXT,
  platform TEXT,
  file_path TEXT,
  created_at TEXT
);
```
