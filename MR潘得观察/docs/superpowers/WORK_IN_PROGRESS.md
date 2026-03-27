# 内容改写工坊 - 开发进度记录

**最后更新**: 2026-03-27
**状态**: D 流式输出已完成，待讨论 C

---

## 📋 整体待办清单

### ✅ 已完成

| 序号 | 任务 | 状态 | 完成日期 |
|-----|------|------|---------|
| A | 质检准确性优化 | ✅ 完成 | 2026-03-26 |
| B | 内容生成质量优化 | ✅ 完成 | 2026-03-26 |
| E | 模板格式规范化设计 | ✅ 完成 | 2026-03-26 |
| E1 | 实施模板格式规范化 | ✅ 完成 | 2026-03-26 |
| F | 质检报告UI展示优化 | ✅ 完成 | 2026-03-26 |
| H | LLM调用逻辑修复 + 提示词字数检测与智能精简 | ✅ 完成 | 2026-03-26 |
| G | 内容生成流程交互优化 | ✅ 完成 | 2026-03-26 |
| **D** | **生成稳定性优化 - 流式输出** | ✅ **完成** | **2026-03-27** |

### ⏳ 待讨论

| 序号 | 任务 | 优先级 | 备注 |
|-----|------|-------|------|
| C | UI交互体验优化 | 待定 | 整体体验优化 |

---

## 📌 已完成任务详情

### A) 质检准确性优化 ✅

**完成日期**: 2026-03-26

**改动文件**:
- `src/data/gzhQualityPrompt.ts`
- `src/data/xhsQualityPrompt.ts`
- `src/data/douyinQualityPrompt.ts`

**解决的核心问题**:
| 问题 | 原因 | 解决方案 |
|-----|------|---------|
| A3 维度定义模糊 | 判定标准只有文字描述，无标杆示例 | 每个维度添加正反例标杆 |
| A1 误判严重 | AI无法精准执行抽象标准 | 评分必须引用原文片段 |
| A4 优化建议不实用 | 输出冗长，缺乏可操作性 | 优化建议改为原文→改后对照表 |
| A2 评分不稳定 | 提示词复杂，AI注意力分散 | 精简输出结构 |

---

### B) 内容生成质量优化 ✅

**完成日期**: 2026-03-26

**改动文件**:
- `src/data/gzhContentPrompt.ts`
- `src/data/xhsContentPrompt.ts`
- `src/data/douyinContentPrompt.ts`

**平台改动摘要**:
| 平台 | 标题公式精简 | 正文精简 | 新增禁止事项 |
|-----|------------|---------|------------|
| 公众号 | 8个→5个 | 590行→170行 | ✅ |
| 小红书 | 6个→5个 | 545行→195行 | ✅ |
| 抖音 | 10个→5个 | 727行→176行 | ✅ |

---

### E) 模板格式规范化设计 ✅

**完成日期**: 2026-03-26

**设计文档**: `docs/superpowers/specs/2026-03-26-template-format-spec-design.md`

---

## ⏳ 进行中任务详情

### E1) 实施模板格式规范化 ✅

**完成日期**: 2026-03-26

**实施文档**: `docs/superpowers/specs/2026-03-26-template-format-integration.md`

**完成改动**:

| 文件 | 操作 | 说明 |
|-----|------|------|
| `src/components/CompareModal.tsx` | 新增 | 格式化对比弹窗 |
| `src/services/autoFormatService.ts` | 新增 | 格式化服务封装 |
| `src/services/validator/TemplateValidator.ts` | 修改 | 简化为只保留 validateTemplate |
| `src/services/validator/index.ts` | 修改 | 简化导出 |
| `src/components/SettingsPage.tsx` | 重构 | 区分内置/自定义模板 |

**核心功能**:
- 内置模板只读展示（查看按钮）
- 自定义模板可编辑（编辑按钮）
- 保存时自动格式化 + 对比弹窗
- 对比弹窗支持：确认格式化 / 使用原版 / 取消

### F) 质检报告UI展示优化 ✅

**完成日期**: 2026-03-26

**设计文档**: `docs/superpowers/specs/2026-03-26-quality-report-ui-redesign.md`

**完成改动**:

| 文件 | 操作 | 说明 |
|-----|------|------|
| `src/types/quality.ts` | 新增 | 动态类型定义 |
| `src/components/QualityReport/*.tsx` | 新增 | 8个新组件 |
| `src/services/llm/llmService.ts` | 修改 | 动态维度解析 |
| `src/components/OptimizationReportPage.tsx` | 修改 | 使用新组件，移除雷达图 |

**核心功能**:
- 维度动态渲染（无论模板返回什么都能展示）
- 移除雷达图，使用条形维度列表
- Checklist 支持 evidence 显示（点击定位待实现）
- 优化建议支持展开/收起 + original/optimized 对照
- 整体评分为独立组件

### G) 内容生成流程交互优化 ✅

**完成日期**: 2026-03-26

**改动文件**:

| 文件 | 操作 | 说明 |
|-----|------|------|
| `src/services/llm/llmService.ts` | 修改 | context 类型扩展，传入完整分析数据 |
| `src/components/ProModePanel.tsx` | 修改 | 导入公式配置 + 气泡展示 + 进度条 |
| `src/components/QuickModePanel.tsx` | 修改 | 版本历史支持（types扩展） |
| `src/components/App.tsx` | 修改 | 分析要素卡片重设计 |
| `src/data/titleFormulas.ts` | 新增 | 公式配置数据（各平台公式详情） |
| `src/data/gzhContentPrompt.ts` | 修改 | 新变量占位 {contentStructure}/{valuePoints}/{highlightClips} |
| `src/data/xhsContentPrompt.ts` | 修改 | 新变量占位 |
| `src/data/douyinContentPrompt.ts` | 修改 | 新变量占位 |

**核心功能**:

#### 1. 分析结果完整传入生成函数
- 新增 context 字段：`contentStructure`、`valuePoints`、`highlightClips`、`goldSentences`、`interactiveHook`
- `parseMarkdownResult` 解析的结构化数据（_rawJson）正确传入
- 提示词模板新增变量占位，AI 生成时使用完整分析上下文

#### 2. 内容创作页分析要素展示
- 原"AI洞察卡片"改为"本次生成将使用以下分析要素"
- 展示：核心议题、情绪基调、目标受众、开篇钩子、高光片段
- 视觉设计：渐变绿色背景，emerald 色系

#### 3. 标题公式气泡展示
- 悬停标题类型标签显示公式详情
- 详情包含：公式名称、结构、描述、示例、适用范围
- 支持公众号8公式、小红书6公式、抖音10公式

#### 4. 生成进度可视化
- ProModePanel 底部添加平台独立进度条
- 生成时显示加载动画和文字提示

#### 5. 快速模式版本管理
- PlatformResult 类型扩展支持 `versions[]` 和 `currentVersionId`
- 重新生成时创建新版本，保留历史版本

---

### H) LLM调用逻辑修复 + 提示词字数检测与智能精简 ✅

---

### H) LLM调用逻辑修复 + 提示词字数检测与智能精简 ✅

**完成日期**: 2026-03-26

**改动文件**:

| 文件 | 操作 | 说明 |
|-----|------|------|
| `src/services/llm/manager.ts` | 修改 | 修复重试逻辑Bug + 429指数退避 |
| `src/services/llm/adapters.ts` | 修改 | 添加timeout + 修复Anthropic baseUrl |
| `src/services/promptLengthChecker.ts` | 新增 | 提示词字数检测服务 |
| `src/services/templateFormatter.ts` | 修改 | 添加智能精简功能 |
| `src/components/CompareModal.tsx` | 修改 | 支持精简对比模式 |
| `src/components/SettingsPage.tsx` | 修改 | 集成字数检测和精简功能 |
| `src/components/QualityReport/*.tsx` | 修改 | 修复类型导入路径 |
| `src/services/llm/llmService.ts` | 修改 | 修复测试数据类型错误 |

**核心功能**:

#### 1. LLM 调用逻辑修复
- **重试逻辑 Bug 修复**: 修复 break 位置错误，可重试错误继续重试，不可重试才切换供应商
- **429 指数退避**: 429 错误携带 retryAfterMs，避免立即重试加剧 rate limit
- **axios 超时配置**: 所有适配器添加 `timeout: 120000`（2分钟）
- **Anthropic baseUrl**: 修复硬编码，支持中转站配置

#### 2. 提示词字数检测
- **字数限制标准**:
  - titlePrompt: 1500 字
  - contentPrompt: 3000 字
  - qualityPrompt: 2500 字
- **风险等级**: safe (≤80%) / warning (80%-100%) / high (>100%)
- **超限警告**: 提示可能导致的 429、耗时增加等问题

#### 3. 智能精简功能
- **触发条件**: 提示词超限时
- **精简策略**: 移除重复解释、简化过长示例、清理冗余格式
- **对比弹窗**: 显示原版/格式化版/精简版三列对比
- **高亮显示**: 被删除内容高亮标注，用户决策是否接受精简

---

## ⏳ 待讨论任务

### D) 生成稳定性优化 - 流式输出 ✅

**完成日期**: 2026-03-27
**版本**: v2.1

**设计文档**: `docs/superpowers/specs/2026-03-27-streaming-output-design.md`

**改动文件**:

| 文件 | 操作 | 说明 |
|-----|------|------|
| `src/services/llm/types.ts` | 修改 | 新增 StreamingChunk, StreamError, StreamCallback 类型 |
| `src/services/llm/adapters.ts` | 修改 | 所有适配器新增 chatStream() 方法 |
| `src/services/llm/manager.ts` | 修改 | 新增 chatStream() 方法 |
| `src/services/llm/llmService.ts` | 修改 | 新增 callAIWithStreaming(), generateStreamingPlatformContent() |
| `src/components/QuickModePanel.tsx` | 修改 | 集成流式内容生成和显示 |
| `src/components/ProModePanel.tsx` | 修改 | 集成流式内容生成 |

**核心功能**:

#### 1. 真流式输出
- 使用 fetch API 接收 SSE 流式响应
- 内容逐字实时显示（打字机效果）
- 各适配器独立实现（OpenAI、Kimi、DeepSeek 等 OpenAI 兼容格式 + Anthropic 事件格式）

#### 2. 自动降级
- 流式调用失败时自动切换到非流式模式
- 降级时批量回调（50字符/批，20ms延迟）
- 用户无感知

#### 3. 供应商快速切换
- 失败立即切换到下一个供应商（快速失败策略）
- 不在当前供应商重试

#### 4. UI 集成
- QuickModePanel 预览弹窗优先显示流式内容
- ProModePanel 内容生成使用流式

**Git 提交**:
- `00b1127` - feat: 实现流式输出功能
- `3868061` - docs: 更新项目进度记录 - 添加v2.1流式输出功能

**回滚方法**:
```bash
cd content-rewrite-workshop
git checkout 00b1127 -- .
```

---

### C) UI交互体验优化

**用户原话**: "四个依次进行"（A→B→C→D）

**待确认优先级**:
- C1) 质检报告页面的展示优化
- C2) 内容生成流程的交互优化
- C3) 其他UI问题

---

### D) 生成稳定性优化

**用户原话**: "四个依次进行"（A→B→C→D）

**待确认方向**:
- 减少同一内容多次生成的结果差异
- 可能方案：温度参数控制、多次采样取优、添加稳定性约束等

---

## 🔧 git 提交记录

| 提交 | 内容 |
|-----|------|
| `a7d7a38` | fix: 修复项目断裂问题 |
| `a1d0b44` | docs: 重组待办清单结构 |
| `fae72d6` | feat: 实施模板格式规范化 - 基础建设 |
| `45d8c48` | docs: 添加模板格式规范化设计文档 |
| `3ff2522` | feat: 质检准确性优化 - 重构提示词和解析器 |
| `6b0d3bb` | feat: 内容生成质量优化 - 精简三平台提示词 |
| `ddf103f` | docs: 更新工作进度记录 |
| `9b1462d` | docs: 添加质检准确性优化设计文档 |

---

## 📎 项目背景

**当前版本**: v2.1
**最后更新**: 2026-03-27

### 已完成核心功能
- 首页、内容编辑、洞察分析、内容创作（快速/专业模式）
- 多LLM供应商支持（OpenAI/Claude/MiniMax/Kimi/DeepSeek/自定义）
- 分平台模板配置（公众号/小红书/抖音）
- 前置信息模块（平台/类型/赛道/核心数据）
- 六维质检系统（通过平台模板的 qualityPrompt 配置）
- 数据管理（导出/导入/清除）
- 快速模式预览弹窗优化
- 模板导入功能

### 当前状态
- ✅ 项目可正常运行（`npm run dev`）
- ✅ LLM 调用逻辑已修复（重试、429、超时）
- ✅ 提示词字数检测和智能精简功能已完成
- ✅ 内容创作页分析要素展示已完成
- ✅ **流式输出功能已完成**（v2.1）
- ✅ 构建通过（`npm run build` 成功）
- ⏳ 进行中：C)UI交互体验优化（Plan A + Plan B 双轨方案）

---

## 📝 UI交互体验优化讨论记录 (2026-03-27)

### 用户需求确认

**页面范围**：全部页面（内容创作页、优化报告页、设置页面）

**痛点**：
- ✅ 加载/等待体验
- ✅ 内容展示可读性
- ✅ 操作便捷性
- ✅ 视觉一致性

**核心目标**：专业感 + 易用性 + 愉悦感 三者平衡

### 确认方案：Plan A + Plan B 双轨

```
当前设计 ──(Plan A 增量优化)──> 默认主题
              │
              └──(Plan B 全面重构)──> 可选主题 B

设置 → 外观 → [默认主题] / [主题 B]
```

**好处**：
1. Plan A 先上线验证，核心功能优化先让用户体验
2. Plan B 可对比，用户能直观看到两种风格
3. 风险可控，Plan B 不影响主流程
4. 根据反馈决定是否切换

---

## 📋 Plan A 设计方向（默认主题 - 增量优化）

### 1. 加载/等待体验
- 统一进度条样式
- 添加加载动画（骨架屏或脉冲效果）
- 流式输出时显示实时状态

### 2. 内容展示可读性
- 优化卡片间距和层级
- Markdown 内容增加更好的排版样式
- 对比弹窗增强视觉区分

### 3. 操作便捷性
- 按钮位置和尺寸优化
- 关键操作增加快捷提示
- 优化报告页一键优化按钮突出

### 4. 视觉一致性
- 定义统一的设计 token（颜色、间距、圆角）
- 各页面组件样式对齐

---

## 📋 Plan B 设计方向（可选主题 - 全面重构）

### 1. 全新设计语言
- 引入更现代的视觉风格
- 重新设计配色系统
- 新增微交互动效

### 2. 组件重构
- 全新卡片、按钮、输入框设计
- 更好的暗色模式支持
- 响应式布局优化

### 3. 体验增强
- 页面转场动画
- 数据更新动画
- 更好的空状态设计

---

## 🔄 工作流程

1. **Plan A 开发** → 测试通过 → 用户验收
2. **Plan B 开发** → 作为可选主题 → 用户可对比
3. **根据反馈** → 决定默认主题是否切换到 B

---

## 📎 继续工作的指令

在新终端中告诉我：

> **"继续之前的工作，请读取 `docs/superpowers/WORK_IN_PROGRESS.md`"**

我会加载此文件并继续 Plan A 的开发。

---

## 🔄 如何在新终端继续

在新终端中告诉我：

> **"继续之前的工作，请读取 `docs/superpowers/WORK_IN_PROGRESS.md`"**

我会加载此文件并继续待完成的任务。

---

## 📝 设计讨论关键结论（2026-03-26）

### 模板格式规范化核心需求

**用户原话**:
> "当我自定义新模版时，只需要将内容粘贴进去，系统自动修正我的内容格式使之符合要求，不需要我去微调格式"

**关键决策**：
1. ✅ 自动格式化，不需要用户手动调整
2. ✅ 混合模式：智能提取 + 整体重写
3. ✅ 分级判断：关键词快速判断 + AI辅助
4. ✅ 按平台定制规范
5. ✅ 保存时格式化
6. ✅ 对比确认后再保存

### 平台格式规范
- **titlePrompt 规范**：5个公式 + 禁止事项 + JSON输出格式
- **contentPrompt 规范**：4种内容类型差异化 + 开篇/主体/结尾公式 + 金句 + 禁止 + 排版 + 互动
- **qualityPrompt 规范**：维度判定标准 + 评分规则 + 输出格式
