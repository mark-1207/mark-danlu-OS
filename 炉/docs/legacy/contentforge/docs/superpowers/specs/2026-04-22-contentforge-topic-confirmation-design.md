# ContentForge 原创选题流程 — 全链路透明确认设计

## 背景与目标

当前 `create` 命令的 topic-analysis + topic-assignment 是纯自动执行的 LLM 调用，用户只能看到最终生成的文件，无法介入选题方向。本设计引入交互式 TUI 确认点，让用户在关键决策节点介入，同时为未来外部选题 Skill 的接入预留扩展空间。

**核心目标：**
1. CLI 全链路可见，AI 选题过程透明
2. 用户在两个关键节点有确认/修改权限
3. 不破坏现有自动化 pipeline，只在 pipeline 前后增加交互层
4. 外部选题 Skill 可通过注入模式接入，不影响核心决策逻辑

---

## 整体流程

```
关键词
   │
   ▼
┌─────────────────────────────┐
│  Step 1: 主题分析确认       │  ← TUI 交互，用户选重点、排除方向
│  (topic-analysis + review) │
└─────────────────────────────┘
   │ context.set('topic-analysis-confirmed', { selections, overrides })
   ▼
┌─────────────────────────────┐
│  Step 2: 平台选题分配确认    │  ← TUI 交互，用户为每平台选标题
│  (topic-assignment + review) │
└─────────────────────────────┘
   │ context.set('topic-assignment-confirmed', { wechat: titleIndex, ... })
   ▼
   [自动化 Pipeline 继续]
   大纲生成 → 素材搜索 → 正文生成 → 审校优化
```

---

## Step 1: 主题分析确认

### 输入

- 原始 `keyword`
- 用户 `userContext`（可选）
- `excludeDirections`（用户在 TUI 中标记排除的方向）

### AI 行为

执行完整的 topic-analysis LLM 调用，输出 JSON：

```typescript
interface TopicAnalysis {
  keyword: string;
  subTopics: Array<{ name: string; description: string; heatLevel: 'high' | 'medium' | 'low' }>;
  painPoints: Array<{ description: string; targetAudience: string; emotionalTrigger: string }>;
  trendingAngles: Array<{ angle: string; whyTrending: string; suitablePlatforms: string[] }>;
  controversies: Array<{ topic: string; sideA: string; sideB: string }>;
  targetDemographics: Array<{ group: string; interests: string[]; contentPreferences: string[] }>;
}
```

### TUI 展示策略

**AI 预判机制**：每组内容附带 `decision` 标记：

- `confirmed` — AI 判断方向明确，直接展示为 ✓ 不可取消，用户按 [回车] 跳过
- `pending` — 需要用户决策，展示为 ○/? 可选择
- `rejected` — AI 判断该方向不适合，隐藏不展示

### TUI 界面布局

```
╔══════════════════════════════════════════════════════════════╗
║           🔍 主题深挖 — AI时代如何保持竞争力                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  热度子话题 (高热项已标记)                             [4/12] ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │ ● [1] AI替代哪些职业，未来10年最危险           [HIGH]  │  ║
║  │ ● [2] 人机协作 vs 被AI替代，普通人怎么做       [HIGH]  │  ║
║  │ ○ [3] AI工具盘点，最值得学习的AI技能            [HIGH]  │  ║
║  │ ○ [4] Prompt优化师等新职业机会                    [MED]  │  ║
║  └─────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  争议话题 (AI不确定方向)                              [2/4]  ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │ ? [1] "AI会取代人类"——正: 必然趋势 vs 反: 恐慌过度  │  ║
║  │ ? [2] "程序员会被AI取代"——正: 门槛降低 vs 反: .. │  ║
║  └─────────────────────────────────────────────────────────┘  ║
║                                                              ║
║  热门角度                                              [✓]  ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │ ✓ "35岁互联网人失业焦虑" — 正在流行，适合小红书   │  ║
║  └─────────────────────────────────────────────────────────┘  ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  [空格] 选中/取消   [↑↓] 上下移动   [r] 重写此组   [回车] 继续 ║
╚══════════════════════════════════════════════════════════════╝
```

### 操作规则

| 按键 | 行为 |
|------|------|
| `空格` | 选中/取消当前项 |
| `↑↓` | 上下移动焦点 |
| `r` | 原地重写该组（传入 `excludeDirections` + 选中项，重新调用 LLM） |
| `回车` | 确认，进入下一步（`?` 和 `○` 项中未选中的被记入 `excludeDirections`） |

### 输出

```typescript
interface TopicAnalysisConfirmed {
  // AI 原始分析结果（用于后续 topic-assignment）
  topicAnalysis: TopicAnalysis;
  // 用户选中的子话题索引
  selectedSubTopicIndices: number[];
  // 用户排除的方向（来自未选中的 pending 项）
  excludeDirections: string[];
  // 用户可能手动输入的额外方向
  extraDirections?: string[];
}
```

写入 `context.set('topic-analysis-confirmed', confirmed)`

---

## Step 2: 平台选题分配确认

### 输入

- `TopicAnalysisConfirmed`（Step 1 的输出）
- 三个平台的策略文件（wechat.md / xiaohongshu.md / douyin.md）

### AI 行为

执行 topic-assignment LLM 调用，输入中包含 `topicAnalysisConfirmed.excludeDirections` 和 `selectedSubTopicIndices`，让 AI 在已筛选的方向范围内重新分配。

### TUI 界面布局

```
╔══════════════════════════════════════════════════════════════╗
║           📋 平台选题分配                                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  公众号                                      当前选中[1]      ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ ● [1] 《35岁互联网人，被AI加速淘汰的这一年》         │ ║
║  │ ○ [2] 《AI时代：不是AI取代你，是会用AI的人取代你》     │ ║
║  │ ○ [3] 《人机协作时代，普通人弯道超车的3种方式》       │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║  切入角度: 从"35岁失业焦虑"角度切入，深度分析文           ║
║                                                              ║
║  小红书                                      当前选中[2]      ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ ○ [1] 【职场危机】35岁互联网人亲述AI取代经历          │ ║
║  │ ● [2] 【吐血整理】普通人必须收藏的AI工具合集🚨       │ ║
║  │ ○ [3] 【避坑指南】被AI取代的职业TOP10，第一名绝了     │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║  切入角度: "AI工具实用向"，强共鸣 + 收藏价值             ║
║                                                              ║
║  抖音                                          当前选中[1]    ║
║  ┌─────────────────────────────────────────────────────────┐ ║
║  │ ● [1] 【爆笑合集】AI时代打工人生存实录                │ ║
║  │ ○ [2] 【深度】我用AI一个月赚了10万，做对了3件事       │ ║
║  │ ○ [3] 【干货】AI时代内容创作者必备5大工具            │ ║
║  └─────────────────────────────────────────────────────────┘ ║
║  切入角度: "情绪共鸣向"，共情打工人引发转发             ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║  [←→] 切换平台   [1-3] 选标题   [r] 重写该平台   [e] 编辑角度 ║
╚══════════════════════════════════════════════════════════════╝
```

### 操作规则

| 按键 | 行为 |
|------|------|
| `←→` | 切换平台 |
| `1-3` | 直接选中该编号标题 |
| `r` | 原地重写当前平台的标题候选（重新调用 LLM，只生成该平台3个标题）；**其他已确认平台不受影响** |
| `e` | 编辑当前平台的切入角度描述（打开单行输入） |
| `回车` | 确认所有选择，进入自动化 Pipeline |

**`r` 重写行为补充：** 当用户在平台 A 按 `r` 重新生成标题时，平台 B/C 的已确认选择（标题索引、angleOverride）保持不变。重写完成后焦点停留在平台 A，用户可继续调整后按 `←→` 切走。

### 输出

```typescript
interface TopicAssignmentConfirmed {
  topicAssignment: PlatformAssignments; // AI 原始分配结果
  selections: {
    wechat: { titleIndex: number; title: string; angleOverride?: string };
    xiaohongshu: { titleIndex: number; title: string; angleOverride?: string };
    douyin: { titleIndex: number; title: string; angleOverride?: string };
  };
}
```

写入 `context.set('topic-assignment-confirmed', confirmed)`

---

## 自动化 Pipeline（改动最小化）

现有 pipeline 不修改。Step 1 和 Step 2 改为 CLI 交互命令：

```
runCreateInteractive(keyword, options)
  ├── Step 1 (TUI): topic-analysis + confirmation
  ├── context.set('topic-analysis-confirmed', ...)
  ├── Step 2 (TUI): topic-assignment + confirmation
  ├── context.set('topic-assignment-confirmed', ...)
  └── 继续执行原有 pipeline（读取 context 中的 confirmed 数据）
```

**关键：topic-assignment 需要修改** —— 当前它只接收 `keyword`，不读取 context 中的确认结果。修改后，它读取 `topic-analysis-confirmed`，把用户选中的方向和排除的方向作为约束传入 LLM prompt。

### Topic Assignment Prompt 修改

新增两个输入变量：

```handlebars
{{#if excludeDirections}}
请排除以下方向：{{excludeDirections}}
{{/if}}

{{#if selectedSubTopicFocus}}
重点聚焦以下子话题：{{selectedSubTopicFocus}}
{{/if}}
```

---

## `--no-interactive` 模式（重要：现有自动化兼容性）

**`create` 默认行为变更为需要交互确认**。这意味着现有 CI/自动化脚本会受影响，需要显式添加 `--no-interactive` 保持原有行为：

```bash
# 现有自动化脚本不受影响（需添加 --no-interactive）
node dist/index.js create --keyword "AI时代" --no-interactive

# 新用户交互式体验（默认）
node dist/index.js create --keyword "AI时代"
```

**CI/迁移清单：**
- 所有调用 `create` 命令的自动化脚本需加上 `--no-interactive` flag
- 文档中 `create` 命令示例需同步更新

新增 CLI flag `--no-interactive`：

```bash
node dist/index.js create --keyword "AI时代" --no-interactive
```

行为：
- 完全跳过 Step 1 和 Step 2 的 TUI
- 直接执行原有自动化 pipeline
- 等同于当前的 `create` 行为

**默认行为变更为需要交互确认**。

---

## 非交互模式下的降级策略

如果 TUI 检测到非 TTY 环境（piping / 重定向），自动降级为 `--no-interactive` 模式并打印警告：

```
警告: 检测到非 TTY 环境，自动切换为全自动模式（--no-interactive）
如需选题确认，请直接运行命令。
```

---

## 实现文件变更

| 文件 | 变更 |
|------|------|
| `src/cli/commands/create.ts` | 改为调用交互流程，`--no-interactive` flag |
| `src/cli/ui/topic-review.ts` | 新增 TUI 组件（Step 1 和 Step 2 复用同一组件，参数化） |
| `src/cli/ui/spinner.ts` | 复用现有 |
| `src/scenarios/create/steps/topic-analysis.ts` | 无变更 |
| `src/scenarios/create/steps/topic-assignment.ts` | 新增读取 `topic-analysis-confirmed` from context 的逻辑 |
| `src/prompts/templates/create/topic-assignment.user.md` | 新增 `excludeDirections` 和 `selectedSubTopicFocus` 变量 |

---

## 外部选题 Skill 扩展点

外部 Skill（如热点挖掘、新媒体选题库）通过"注入模式"接入：

```
外部 Skill → 写入 topic-analysis 格式的 JSON → CLI 读取 → TUI 确认 → Pipeline 继续
```

具体扩展方式留待后续设计，核心数据接口为 `TopicAnalysisConfirmed` JSON。

---

## 后续步骤

1. 实现 Step 1 TUI 组件
2. 修改 topic-assignment 支持约束输入
3. 实现 Step 2 TUI 组件
4. 集成到 create 命令
5. 添加 `--no-interactive` flag
6. 端到端测试
