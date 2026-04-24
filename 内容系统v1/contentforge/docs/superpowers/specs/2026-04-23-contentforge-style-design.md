# contentforge-style 设计方案

> 日期：2026-04-23
> 状态：已批准

## 核心定位

风格画像 + 融合管理。让生成的内容带上特定风格的烙印，而不是千篇一律的AI味。

**触发场景：**
- "分析我的写作风格"
- "导入XX的风格"
- 生成前选风格

## 风格分类

```
风格库 output/styles/
├── personal/           # 我的风格（从 corpus/edited 自动分析）
├── external/          # 第三方风格（导入文章后命名）
└── blends/           # 融合风格（快照保存，含融合参数和源profile快照）
    ├── mark_70%+和菜头_30%.json
    └── mark_50%+另一种_50%.json
```

## Profile 数据结构

```json
{
  "name": "mark",
  "type": "personal",
  "dimensions": {
    "vocabularyWeights": {
      "高频词": ["你会发现", "真正让人", "很多人", "差别在于"],
      "避免词": ["首先", "其次", "由此可见", "综上所述"]
    },
    "emotionalTone": "前压后起，结尾留悬念",
    "structuralPreference": {
      "hook": "反问/反差式开头",
      "transition": "层层递进",
      "closing": "留互动问题，不给确定性答案"
    },
    "narrativeStyle": {
      "caseType": "职场/成长类，有细节",
      "logicVsEmotion": "感性60% / 逻辑40%",
      "dataUsage": "偶尔用，关键时刻用"
    }
  },
  "sourceArticles": ["corpus/edited/AI时代_如何保持竞争力.md", ...],
  "createdAt": "2026-04-23",
  "updatedAt": "2026-04-23",
  "articleTags": {
    "AI时代_如何保持竞争力.md": "representative",
    "cover_image_xxx.md": "deviant"
  }
}
```

## 分析个人风格

**触发：** `contentforge style analyze` 或说"分析我的风格"

**流程：**
1. TUI 列出 corpus/edited/ 里所有文章
2. 用户给每篇打标签：`r`=代表性(representative) / `d`=偏差(deviant) / 空格=一般（默认一般）
3. 系统分析全部文章，代表性文章权重更高，偏差文章排除
4. 生成 `personal/{username}.json`

**分析范围：**
- 默认分析全部 corpus/edited 文章
- 代表性文章权重 ×2，偏差文章不参与分析
- 每次 `learn` 或 `style analyze` 增量更新（不重写全量）

## 导入第三方风格

**触发：** `contentforge style import --name 和菜头 --from article.md`

**流程：**
1. 系统分析文章，提取风格特征
2. 用户命名（如"和菜头"）
3. 存为 `external/和菜头.json`

**限制：** 第三方风格不自动更新，只在显式 re-import 时刷新。

## 融合风格

**触发：** 生成前 TUI 选"融合风格"

**流程：**
1. TUI 选择源 profile（可多选）
2. 设置每个的比例（如 mark 70% + 和菜头 30%）
3. 系统计算融合参数，生成预览
4. 显示融合结果预览（主要特征描述）
5. 用户确认后保存到 `blends/{name}.json`

**快照机制：**
融合结果保存的是**融合参数的快照 + 当时各源profile的版本号**。
不是引用源profile，而是把源profile的内容内嵌进去。
这样每次融合结果可追溯，不受源profile后续变化影响。

## 生成时风格注入

**入口：** create/recreate 完成后，风格 TUI 选择（前期 C 方案）

**注入方式（组合）：**
- **system prompt**：定性的风格描述（"你是一个XX风格的作者"）
- **constraints**：词汇偏好、结构偏好（"避免XX词汇"）
- **examples**：从碎片库拉相关句式作为 few-shot（由 LLM 根据 profile 参数判断选哪些碎片）

**冲突仲裁：**
碎片和 profile 信号打架时，TUI 提示用户判断，不自动拍板。

## CLI 命令

| 命令 | 说明 |
|------|------|
| `contentforge style` | 进入风格 TUI（分析/导入/选风格） |
| `contentforge style list` | 列出所有 profile |
| `contentforge style analyze` | 分析个人风格 |
| `contentforge style import --name X --from article.md` | 导入第三方风格 |
| `contentforge style delete <name>` | 删除 profile |
| `contentforge style blend` | 进入融合流程 |

## 与碎片库的关系

- Profile 管"规则参数"，碎片库管"具体句式实例"
- 两者独立存储，通过 LLM 在生成时关联（不做预计算的映射表）
- 碎片选择由 LLM 根据 profile 参数判断，不再预存映射关系
- 冲突时 TUI 提示用户仲裁

## 后期能力（放待办）

1. **D方案**：生成时 prompt 里注入多个 profile，让 AI 自己判断融合比例
2. **映射管理**：碎片和 profile 的高维相关性管理（当前用 LLM 实时判断代替）
3. **生成结果与原文相似度控制**：核心待办，recreate 时对原文依赖过重可能导致相似

## 数据流

```
[corpus/edited] → analyze → [personal profile]
[external article] → import → [external profile]

[profile A + profile B + ratios] → blend → [blend snapshot]

[生成前 TUI 选择] → 注入 profile 参数 → [碎片库选 examples]
                                          ↓
                              [LLM 生成 + 冲突仲裁（如有）]
                                          ↓
                                    [最终内容]
```
