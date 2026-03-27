# 项目进度备忘录

---

## 项目概述

**内容改写工坊 (Content Rewrite Workshop)** - 音视频转录爆款文案生成器

将音视频转录文本一键转化为适配公众号、小红书、抖音三平台的高传播度爆款文案。

---

## 一、功能完成状态

### ✅ 已确认完成

| 模块 | 状态 | 说明 |
|------|------|------|
| 首页 | ✅ 完成 | 导航栏、功能展示、使用流程、CTA区域 |
| 内容编辑页 | ✅ 完成 | 文本输入、文件上传（TXT/MD/DOC/PDF）、字数统计 |
| 内容创作页 | ✅ 完成 | 快速模式/专业模式、标题选择、封面风格选择 |
| 优化报告页 | ✅ 完成 | 六维度雷达图、质检清单、优化建议、一键优化、导出 |
| 设置页面 | ✅ 完成 | AI供应商配置、平台模板、测试连接功能 |
| LLM Provider | ✅ 完成 | OpenAI/Claude/MiniMax/Kimi/DeepSeek/自定义/中转站 |
| 测试连接 | ✅ 完成 | 真正的API测试功能 |

### ✅ 已解决问题

| 问题 | 解决方案 |
|------|----------|
| 洞察分析页JSON解析失败 | 改为Markdown格式解析 |
| 快速模式进度不同步 | 已修复进度同步 |
| 代码内置默认模板问题 | 改为全部自定义模板，删除内置模板限制 |
| 切换平台时表单状态污染 | 切换平台时自动重置表单 |
| localStorage数据管理 | 添加导出/导入/清除功能 |
| 质检报告字段与提示词不一致 | 重构为按平台定义质检维度 |

### 🔧 开发中 (v1.7.2)

| 功能 | 状态 |
|------|------|
| 质检报告字段与提示词一致 | ✅ 已完成 |
| 模板删除功能优化 | 修复中（编译错误） |

### 📋 尚未开发

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 数据存储 | IndexedDB本地保存 | 低 |
| 版本管理 | 自动保存历史版本 | 低 |
| 导出功能 | 当前仅导出Markdown，可扩展ZIP导出 | 低 |

---

## 二、核心数据流

### 2.1 整体业务流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    用户                                         │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              1. 首页 (HomePage)                                  │
│                         功能介绍 / 使用流程 / 开始创作                            │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        2. 内容输入页 (ContentInputPage)                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ • 文本输入 / 文件上传 (TXT/MD/DOC/PDF)                                   │    │
│  │ • 前置信息填写 (平台/内容类型/赛道/核心数据)                              │    │
│  │ • 字数统计                                                               │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        3. 洞察分析页 (InsightPage)                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ • Content DNA 提取 (主题/风格/结构/关键词/情绪/受众)                      │    │
│  │ • 内容诊断书                                                             │    │
│  │ • 平台适配度分析                                                         │    │
│  │ [LLM: parseContent]                                                      │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      4. 内容创作页 (ContentCreationPage)                         │
│                                                                                 │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │
│  │      快速模式 (Quick)        │    │      专业模式 (Pro)          │            │
│  │  • 单平台生成                │    │  • 多平台同时生成            │            │
│  │  • 自动标题选择             │    │  • 手动标题编辑              │            │
│  │  • 生成→优化→对比→导出      │    │  • 封面风格选择              │            │
│  └─────────────┬───────────────┘    └─────────────┬───────────────┘            │
│                │                               │                               │
│                └───────────────┬───────────────┘                               │
│                                ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 4.1 六维质检分析 (analyzeContentQuality)                                │    │
│  │ • 吸引力 / 共鸣力 / 价值力 / 传播力 / 说服力 / 爆款概率                  │    │
│  │ • 质检清单逐项评估                                                       │    │
│  │ • 生成优化建议                                                           │    │
│  │ [LLM: analyzeContentQuality - 公众号/小红书/抖音模板]                    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      5. 优化报告页 (OptimizationReportPage)                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ • 六维雷达图可视化                                                       │    │
│  │ • 质检清单详情 (✅/❌状态)                                               │    │
│  │ • 优化建议展示                                                           │    │
│  │ • 一键优化 (optimizeContent)                                            │    │
│  │ • 导出功能 (Markdown/ZIP)                                                │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              6. 设置页 (SettingsPage)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ • AI供应商配置 (OpenAI/Claude/MiniMax/Kimi/DeepSeek/自定义)             │    │
│  │ • 平台改写模板 (公众号/小红书/抖音)                                      │    │
│  │ • 六维质检模板 (公众号/小红书/抖音) ← 新增                               │    │
│  │ • 优化重构模板                                                           │    │
│  │ • 内容拆解模板                                                           │    │
│  │ • 测试模式开关                                                           │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 详细数据流

```
用户输入内容
       │
       ▼
┌──────────────────┐    ┌──────────────────┐
│   原始文本        │    │   前置信息       │
│   (rawContent)   │    │   (preInfo)     │
│                  │    │  • platform     │
│                  │    │  • contentType  │
│                  │    │  • track        │
│                  │    │  • likes/collect│
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │   LLM: parseContent │
         │      (洞察分析)      │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │     Content DNA     │
         │  • 主题/关键词       │
         │  • 风格/情绪         │
         │  • 结构/受众         │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │  LLM: generateContent│
         │    (内容生成)        │
         │  • 平台适配          │
         │  • 标题/正文生成     │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   生成的内容         │
         │  • 多平台内容        │
         │  • 标题列表          │
         │  • 封面风格          │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │ LLM: analyzeContent │
         │   Quality (六维质检) │
         │  • 各维度评分        │
         │  • 爆款概率         │
         │  • 清单结果         │
         │  • 优化建议         │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │    质检报告          │
         │  QualityReport      │
         │  • dimensions[]     │
         │  • checklistResults │
         │  • suggestions      │
         └──────────┬──────────┘
                    ▼
    ┌──────────────┴──────────────┐
    │         用户决策              │
    │  • 直接导出                   │
    │  • 一键优化                  │
    └──────────────┬──────────────┘
                   │
                   ▼ (选择一键优化)
         ┌─────────────────────┐
         │ LLM: optimizeContent │
         │   (优化重构)          │
         │  • 原始内容          │
         │  • 质检报告          │
         │  • 平台模板          │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │    优化后内容         │
         │  (平台适配版)        │
         └──────────┬──────────┘
                    ▼
              ┌─────────┐
              │  导出   │
              │ Markdown│
              │   ZIP   │
              └─────────┘
```

### 2.3 状态管理数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Zustand Store (settingsStore)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │     AI      │  │  Platforms  │  │  Analysis   │  │Optimization │       │
│  │  Settings   │  │  Settings   │  │  Settings   │  │  Settings   │       │
│  │             │  │             │  │             │  │             │       │
│  │ providers[] │  │ platforms[] │  │ templates[]│  │ templates[] │       │
│  │ failover{}  │  │ templates   │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐                                          │
│  │ QualityAna │  │   PreInfo   │                                          │
│  │  lysis {}   │  │  {}         │                                          │
│  │             │  │             │                                          │
│  │ templates[] │  │ platform    │                                          │
│  │ (新增)      │  │ contentType │                                          │
│  └─────────────┘  │ track       │                                          │
│                   │ likes       │                                          │
│                   └─────────────┘                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                           testMode: boolean                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 LLM服务调用流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM Service (llmService.ts)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   callAI(messages)                                                          │
│        │                                                                     │
│        ▼                                                                     │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │ llmManager.chat(messages, providers, failover)                   │       │
│   │                                                                 │       │
│   │  1. 过滤可用供应商 (isEnabled)                                   │       │
│   │  2. 按优先级排序 (isPrimary)                                     │       │
│   │  3. 依次尝试调用                                                 │       │
│   │  4. 失败则切换供应商                                             │       │
│   │  5. 返回响应                                                     │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  核心函数:                                                                   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐        │
│  │  parseContent    │  │ generatePlatform  │  │ analyzeContent    │        │
│  │  (内容解析)       │  │    Content        │  │    Quality        │        │
│  │                  │  │  (内容生成)        │  │   (六维质检)      │        │
│  │                  │  │                   │  │                   │        │
│  │  • Content DNA   │  │  • 标题生成       │  │  • 维度评分       │        │
│  │  • 诊断书        │  │  • 正文生成       │  │  • 爆款概率      │        │
│  │  • 平台适配度    │  │  • 多平台        │  │  • 清单结果      │        │
│  └───────────────────┘  └───────────────────┘  │  • 优化建议      │        │
│                                                 └───────────────────┘        │
│  ┌───────────────────┐                                                      │
│  │  optimizeContent │                                                      │
│  │   (一键优化)      │                                                      │
│  │                  │                                                      │
│  │  • 内容重构       │                                                      │
│  │  • 质检驱动      │                                                      │
│  └───────────────────┘                                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、开发历史

### 2026-03-13 - v1.0 基础版完成

**内容**：完成4个页面的全流程开发

- 首页 (HomePage) - 导航栏、功能展示、使用流程、CTA区域
- 内容编辑页 (ContentInputPage) - 文本输入、文件上传、字数统计
- 洞察分析页 (InsightPage) - Content DNA展示、解析诊断书、平台适配度
- 内容创作页 (ContentCreationPage) - 快速模式、专业模式、生成进度
- 优化报告页 (OptimizationReportPage) - 雷达图、质检清单、一键优化、导出

**版本**：Git Commit `9b881e6`，Tag `v1.0`

---

### 2026-03-16 - AI配置页面开发

**完成内容**：

1. **LLM类型定义** (`src/services/llm/types.ts`)
2. **SettingsStore状态管理** (`src/stores/settingsStore.ts`)
3. **LLM供应商适配器** (`src/services/llm/adapters.ts`)
   - OpenAI / Anthropic / MiniMax / Kimi / DeepSeek / 自定义
4. **LLM管理器** (`src/services/llm/manager.ts`)
   - 自动切换逻辑 / 错误处理 / 重试机制
5. **设置页面UI** (`src/components/SettingsPage.tsx`)
   - AI供应商配置Tab
   - 平台模板Tab
   - 测试连接功能

**测试统计**：单元测试 39 个通过

---

### 2026-03-16 - 失败的功能改进尝试

> ⚠️ 以下尝试均未成功，最终回滚了代码

1. **完整平台模板导入** - ❌ 失败
   - 原因：模板存储在localStorage，代码更新不生效
   - 解决：需用户手动清除localStorage

2. **修复一键生成白屏** - ❌ 部分成功
   - 原因：`inputContent` 变量作用域问题

3. **JSON解析改进** - ⚠️ 部分成功
   - 改进了JSON解析逻辑，添加格式修复

4. **快速模式/专业模式分支** - ❌ 失败
   - 代码结构混乱，最终回滚

**教训**：
- 不应在单次对话中大幅修改代码
- 每次修改后应立即测试
- 重要功能修改前应先备份

---

### 2026-03-17 - InsightPage 深度优化

**完成内容**：

1. 创建独立 InsightPage.tsx 组件
2. 从 _rawJson 读取数据渲染各模块
3. 修复类型错误（对象vs字符串）
4. 移除内容诊断模块，直接展示AI原始数据
5. 页面布局优化 - 通用卡片组件、渐变背景、雷达图

**技术经验**：

```typescript
// 类型安全的值获取
const getStringValue = (val: any): string => {
  if (!val) return '暂无';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.特征 || val.content || Object.values(val)[0] || '暂无';
  }
  return String(val);
};

// 动态键名匹配
const matchedKey = Object.keys(gene).find(k => k.startsWith(searchKey));
```

---

### 2026-03-18 - 代码清理与JSON解析改进

**完成内容**：

1. 清理 llmService.ts 冗余代码
   - 删除14处 console.log 调试日志
   - 简化JSON解析逻辑
   - 减少代码行数：600+ → 412行

2. 清理 manager.ts 冗余代码
   - 删除3处调试日志

3. 改进JSON解析
   - 改为Markdown格式解析（替代JSON）
   - 提示词模板改为Markdown格式输出

---

## 四、技术架构

### 文件结构

```
src/
├── components/
│   ├── App.tsx              # 主应用（约1800行）
│   ├── InsightPage.tsx     # 洞察分析页
│   ├── SettingsPage.tsx    # 设置页面
│   └── OptimizationReportPage.tsx  # 优化报告页
├── services/
│   └── llm/
│       ├── types.ts         # 类型定义
│       ├── manager.ts       # LLM管理器
│       ├── adapters.ts     # 供应商适配器
│       └── llmService.ts   # LLM服务入口
├── stores/
│   └── settingsStore.ts    # 设置状态管理
└── data/
    └── platformTemplates.ts  # 平台模板数据
```

### 关键状态管理 (App.tsx)

```typescript
currentPage: 'home' | 'input' | 'insight' | 'creation' | 'optimization' | 'settings'
inputContent: string
analysisResult: any
generationResult: any
completedSteps: number[]
```

---

## 五、技术债务

1. **App.tsx 文件过大** - 所有组件（约1800行），建议拆分为独立组件文件
2. **AI返回结构不固定** - 不同模型返回格式不同，需要更健壮的解析逻辑

---

## 六、下一步开发建议

### 优先级：高
1. **修复洞察分析页JSON解析** - 刚改为Markdown格式，需测试验证
2. **修复快速模式进度同步** - 让进度条与实际生成过程同步

### 优先级：中
1. 测试连接功能验证

### 优先级：低
1. IndexedDB 数据存储
2. 历史版本管理
3. ZIP 导出功能

---

## 七、回滚节点记录

### 节点 #1 - 2026-03-18 产品配置页面调整

**当前提交**: `352c7e6`（未提交的新代码位于工作区）

**实现结论**：

1. **平台模板结构调整**
   - 每个平台（公众号/小红书/抖音）支持多个内容模板
   - 新数据结构：`Platform` 包含 `templates: ContentTemplate[]`
   - UI改为：平台列表 → 模板列表 → 爆款提示词编辑

2. **新增组件**
   - `ProviderEditForm.tsx` - AI供应商编辑组件
   - `ApiDebugPanel.tsx` - API调试面板组件

3. **UI调整**
   - 去掉"内容模板"文字
   - 去掉"内置平台"标签
   - 去掉"设为默认"功能
   - 去掉"重置"按钮（平台详情页）
   - 爆款提示词：标题+正文合并为单个输入框
   - 文件上传功能（md/txt）
   - 优化报告：删除系统提示词模块

4. **提示词变量逻辑（重要调整）**
   - 采用方案A：运行时自动传入用户内容
   - 提示词模板 = 纯自然语言指令（不需要变量占位符）
   - 调用时系统自动传入用户输入的原始内容
   - 去掉自动变量检测和插入功能
   - AI会自动识别和处理传入的内容

5. **数据迁移**
   - 添加 `onRehydrateStorage` 自动迁移旧数据结构
   - 旧 `templates` 转换为新 `platforms` 结构

**涉及文件**：
- `src/services/llm/types.ts` - 类型定义重构
- `src/stores/settingsStore.ts` - Store更新+迁移逻辑
- `src/components/SettingsPage.tsx` - UI全面调整
- `src/components/ProviderEditForm.tsx` - 新建
- `src/components/ApiDebugPanel.tsx` - 新建
- `src/services/llm/prompts.ts` - 适配新结构
- `src/services/llm/llmService.ts` - 适配新结构
- `src/data/platformTemplates.ts` - 删除（已不使用）

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout 352c7e6 -- .
```

---

### 节点 #2 - 2026-03-18 测试模式功能

**完成内容**：

1. **测试模式状态管理** (`src/services/llm/types.ts`)
   - 在 `AppSettings` 接口中添加 `testMode: boolean` 字段

2. **Settings Store 更新** (`src/stores/settingsStore.ts`)
   - 添加 `toggleTestMode` 函数
   - 默认值设为 `false`
   - 持久化到 localStorage

3. **设置页面UI** (`src/components/SettingsPage.tsx`)
   - 在"其他设置"Tab中添加测试模式开关
   - 显示紫色主题的开关和提示信息

4. **输入验证绕过** (`src/App.tsx`)
   - 测试模式下跳过最小字符数限制（100字）
   - 字数提示显示"测试模式"

5. **模拟数据** (`src/services/llm/llmService.ts`)
   - `parseContent`: 返回完整模拟的Content DNA数据
   - `generatePlatformContent`: 返回5个测试标题和模拟正文
   - `optimizeContent`: 返回优化后的模拟内容
   - 模拟延迟（模拟真实API调用时间）

**涉及文件**：
- `src/services/llm/types.ts` - AppSettings添加testMode
- `src/stores/settingsStore.ts` - toggleTestMode函数
- `src/components/SettingsPage.tsx` - 测试模式开关UI
- `src/App.tsx` - 输入验证绕过
- `src/services/llm/llmService.ts` - 三个函数的模拟数据

**使用方式**：
1. 进入"产品设置" → "其他设置"
2. 开启"测试模式"开关
3. 返回内容输入页，可以输入任意长度内容
4. 点击分析/生成/优化，体验完整流程（均返回模拟数据）

---

### 节点 #3 - 2026-03-18 洞察分析页新布局 (v1.1)

**版本号**: v1.1

**完成内容**：

1. **统一大模块框架**
   - 所有内容整合在一个大的白色卡片容器内
   - 顶部页面标题 + 底部操作区
   - 中间是完整的分析内容

2. **内容结构化呈现**
   - 保留六个模块的内容，但移除独立的模块边框
   - 使用统一的间距和样式
   - 模块间用标题区分（一、基础定位，二、结构脉络...）

3. **移除目录导航**
   - 不需要左侧目录

**涉及文件**：
- `src/components/InsightPage.tsx` - 布局调整

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/components/InsightPage.tsx
```

---

### 节点 #4 - 2026-03-19 InsightPage Markdown 渲染改版

**版本号**: v1.2

**完成内容**：

1. **依赖安装**
   - 安装 `react-markdown` 用于渲染 Markdown
   - 安装 `@tailwindcss/typography` 用于美化 Markdown 样式

2. **Tailwind 配置**
   - 在 `tailwind.config.js` 添加 typography 插件
   - 在 `index.css` 使用 `@plugin` 引入（Tailwind v4 语法）

3. **InsightPage.tsx 大幅简化**
   - 移除 6 个独立卡片模块（内容定位、结构脉络、价值与情绪、爆款基因、高光传播、平台适配）
   - 改为统一的大模块，直接渲染 AI 返回的 `rawContent`（Markdown格式）
   - 保留：左侧导航、顶部 Content DNA 标题 + 重新分析按钮
   - 简化模拟数据逻辑（用于预览样式）

4. **样式美化**
   - 初期尝试渐变风格（效果不佳，已回滚）
   - 最终采用简洁专业风格：
     - 简洁边框分隔
     - 淡雅配色
     - 干净的表格（表头灰底、悬停效果）
     - 无多余装饰

**涉及文件**：
- `package.json` - 添加依赖
- `tailwind.config.js` - 添加插件
- `index.css` - 引入 typography
- `src/components/InsightPage.tsx` - 主逻辑改动

**技术变更**：
- `process.env.NODE_ENV` → `import.meta.env.DEV`（Vite 兼容）

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/components/InsightPage.tsx
git checkout HEAD -- src/index.css
git checkout HEAD -- tailwind.config.js
```

---

### 节点 #5 - 2026-03-19 快速模式/专业模式代码隔离

**版本号**: v1.3

**问题背景**：
- 快速模式和专业模式原本在同一个组件 `ContentCreationPage` 中通过 `mode` 状态切换
- 两个模式共用部分状态变量，导致切换时状态相互干扰
- 代码耦合度高，修改一个模式会影响另一个

**完成内容**：

1. **创建独立组件**
   - `src/components/QuickModePanel.tsx` - 快速模式完整组件
     - 包含独立状态：`isGenerating`, `hasGenerated`, `generationSteps`, `results`, `previewPlatform`, `showPreview`, `apiError`
     - 包含生成逻辑、进度模拟、预览下载等功能
     - 内置 `PlatformCard` 组件用于展示平台结果

   - `src/components/ProModePanel.tsx` - 专业模式完整组件
     - 包含独立状态：`selectedPlatforms`, `selectedTitles`, `generatedTitles`, `editedTitles`, `selectedCoverStyles` 等
     - 包含平台选择、标题编辑、封面选择等功能

2. **简化主组件**
   - `ContentCreationPage` 现在只是一个外壳
   - 只负责模式切换（`setMode('quick')` / `setMode('pro')`）
   - 根据 mode 渲染对应的子组件
   - 不再包含任何具体业务逻辑

3. **隔离效果**
   - 两个模式的代码完全独立，互不影响
   - 切换模式时不需要手动重置对方的状态
   - 每个模式维护自己的生成进度和结果数据
   - 修改其中一个模式的代码不会影响另一个

**涉及文件**：
- `src/components/QuickModePanel.tsx` - 新建（约300行）
- `src/components/ProModePanel.tsx` - 新建（约280行）
- `src/App.tsx` - 精简，移除约500行代码

**文件结构变化**：
```
src/components/
├── QuickModePanel.tsx       # 新建 - 快速模式
├── ProModePanel.tsx         # 新建 - 专业模式
├── InsightPage.tsx
├── SettingsPage.tsx
└── OptimizationReportPage.tsx
```

**回滚方法**：
```bash
cd content-rewrite-workshop
# 删除新建的组件文件
rm src/components/QuickModePanel.tsx
rm src/components/ProModePanel.tsx
# 恢复 App.tsx（需要从 git 历史恢复）
git checkout HEAD -- src/App.tsx
```

---

### 节点 #6 - 2026-03-19 专业模式标题生成改版 (v1.4)

**完成内容**：

1. **平台选择调整**
   - 默认选中公众号，不再依赖平台适配分数
   - 添加平台图标（公众号.png、小红书.jpg、抖音.jpg）
   - 左侧图标 + 右侧文字布局，移除比例数字

2. **标题生成改为人工触发**
   - 用户填写标题数量（2-10个）
   - 点击"生成标题"按钮触发AI生成
   - 每个平台分别生成对应数量的标题

3. **标题展示竖三列布局**
   - 去掉自定义添加标题模块
   - 三个平台并排显示（grid）
   - 选中平台的标题列显示，未选中列收缩（w-24）+灰色背景
   - 选中数量为1时列宽flex-2，2个时flex-1，3个时均分
   - 每个标题显示三要素：标题内容、分类（type）、推荐理由

**涉及文件**：
- `src/components/ProModePanel.tsx` - 重大改版
- `src/assets/公众号.png` - 新增
- `src/assets/小红书.jpg` - 新增
- `src/assets/抖音.jpg` - 新增

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/components/ProModePanel.tsx
git checkout HEAD -- src/assets/公众号.png
git checkout HEAD -- src/assets/小红书.jpg
git checkout HEAD -- src/assets/抖音.jpg
```

---

### 2026-03-19 今日进展总结

**核心改动**：专业模式页面全面重构

| 模块 | 改动 |
|------|------|
| 平台选择 | 默认公众号+图标+移除分数依赖 |
| 标题生成 | 人工触发（填数量→点按钮→AI生成） |
| 标题展示 | 竖三列、水平折叠、动态列宽 |
| 标题要素 | 内容+分类+推荐理由 |

**已解决问题**：
- 洞察分析页JSON解析 → Markdown格式
- 快速模式进度不同步 → 已修复

**技术修复**：
- 删除expandedPlatforms后清理useEffect
- 表单输入框添加id/name解决可访问性警告

---

### 2026-03-19 - AI 调用逻辑全面重构

**版本号**: v1.5

**完成内容**：

1. **洞察分析页 - 使用模板提示词**
   - 修改 `parseContent` 函数，从 settingsStore 读取"内容分析"默认模板的 `analysisPrompt`
   - 添加 JSON 格式解析支持（模板默认输出 JSON）
   - 修改 InsightPage.tsx，调用真正的 AI 进行分析

2. **快速模式 - 合并调用 + 平台判断**
   - 根据分析结果的"平台"字段判断生成范围：
     - 平台字段为空 → 生成全部3个平台（公众号、小红书、抖音）
     - 平台字段有具体值（如"公众号"）→ 只生成对应平台
   - 合并标题+正文为1次调用（新增 `mergeTitleAndContent` 参数）
   - 隐藏封面提示词展示

3. **专业模式 - 拆分为两次调用**
   - 第一次：点击"生成标题" → 使用 `titlePrompt`（不合并）
   - 第二次：点击"爆款制作启动" → 使用 `contentPrompt`（不合并）
   - 隐藏封面建议 UI

4. **一键优化 - 使用优化报告模板**
   - 修改 `optimizeContent` 函数，从 settingsStore 读取"优化报告"默认模板的提示词

5. **ZIP 导出功能**
   - 安装 JSZip 库
   - 新增"导出全部平台"功能，打包下载为 ZIP 文件
   - 导出按钮改为下拉菜单形式

**涉及文件**：
- `src/services/llm/llmService.ts` - 核心 AI 调用逻辑重构
- `src/components/InsightPage.tsx` - 添加 AI 调用
- `src/components/QuickModePanel.tsx` - 快速模式重构
- `src/components/ProModePanel.tsx` - 专业模式重构
- `src/components/OptimizationReportPage.tsx` - 添加 ZIP 导出
- `package.json` - 添加 jszip 依赖

**技术变更**：
- `parseContent` 支持 JSON 和 Markdown 两种解析
- `generatePlatformContent` 新增 `mergeTitleAndContent` 参数
- 分析结果新增"平台"字段用于判断生成范围
- 测试模式数据同步更新

---

### 节点 #7 - 2026-03-19 AI 调用逻辑重构 (v1.5)

**版本号**: v1.5

**完成内容**：见上方"2026-03-19 - AI 调用逻辑全面重构"

**涉及文件**：
- `src/services/llm/llmService.ts`
- `src/components/InsightPage.tsx`
- `src/components/QuickModePanel.tsx`
- `src/components/ProModePanel.tsx`
- `src/components/OptimizationReportPage.tsx`
- `package.json`

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/services/llm/llmService.ts
git checkout HEAD -- src/components/InsightPage.tsx
git checkout HEAD -- src/components/QuickModePanel.tsx
git checkout HEAD -- src/components/ProModePanel.tsx
git checkout HEAD -- src/components/OptimizationReportPage.tsx
git checkout HEAD -- package.json package-lock.json
```

---

### 2026-03-20 - 前置信息完整集成 (v1.6)

**版本号**: v1.6

**完成内容**：

1. **模板提示词使用前置信息变量**
   - 为公众号、小红书、抖音的所有模板添加前置信息占位符
   - 变量包括：`{platform}`, `{content_type}`, `{track}`, `{likes}`, `{collect_count}`, `{view_count}`, `{share_count}`
   - 涉及文件：`settingsStore.ts`

2. **快速模式支持前置信息**
   - `QuickModePanel.tsx` Props 添加 `preInfo` 参数
   - 主生成和重新生成逻辑都传入前置信息
   - 涉及文件：`QuickModePanel.tsx`, `App.tsx`

3. **洞察分析页使用前置信息**
   - `InsightPage.tsx` Props 添加 `preInfo` 参数
   - `parseContent` 函数添加 `preInfo` 参数，构建前置信息上下文
   - 调用时传入前置信息，使分析结果更精准
   - 涉及文件：`InsightPage.tsx`, `llmService.ts`, `App.tsx`

4. **前置信息持久化**
   - `settingsStore.ts` 添加 `preInfo` 状态和 `setPreInfo` 方法
   - 使用 zustand persist 中间件自动持久化到 localStorage
   - 刷新页面后前置信息不丢失
   - 涉及文件：`settingsStore.ts`, `App.tsx`

---

### 2026-03-23 - 六维质检系统 (v1.6.1)

**版本号**: v1.6.1

**完成内容**：

1. **六维质检类型定义** (`src/services/llm/types.ts`)
   - `QualityDimension` - 维度定义（吸引力、共鸣力、价值力、传播力、说服力、爆款概率）
   - `QualityCheckItem` - 质检清单项
   - `QualityAnalysisTemplate` - 六维质检模板
   - `QualityReport` - 质检报告（包含各维度评分、爆款概率、清单结果、优化建议）
   - `QualityAnalysisSettings` - 质检设置

2. **六维质检模板配置** (`src/stores/settingsStore.ts`)
   - `createDefaultQualityAnalysisSettings()` - 默认模板（公众号、小红书、抖音三平台）
   - CRUD操作函数：`addQualityAnalysisTemplate`、`updateQualityAnalysisTemplate`、`removeQualityAnalysisTemplate`、`setDefaultQualityAnalysisTemplate`

3. **LLM服务函数** (`src/services/llm/llmService.ts`)
   - `analyzeContentQuality()` - 六维质检分析函数
   - 根据平台ID选择对应质检模板
   - 调用AI进行六维评估，返回详细报告

4. **ProModePanel集成** (`src/components/ProModePanel.tsx`)
   - 内容生成后自动调用六维质检分析
   - 质检报告传递给优化报告页面

5. **设置页面** (`src/components/SettingsPage.tsx`)
   - 六维质检模板Tab（位于平台改写和优化重构之间）
   - 与优化重构页面样式统一（平台标签页、模板列表、添加/编辑表单）
   - 支持查看、编辑、添加、删除、设为默认操作

**回滚节点**:
```bash
# v1.5.1 回滚点
git log --oneline -20
# 找到 352c7e6 或更早的 commit
git checkout 352c7e6 -- .
```

---

### 2026-03-19 - 优化报告模板分平台 + 前置信息模块 (v1.5.1)

**版本号**: v1.5.1

**完成内容**：

1. **优化报告模板分平台配置**
   - 修改 `OptimizationTemplate` 类型，添加 `platformId` 字段
   - 默认优化模板按平台分类（公众号、小红书、抖音各有独立模板）
   - 设置页面优化报告Tab改为标签页切换形式
   - 调用优化时根据当前平台选择对应模板
   - 涉及文件：`types.ts`, `settingsStore.ts`, `llmService.ts`, `SettingsPage.tsx`, `OptimizationReportPage.tsx`

2. **内容编辑页新增前置信息模块**
   - 输入框上方添加"前置信息"模块
   - 包含字段：内容平台、内容类型、所属赛道、核心数据（获赞/收藏/播放/转发）
   - 输入框标题改为"输入原文"
   - 前置信息传递给后续流程（洞察分析→内容创作）
   - 涉及文件：`App.tsx`, `ProModePanel.tsx`, `llmService.ts`, `prompts.ts`

3. **UI细节优化**
   - 洞察分析页按钮文案："立即生成" → "选择创作模式"
   - 专业模式标题列图标移除，只保留文字
   - 快速模式进度步骤改为固定4项：调用AI大模型、内容DNA提取、生成爆款标题、生成爆款内容（按顺序逐步完成）
   - 专业模式标题卡片美化：圆角、阴影、序号标签、星级评分、推荐理由
   - 涉及文件：`InsightPage.tsx`, `ProModePanel.tsx`, `QuickModePanel.tsx`

**涉及文件**：
- `src/services/llm/types.ts` - OptimizationTemplate添加platformId
- `src/stores/settingsStore.ts` - 优化模板按平台分类
- `src/services/llm/llmService.ts` - optimizeContent支持platformId参数
- `src/services/llm/prompts.ts` - 添加前置信息变量
- `src/components/SettingsPage.tsx` - 优化报告Tab标签页切换
- `src/components/OptimizationReportPage.tsx` - 调用时传入platformId
- `src/App.tsx` - 前置信息模块UI + PreContentInfo类型
- `src/components/ProModePanel.tsx` - 接收前置信息 + 标题卡片美化
- `src/components/InsightPage.tsx` - 按钮文案修改
- `src/components/QuickModePanel.tsx` - 4个固定步骤

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/services/llm/types.ts
git checkout HEAD -- src/stores/settingsStore.ts
git checkout HEAD -- src/services/llm/llmService.ts
git checkout HEAD -- src/services/llm/prompts.ts
git checkout HEAD -- src/components/SettingsPage.tsx
git checkout HEAD -- src/components/OptimizationReportPage.tsx
git checkout HEAD -- src/App.tsx
git checkout HEAD -- src/components/ProModePanel.tsx
git checkout HEAD -- src/components/InsightPage.tsx
git checkout HEAD -- src/components/QuickModePanel.tsx
```

---

## 八、今日更新 (2026-03-25)

### 2026-03-25 - 快速模式优化升级 (v1.7.1)

**版本号**: v1.7.1

**完成内容**：

1. **App.tsx 按钮文案修改**
   - 将快速模式选择页的"🚀 立即生成"改为"选择此模式"
   - 与专业模式按钮文案保持一致
   - 涉及文件：`src/App.tsx` (line 930)

2. **快速模式添加流程说明文案**
   - 在一键生成按钮下方添加两步流程说明
   - 步骤1：调用平台改写模板生成内容（根据前置信息判断平台范围）
   - 步骤2：预览时一键优化（无需质检，同时展示原版和优化版供选择）
   - 涉及文件：`src/components/QuickModePanel.tsx`

3. **快速模式预览弹窗重设计**
   - 左右对比布局：原版 vs 优化版
   - 每个版本都有选择/取消选择按钮
   - 添加"一键优化（无需质检）"按钮
   - 优化后自动选中两个版本
   - 支持重新优化
   - 下载按钮根据选择动态变化：选两个版本显示"下载全部"，选一个显示对应版本
   - 涉及文件：`src/components/QuickModePanel.tsx`

4. **新增 quickOptimizeContent 函数**
   - 新增快速优化函数，无需质检报告
   - 根据平台ID调用对应平台的优化模板
   - 支持测试模式和真实LLM调用
   - 涉及文件：`src/services/llm/llmService.ts`

**涉及文件**：
- `src/App.tsx` - 按钮文案修改
- `src/components/QuickModePanel.tsx` - 流程说明文案 + 预览弹窗重设计
- `src/services/llm/llmService.ts` - 新增 quickOptimizeContent 函数

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/App.tsx
git checkout HEAD -- src/components/QuickModePanel.tsx
git checkout HEAD -- src/services/llm/llmService.ts
```

---

### 2026-03-25 - 质检报告字段与提示词一致 (v1.7.2)

**版本号**: v1.7.2

**完成内容**：

1. **类型定义更新** (`src/services/llm/types.ts`)
   - 新增 `GzhQualityDimensions` - 公众号5维质检维度
   - 新增 `XhsQualityDimensions` - 小红书5维质检维度
   - 新增 `DouyinQualityDimensions` - 抖音5维质检维度
   - 新增 `QualityReport` - 统一质检报告类型
   - 新增 `QualityCheckItem` - 质检清单项（含pass/warning/fail判定）
   - 新增 `PLATFORM_DIMENSION_CONFIG` - 平台维度配置映射
   - 新增 `calculateViralProbability`、`calculateGrade` 工具函数

2. **质检提示词按平台更新** (`src/stores/settingsStore.ts`)
   - **公众号**：标题/摘要传播性(25分)、人群精准度(15分)、社交货币属性(25分)、内容密度(20分)、留存引导设计(15分)
   - **小红书**：标题/首图钩子(20分)、人群精准度(15分)、可收藏价值密度(25分)、SEO关键词布局(20分)、互动/传播设计(20分)
   - **抖音**：3秒钩子有效性(25分)、15秒爆点达标率(20分)、节奏密度(30分)、互动/关键词设计(15分)、转发引导设计(10分)
   - 每条维度包含 ✅/⚠️/❌ 量化判定标准
   - JSON输出格式要求明确

3. **LLM质检响应解析重构** (`src/services/llm/llmService.ts`)
   - `analyzeContentQuality` 返回 `QualityReport` 类型
   - 优先使用用户自定义模板（`!isBuiltIn`）
   - 新增 `parseGzhDimensions`、`parseXhsDimensions`、`parseDouyinDimensions` 解析函数
   - 支持新旧维度名称兼容映射
   - 新增 `generateMockQualityReport` 测试模式数据生成

4. **优化报告页UI适配** (`src/components/OptimizationReportPage.tsx`)
   - 雷达图动态渲染不同平台的维度（使用 `PLATFORM_DIMENSION_CONFIG`）
   - Checklist 支持 pass/warning/fail 三种判定样式
   - 显示各维度得分（`score/maxScore`）

**涉及文件**：
- `src/services/llm/types.ts` - 新增类型定义
- `src/stores/settingsStore.ts` - 质检提示词更新
- `src/services/llm/llmService.ts` - 解析函数重构
- `src/components/OptimizationReportPage.tsx` - UI适配

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/services/llm/types.ts
git checkout HEAD -- src/stores/settingsStore.ts
git checkout HEAD -- src/services/llm/llmService.ts
git checkout HEAD -- src/components/OptimizationReportPage.tsx
```

---

## 九、后续待做内容

### 1. 模板提示词中使用前置信息变量（高优先级）

**作用**：
- 将前置信息（平台、内容类型、赛道、核心数据）嵌入到模板提示词中
- 让AI生成的内容更加精准地匹配原始内容的风格和数据表现

**不做会怎样**：
- 前置信息虽然被收集和传递了，但实际没有在AI生成时发挥作用
- 用户填写的前置数据变成了无效输入，影响用户体验

---

### 2. 快速模式也支持前置信息传递（高优先级）

**作用**：
- 目前只有专业模式（ProModePanel）接收了前置信息
- 快速模式（QuickModePanel）也需要使用前置信息来生成更精准的内容

**不做会怎样**：
- 快速模式生成的内容质量会低于专业模式
- 用户在快速模式下填写的前置信息被浪费

---

### 3. 内容编辑页前置信息持久化（低优先级）

**作用**：
- 用户填写的前置信息在刷新页面后应该被保留
- 类似草稿保存功能

**不做会怎样**：
- 用户每次都需要重新填写前置信息
- 如果误刷新，之前填写的数据会丢失

---

### 4. 前置信息数据校验（低优先级）

**作用**：
- 对必填字段进行校验（如内容平台）
- 数字字段限制非负数

**不做会怎样**：
- 用户可能输入无效数据导致后续处理异常

---

### 5. 洞察分析页使用前置信息（高优先级）

**作用**：
- 将前置信息传递给AI分析，让分析结果更加精准
- 例如：根据平台类型调整分析维度

**不做会怎样**：
- 洞察分析结果不会考虑用户的实际发布平台和目标数据
- 分析结果与实际需求可能存在偏差

---

### 6. App.tsx 代码拆分（技术债务）

**作用**：
- 将约1800行的App.tsx拆分为独立的组件文件
- 提高代码可维护性和可读性

**不做会怎样**：
- 代码难以维护和调试
- 新功能开发效率降低

---

### 2026-03-25 - 模板导入功能 (v1.8)

**版本号**: v1.8

**完成内容**：

1. **模板导入脚本开发**
   - `scripts/import-templates-from-folder.cjs` - 从文件夹导入模板到浏览器localStorage
   - `scripts/export-prompts-to-files.cjs` - 从模板文件导出提示词到TypeScript文件
   - `scripts/regen-prompts.cjs` - 重新生成提示词文件（修复转义问题）

2. **模板数据结构优化**
   - 新增 `src/data/` 目录存储模板提示词
   - `analysisPrompt.ts` - 内容分析模板
   - `gzhContentPrompt.ts` / `xhsContentPrompt.ts` / `douyinContentPrompt.ts` - 标题+正文分离
   - `gzhQualityPrompt.ts` / `xhsQualityPrompt.ts` / `douyinQualityPrompt.ts` - 质检模板
   - `gzhOptimizationPrompt.ts` / `xhsOptimizationPrompt.ts` / `douyinOptimizationPrompt.ts` - 优化模板

3. **模板内容智能拆分**
   - 方案2：标题提示词（步骤2）与正文提示词（步骤3-5）分离
   - AI可以更好地识别和使用不同类型的提示词
   - 公众号标题1613字符、正文7148字符
   - 小红书标题1746字符、正文7084字符
   - 抖音标题1608字符、正文7895字符

4. **内置模板使用导入内容**
   - `settingsStore.ts` 更新内置平台使用导入的提示词
   - 公众号/小红书/抖音三平台内容模板使用完整提示词
   - 质检模板使用完整六维质检提示词
   - 优化模板使用完整优化报告提示词

**涉及文件**：
- `src/data/` - 新增模板数据目录
- `src/stores/settingsStore.ts` - 更新内置模板
- `scripts/` - 新增导入脚本

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/data/
git checkout HEAD -- src/stores/settingsStore.ts
rm -rf scripts/
```

---

### 2026-03-26 - 流式输出功能 (v2.0)

**版本号**: v2.0

**完成内容**：

1. **流式输出类型定义** (`src/services/llm/types.ts`)
   - 新增 `StreamingChunk` - 流式数据块类型
   - 新增 `StreamError` - 流式错误类型
   - 新增 `StreamCallback` - 流式回调函数类型

2. **适配器流式方法** (`src/services/llm/adapters.ts`)
   - 所有适配器新增 `chatStream()` 方法
   - 使用 fetch API 接收 SSE 流式响应
   - 支持 OpenAI、Kimi、DeepSeek 等 OpenAI 兼容格式
   - Anthropic 适配器使用事件格式解析

3. **LLMManager 流式支持** (`src/services/llm/manager.ts`)
   - 新增 `chatStream()` 方法
   - 支持供应商自动切换
   - 快速失败策略（失败立即切换）

4. **LLMService 流式封装** (`src/services/llm/llmService.ts`)
   - 新增 `callAIWithStreaming()` - 通用流式调用（失败自动降级）
   - 新增 `generateStreamingPlatformContent()` - 合并模式流式生成
   - 新增 `generateStreamingContentOnly()` - 非合并模式流式生成
   - 降级时批量回调（50字符/批，20ms延迟）

5. **QuickModePanel 流式集成** (`src/components/QuickModePanel.tsx`)
   - 集成流式内容生成和实时显示
   - 新增 `streamingContents` 状态存储实时内容
   - `createStreamingCallback()` 工厂函数
   - 预览弹窗优先显示流式内容

6. **ProModePanel 流式集成** (`src/components/ProModePanel.tsx`)
   - 集成流式内容生成
   - 使用 `generateStreamingContentOnly()` 函数

7. **设计文档** (`docs/superpowers/specs/2026-03-27-streaming-output-design.md`)

**涉及文件**：
- `src/services/llm/types.ts` - 新增流式类型
- `src/services/llm/adapters.ts` - 所有适配器新增 chatStream()
- `src/services/llm/manager.ts` - 新增 chatStream()
- `src/services/llm/llmService.ts` - 新增流式封装函数
- `src/components/QuickModePanel.tsx` - 集成流式
- `src/components/ProModePanel.tsx` - 集成流式

**回滚方法**：
```bash
cd content-rewrite-workshop
git checkout HEAD -- src/services/llm/types.ts
git checkout HEAD -- src/services/llm/adapters.ts
git checkout HEAD -- src/services/llm/manager.ts
git checkout HEAD -- src/services/llm/llmService.ts
git checkout HEAD -- src/components/QuickModePanel.tsx
git checkout HEAD -- src/components/ProModePanel.tsx
```

---

*最后更新：2026-03-27*
