# 内容改写工坊 - 开发进度记录

**最后更新**: 2026-03-30
**当前版本**: v2.3
**状态**: Bug修复 + UI交互体验优化（按钮反馈、再次优化功能）

---

## 📋 项目概述

**内容改写工坊 (Content Rewrite Workshop)** - 音视频转录爆款文案生成器

将音视频转录文本一键转化为适配公众号、小红书、抖音三平台的高传播度爆款文案。

### 已完成核心功能

| 模块 | 状态 | 说明 |
|------|------|------|
| 首页 | ✅ | 导航栏、功能展示、使用流程、CTA区域 |
| 内容编辑页 | ✅ | 文本输入、文件上传（TXT/MD/DOC/PDF）、字数统计 |
| 洞察分析页 | ✅ | Content DNA 提取、Markdown渲染 |
| 内容创作页 | ✅ | 快速模式/专业模式、标题选择、流式输出 |
| 优化报告页 | ✅ | 六维质检、雷达图、一键优化、导出 |
| 设置页面 | ✅ | AI供应商、平台模板、质检模板、优化模板（统一标签页） |
| 多LLM供应商 | ✅ | OpenAI/Claude/MiniMax/Kimi/DeepSeek/自定义/中转站 |
| 前置信息 | ✅ | 平台/类型/赛道/核心数据，持久化 |
| 数据管理 | ✅ | 导出/导入/清除 localStorage |

---

## ✅ 版本历史

### v2.3 (2026-03-30) - Bug修复 + 错误处理增强

**本次更新包含多个关键 Bug修复**

#### Bug修复

| 文件 | 问题 | 修复内容 |
|-----|------|---------|
| `src/services/promptRouter.ts` | 中文变量名无法匹配 | `/\w+/` → `/[^}]+/` |
| `prompts/quality/*.md` | 模板占位符未替换 | 末尾提示改为变量占位符 |
| `src/services/llm/llmService.ts` | AI返回JSON截断导致解析失败 | 新增 `repairTruncatedJSON()` |
| `src/components/OptimizationReportPage.tsx` | `dimensions.length` 报错 | 添加安全默认对象 + 可选链 |
| `src/components/ProModePanel.tsx` | 标题生成为空 | JSON失败时 fallback 到 raw 文本解析 |
| `src/components/ProModePanel.tsx` | 状态重置不完整 | 使用 `finally` 确保状态重置 |

**根因分析**:
1. `\w` 不匹配中文字符，导致模板变量 `{赛道}` 未被替换
2. AI 收到未替换的变量，误认为需要用户输入，返回错误格式
3. JSON 解析失败时没有 fallback，导致功能失效
4. `currentReport` 可能为空，直接访问属性报错

#### 经验文档

| 文件 | 说明 |
|-----|------|
| `docs/lessons-learned.md` | 新增，记录常见错误和设计规范 |

**开发前必读**: `docs/lessons-learned.md`

---

### v2.2 (2026-03-29) - Bug修复 + UI优化

**本次更新包含 Bug修复和 UI交互体验优化**

#### Bug修复

| 文件 | 问题 | 修复内容 |
|-----|------|---------|
| `src/services/promptRouter.ts` | `Template not found: douyin-content` | 路径 `../prompts` → `../../prompts` |
| `src/services/promptRouter.ts` | `Buffer is not defined` (gray-matter) | 替换为自定义 `parseFrontMatter()` |
| `src/stores/settingsStore.ts` | 前置信息页面跳转后丢失 | persist 配置添加 `preInfo` |
| `src/components/OptimizationReportPage.tsx` | CompareModal toast 不消失 | `setShowToast(true)` → `setShowToast(false)` |

**效果**:
- 模板文件能正确加载
- 包体积 785KB → 684KB
- 前置信息持久化正常

#### 功能增强

| 文件 | 功能 | 说明 |
|-----|------|-----|
| `src/components/OptimizationReportPage.tsx` | 再次优化 | 一键优化按钮变为"再次优化"，可基于当前内容重新优化 |
| `src/components/OptimizationReportPage.tsx` | 还原原始版本 | 新增按钮，恢复到最初的原始内容 |
| `src/components/ProModePanel.tsx` | 按钮交互优化 | 不可用时显示"请先选择平台和标题"，hover/active 动画反馈 |

**再次优化交互流程**:
1. 点击"一键优化" → 保存原始版本 → 生成优化版本 → 显示对比浮层
2. 选择"使用优化后" → 按钮变为"再次优化"，显示"还原原始版本"
3. 点击"再次优化" → 基于当前内容重新优化
4. 点击"还原原始版本" → 恢复到最初的原始内容

#### 测试模式优化支持

| 文件 | 修复内容 |
|-----|---------|
| `src/components/OptimizationReportPage.tsx` | 测试模式下使用模拟优化结果（1秒延迟），避免调用真实 AI |

---

### v2.1.1 (2026-03-28) - UI交互体验优化

**小幅优化，不影响现有功能**

#### 设计系统增强 (`src/index.css`)

**Design Tokens 规范化**:
- 新增 CSS 变量系统：`--space-*` 间距变量、`--font-*` 字体变量
- 统一过渡动画时长：`--transition-fast: 150ms`、`--transition-base: 200ms`、`--transition-slow: 300ms`

**按钮系统优化**:
- 统一 `focus:ring` 样式，增强键盘可访问性
- 优化 `btn-primary`/`btn-secondary`/`btn-ghost`/`btn-danger` 样式
- 增强 hover/focus/active 状态反馈

**表单组件优化**:
- 新增 `.input-sm` 小号输入框样式
- 统一 `focus:ring` 效果，颜色使用 `focus:ring-blue-500/30`
- label 增加 `font-medium` 强调

**动画系统增强**:
- 新增 `@keyframes slide-up` 动画
- 统一 `animate-fade-in`、`animate-scale-in` 过渡时长
- Toast 动画优化为 250ms

#### 组件样式优化

**App.tsx - 内容输入页**:
- 前置信息卡片：`p-5` → `p-6`，间距 `gap-4` → `gap-5`
- 表单 label 增加 `font-medium`
- 输入框 `py-2` → `py-2.5`，聚焦效果增强
- 核心数据 label `mb-1` → `mb-1.5`
- 底部工具栏高度 `h-12` → `h-14`，`px-4` → `px-5`
- 字数统计移至标题栏，更醒目
- 底部操作区按钮增加 `shadow-sm hover:shadow` 效果

**QuickModePanel.tsx - 快速模式**:
- 卡片按钮：`py-2` → `py-2.5`，增加 `hover:shadow-sm`
- 下载按钮增加图标间距 `gap-1.5`
- 等待生成文案优化："开始生成" → "等待生成"
- 重新生成按钮增加 RefreshCw 图标
- 预览弹窗底部按钮：`py-2` → `py-2.5`，`px-4` → `px-5`
- 关闭按钮增加 hover/shadow 效果
- 下载按钮增加 `disabled:text-slate-500` 样式
- 一键优化按钮：`mt-4` → `mt-5`

**ProModePanel.tsx - 专业模式**:
- 生成控制区：`p-4` → `p-5`，增加 `border border-slate-100`
- label 增加 `font-medium`
- 输入框聚焦效果增强
- 生成按钮：`py-2` → `py-2.5`，增加 `disabled:text-slate-500`
- 标题编辑输入框增加 `bg-white` 背景
- 确认/取消按钮增加 `transition-colors`

---

### v2.1 (2026-03-27) - 流式输出 + UI优化

**Git提交**: `4a804c6`

#### 流式输出功能

| 文件 | 改动 |
|-----|------|
| `src/services/llm/types.ts` | 新增 StreamingChunk, StreamError, StreamCallback 类型 |
| `src/services/llm/adapters.ts` | 所有适配器新增 `chatStream()` 方法 (fetch + SSE) |
| `src/services/llm/manager.ts` | 新增 `chatStream()` 方法 |
| `src/services/llm/llmService.ts` | 新增 `callAIWithStreaming()`, `generateStreamingPlatformContent()` |
| `src/components/QuickModePanel.tsx` | 集成流式内容生成和显示 |
| `src/components/ProModePanel.tsx` | 集成流式内容生成 |

**核心功能**:
- 真流式输出（打字机效果）
- 流式失败自动降级到非流式模式
- 快速失败策略（失败立即切换供应商）

#### UI优化 (Plan A + Plan B)

**Plan A - 增量优化（已完成）**:
- 统一进度条组件 `ProgressBar` + `PlatformProgressBar`
- 骨架屏组件 `SkeletonCard`（脉冲占位动画）
- Design Tokens (`src/index.css`)：按钮、进度条、卡片、输入框样式
- Tab切换动画增强
- 空状态设计、Toast通知样式

**Plan B - 可选主题（已完成）**:
- `ThemeB.ts` - 靛蓝主色调配色系统
- `ThemeContext.tsx` - 主题切换 Provider
- `PageTransition.tsx` - fade/slide/card 三种页面转场动画
- 响应式布局（移动端/平板端适配）

**相关文件**:
- `src/components/ui/ProgressBar.tsx`, `SkeletonCard.tsx`, `PageTransition.tsx`
- `src/theme/ThemeB.ts`, `ThemeContext.tsx`
- `src/components/SettingsPage.tsx` - 主题切换器UI

---

### v2.0 (2026-03-27) - 内容创作分析要素展示

| 文件 | 改动 |
|-----|------|
| `src/services/llm/llmService.ts` | context 类型扩展，传入完整分析数据 |
| `src/components/ProModePanel.tsx` | 导入公式配置 + 气泡展示 + 进度条 |
| `src/components/QuickModePanel.tsx` | 版本历史支持（types扩展） |
| `src/data/titleFormulas.ts` | 新增（各平台公式详情） |
| `src/data/*ContentPrompt.ts` | 新增变量占位 {contentStructure}/{valuePoints}/{highlightClips} |

**核心功能**:
- 内容创作页右侧卡片改为"本次生成将使用以下分析要素"
- 展示：核心议题、情绪基调、目标受众、开篇钩子、高光片段
- 标题公式气泡悬停显示详情
- ProModePanel 底部平台独立进度条
- QuickModePanel 版本历史管理

---

### v1.8 (2026-03-25) - 模板导入功能

| 文件 | 改动 |
|-----|------|
| `src/data/` | 新增目录存储模板提示词 |
| `src/stores/settingsStore.ts` | 更新内置平台使用导入提示词 |

**核心功能**:
- 标题提示词与正文提示词分离
- 内置模板使用导入的完整提示词内容
- 模板导入脚本: `import-templates-from-folder.cjs`, `export-prompts-to-files.cjs`

---

### v1.7.2 (2026-03-25) - 质检报告字段与提示词一致

| 文件 | 改动 |
|-----|------|
| `src/services/llm/types.ts` | 新增 GzhQualityDimensions, XhsQualityDimensions, DouyinQualityDimensions |
| `src/stores/settingsStore.ts` | 质检提示词按平台更新 |
| `src/services/llm/llmService.ts` | 解析函数按平台分发调度 |
| `src/components/OptimizationReportPage.tsx` | 雷达图动态渲染，Checklist支持pass/warning/fail |

**质检维度**:
- 公众号(5维): 标题/摘要传播性、人群精准度、社交货币属性、内容密度、留存引导设计
- 小红书(5维): 标题/首图钩子、人群精准度、可收藏价值密度、SEO关键词布局、互动/传播设计
- 抖音(5维): 3秒钩子有效性、15秒爆点达标率、节奏密度、互动/关键词设计、转发引导设计

---

### v1.7.1 (2026-03-25) - 快速模式优化升级

| 文件 | 改动 |
|-----|------|
| `src/components/QuickModePanel.tsx` | 预览弹窗重设计（左右对比）、流程说明文案 |
| `src/services/llm/llmService.ts` | 新增 `quickOptimizeContent()` 函数 |
| `src/App.tsx` | 按钮文案统一 |

**核心功能**:
- 预览弹窗：原版/优化版左右对比布局
- 一键优化（无需质检）
- 下载按钮根据选择动态变化
- 快速模式版本历史

---

### v1.6 (2026-03-20) - 前置信息完整集成

**核心功能**:
- 模板提示词使用前置信息变量 {platform}, {content_type}, {track}, {likes} 等
- 快速模式/专业模式支持前置信息传递
- 前置信息持久化到 localStorage

---

### v1.5 (2026-03-19) - AI调用逻辑全面重构

**核心功能**:
- 洞察分析页使用模板提示词
- 快速模式合并调用（标题+正文一次调用）
- 专业模式拆分为两次调用
- 一键优化使用优化报告模板
- ZIP导出功能

---

### v1.4 (2026-03-19) - 专业模式标题生成改版

**核心功能**:
- 默认选中公众号
- 标题生成改为人工触发（填数量→点按钮）
- 标题展示竖三列布局，动态列宽

---

### v1.3 (2026-03-19) - 快速/专业模式代码隔离

| 文件 | 改动 |
|-----|------|
| `src/components/QuickModePanel.tsx` | 新建（快速模式完整组件） |
| `src/components/ProModePanel.tsx` | 新建（专业模式完整组件） |
| `src/App.tsx` | 精简，移除约500行代码 |

---

### v1.2 (2026-03-19) - InsightPage Markdown渲染

**核心功能**:
- 使用 `react-markdown` 渲染 Markdown
- 使用 `@tailwindcss/typography` 美化样式
- 移除6个独立卡片模块，改为统一渲染 AI 返回的 `rawContent`

---

### v1.1 (2026-03-18) - InsightPage新布局

**核心功能**:
- 统一大模块框架
- 内容结构化呈现
- 移除目录导航

---

### v1.0 (2026-03-13) - 基础版完成

**完成内容**:
- 首页、内容编辑、洞察分析、内容创作（快速/专业模式）、优化报告页全流程

---

## 📌 待办清单

### ⏳ 待讨论

| 序号 | 任务 | 优先级 | 备注 |
|-----|------|-------|------|
| C | UI交互体验优化 | 进行中 | v2.2 已完成部分优化，待进一步讨论 |

### 📋 已完成

| 序号 | 任务 | 完成日期 |
|-----|------|---------|
| A | 质检准确性优化 | 2026-03-26 |
| B | 内容生成质量优化 | 2026-03-26 |
| E | 模板格式规范化设计 | 2026-03-26 |
| E1 | 实施模板格式规范化 | 2026-03-26 |
| F | 质检报告UI展示优化 | 2026-03-26 |
| G | 内容生成流程交互优化 | 2026-03-26 |
| H | LLM调用逻辑修复 + 提示词字数检测与智能精简 | 2026-03-26 |
| D | 流式输出功能 | 2026-03-27 |
| C1 | UI交互体验优化 - 按钮反馈 | 2026-03-29 |
| C2 | 优化报告再次优化功能 | 2026-03-29 |

---

## 🔧 技术架构要点

### 状态管理

```
settingsStore (Zustand)
├── ai: AI供应商配置, failover设置
├── platforms: 平台列表, 模板
├── analysis: 分析模板
├── optimization: 优化模板
├── preInfo: 前置信息
└── testMode: 测试模式
```

### LLM服务调用

```
llmService.ts
├── parseContent (洞察分析) → heavy model
├── generatePlatformContent (内容生成)
│   ├── 标题生成 → light model
│   └── 正文生成 → heavy model
├── analyzeContentQuality (六维质检) → heavy model
├── optimizeContent (优化重构) → heavy model
└── quickOptimizeContent (快速优化) → heavy model
```

### 组件结构

```
src/components/
├── App.tsx              # 主应用
├── HomePage.tsx         # 首页
├── InsightPage.tsx      # 洞察分析
├── QuickModePanel.tsx   # 快速模式
├── ProModePanel.tsx     # 专业模式
├── OptimizationReportPage.tsx  # 优化报告
├── SettingsPage.tsx     # 设置页面
├── TemplateList.tsx     # 通用模板列表（支持分组模式）
├── PlatformSelector.tsx # 统一平台标签页选择器
└── ui/                 # UI组件
```

---

## 📎 回滚节点记录

### 节点 #1 - v2.1 流式输出功能

**提交**: `00b1127`

```bash
cd content-rewrite-workshop
git checkout 00b1127 -- .
```

### 节点 #2 - v1.8 模板导入

```bash
cd content-rewrite-workshop
git checkout HEAD -- src/data/
git checkout HEAD -- src/stores/settingsStore.ts
```

---

*此文档为项目唯一进度记录来源，后续更新只在此文件中记录*
