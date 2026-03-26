# 模板格式规范化设计方案

**日期**: 2026-03-26
**状态**: 已批准
**目标**: 解决模板提示词硬编码问题，实现用户自定义模板时自动格式化

---

## 问题描述

### 现状架构

```
src/data/gzhContentPrompt.ts  ← 硬编码在TypeScript代码里
         ↓
settingsStore.ts  ← 导入作为内置模板默认值
         ↓
用户自定义模板 → localStorage（无格式规范约束）
```

### 问题

1. 提示词写在代码里，不是可动态编辑的配置
2. 用户添加自定义模板时，没有机制确保格式符合要求
3. 后续无法方便地批量更新模板内容

---

## 设计方案

### 核心流程

```
用户粘贴内容
    ↓
保存时 → 系统自动格式化（分级判断）
    ↓
显示对比（原内容 vs 格式化后）
    ↓
用户确认 → 保存
```

### 格式化策略（混合模式）

| 内容情况 | 判断方式 | 策略 |
|---------|---------|------|
| 结构清晰 | 关键词匹配（公式、示例、禁止等） | 智能提取关键部分，按规范放到正确位置 |
| 结构混乱 | 段落过长（>50行）或无结构关键词 | 整体重写，保留核心意思 |
| 模糊情况 | 关键词匹配不明确 | AI辅助判断 |

### 分级判断规则

```
第一层：关键词快速判断
- 检测"公式"、"示例"、"禁止"、"结构"等结构关键词
- 有≥3个结构关键词 → 结构清晰
- 无结构关键词且段落过长 → 混乱
- 其他 → 进入第二层

第二层：AI辅助判断（可选）
- 用于模糊情况
- 让AI判断内容结构是否清晰
```

---

## 平台格式规范

### titlePrompt 规范（通用结构）

```json
{
  "type": "titlePrompt",
  "platforms": ["gzh", "xhs", "douyin"],
  "structure": {
    "coreFormulas": {
      "label": "核心标题公式",
      "count": 5,
      "required": true,
      "fields": {
        "name": "公式名称",
        "template": "公式结构",
        "examples": ["示例1", "示例2"],
        "applicableTo": "适用场景"
      }
    },
    "prohibitions": {
      "label": "禁止事项",
      "count": 5,
      "required": true,
      "format": "❌ 描述"
    },
    "outputFormat": {
      "label": "输出格式",
      "required": true,
      "format": "JSON",
      "schema": {
        "titles": "数组，每个包含 text/type/reason",
        "recommended": "主推标题"
      }
    }
  }
}
```

### contentPrompt 规范（通用结构）

```json
{
  "type": "contentPrompt",
  "platforms": ["gzh", "xhs", "douyin"],
  "structure": {
    "contentTypeDiff": {
      "label": "内容类型差异化",
      "count": 4,
      "required": true,
      "types": ["干货方法类", "情感共鸣类", "经历分享类", "书单清单类"]
    },
    "openingFormulas": {
      "label": "核心开篇公式",
      "count": 3,
      "required": true
    },
    "bodyStructures": {
      "label": "主体结构模式",
      "count": 4,
      "required": true
    },
    "endingFormulas": {
      "label": "结尾公式",
      "count": 3,
      "required": true
    },
    "goldenQuotes": {
      "label": "金句植入策略",
      "required": true
    },
    "prohibitions": {
      "label": "禁止事项",
      "required": true
    },
    "layout": {
      "label": "排版要求",
      "required": true
    },
    "interaction": {
      "label": "互动触发设计",
      "required": true
    }
  }
}
```

### qualityPrompt 规范

```json
{
  "type": "qualityPrompt",
  "platforms": ["gzh", "xhs", "douyin"],
  "structure": {
    "dimensions": {
      "label": "维度判定标准",
      "required": true,
      "fields": {
        "name": "维度名称",
        "weight": "权重分数",
        "benchmarks": {
          "pass": "✅ 达标标准",
          "warning": "⚠️ 待优化标准",
          "fail": "❌ 不达标标准"
        }
      }
    },
    "scoringRules": {
      "label": "评分规则",
      "required": true
    },
    "outputFormat": {
      "label": "输出格式",
      "required": true,
      "format": "JSON"
    }
  }
}
```

---

## 组件设计

### 1. templateSpecs.ts

定义各平台的格式规范。

```typescript
interface PlatformTemplateSpec {
  platformId: 'gzh' | 'xhs' | 'douyin';
  titlePromptSpec: PromptSpec;
  contentPromptSpec: PromptSpec;
  qualityPromptSpec?: PromptSpec;
}

interface PromptSpec {
  requiredSections: Section[];
  optionalSections?: Section[];
  outputFormat?: OutputFormatSpec;
}

interface Section {
  key: string;
  label: string;
  description: string;
  required: boolean;
  fields?: Field[];
  minCount?: number;
  maxCount?: number;
}

interface Field {
  key: string;
  label: string;
  type: 'text' | 'array' | 'code';
  required: boolean;
}
```

### 2. TemplateFormatter 服务

自动格式化逻辑。

```typescript
interface FormatInput {
  rawContent: string;
  promptType: 'titlePrompt' | 'contentPrompt' | 'qualityPrompt';
  platformId: string;
}

interface FormatOutput {
  formatted: string;
  strategy: 'smartExtract' | 'fullRewrite' | 'aiAssist';
  changes: {
    original: string;
    formatted: string;
    reason: string;
  }[];
}

class TemplateFormatter {
  // 第一层：关键词快速判断
  detectStructureLevel(content: string): 'clear' | 'chaotic' | 'unclear';

  // 智能提取
  smartExtract(content: string, spec: PromptSpec): FormatOutput;

  // 整体重写
  fullRewrite(content: string, spec: PromptSpec): FormatOutput;

  // 格式化入口
  format(input: FormatInput): FormatOutput;
}
```

### 3. 对比确认组件

显示格式化前后对比。

```typescript
interface CompareModalProps {
  original: string;
  formatted: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: (edited: string) => void;
}
```

---

## 实施步骤

### 第一阶段：基础建设

1. 创建 `src/data/templateSpecs.ts`
   - 定义三平台的 titlePrompt/contentPrompt/qualityPrompt 规范

2. 创建 `src/services/templateFormatter.ts`
   - TemplateFormatter 类
   - 分级判断逻辑
   - 智能提取逻辑
   - 整体重写逻辑

### 第二阶段：集成

3. 更新 settingsStore
   - 模板保存时调用格式化
   - 返回格式化结果供用户确认

4. 更新设置页面组件
   - 添加对比确认弹窗
   - 用户确认后保存

### 第三阶段：AI辅助（可选）

5. 添加 AI 判断逻辑
   - 用于模糊情况的二次判断
   - 保持用户体验流畅

---

## 数据流

```
用户编辑模板内容
    ↓
点击保存
    ↓
TemplateFormatter.format()
    ↓ 判断结构类型
    ↓
结构清晰 → smartExtract()
结构混乱 → fullRewrite()
    ↓
返回 { formatted, strategy, changes }
    ↓
CompareModal 显示对比
    ↓
用户确认
    ↓
保存到 localStorage
```

---

## 影响范围

| 文件 | 改动 |
|-----|------|
| `src/data/templateSpecs.ts` | 新增 - 格式规范定义 |
| `src/services/templateFormatter.ts` | 新增 - 格式化服务 |
| `src/stores/settingsStore.ts` | 修改 - 集成格式化逻辑 |
| `src/components/SettingsPage.tsx` | 修改 - 添加对比确认组件 |

---

## 验证标准

- 用户粘贴任意格式内容，保存后能生成符合规范的模板
- 对比确认功能正常工作
- 内置模板不受影响
- 自定义模板能正常保存和使用
