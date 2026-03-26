# 模板格式规范化 - 整合实施文档

**日期**: 2026-03-26
**状态**: 待实施
**基于**: `2026-03-26-template-format-spec-design.md`

---

## 核心需求确认

### 调用逻辑

```
调用模板时：
├── 有自定义模板？ → 优先调用【默认的自定义模板】
└── 没有自定义模板？ → 调用【内置模板】
```

### 格式化逻辑

```
自定义模板：
├── 用户粘贴内容 → 保存时自动格式化
└── 有变更 → 对比弹窗确认

内置模板：
├── 已是规范化格式 → 不需要格式化
└── 需要改动？ → 硬编码改代码
```

### 模板分类

```
平台模板 Tab：
├── 内置模板 (只读) ← 系统提供，不可编辑
└── 自定义模板 (可编辑) ← 用户添加，支持格式化

内容分析 Tab：
├── 内置模板 (只读)
└── 自定义模板 (可编辑)

优化报告 Tab：
├── 内置模板 - 公众号/小红书/抖音 (只读)
└── 自定义模板 (可编辑)

六维质检 Tab：
└── 内置模板 (只读)
```

---

## 交互流程

```
用户编辑自定义模板内容
    ↓
点击"保存"
    ↓
formatTemplate() 自动格式化
    ↓
┌─────────────────────────────────────────┐
│ 检测变更 (changes.length > 0)            │
└─────────────────────────────────────────┘
    ↓
    ├─ 无变更 → 直接保存
    │
    └─ 有变更 → 显示对比弹窗
                    │
                    ├── 确认 → 保存格式化版
                    ├── 原版 → 保存原始内容
                    └── 取消 → 返回编辑
```

---

## 文件改动清单

### 删除

| 文件 | 原因 |
|------|------|
| `src/services/validator/TemplateValidator.ts` | 功能被 `templateFormatter` 替代 |
| `src/services/validator/index.ts` | 简化，保留 `validateTemplate` |

### 保留/修改

| 文件 | 改动 |
|------|------|
| `src/data/templateSpecs.ts` | 保持不变 |
| `src/services/templateFormatter.ts` | 保持不变 |
| `src/components/SettingsPage.tsx` | 重构，区分内置/自定义模板 |
| `src/stores/settingsStore.ts` | 逻辑微调 |

### 新增

| 文件 | 用途 |
|------|------|
| `src/components/CompareModal.tsx` | 格式化对比弹窗 |

---

## SettingsPage.tsx 重构详情

### PlatformTab 新布局

```
┌─────────────────────────────────────────────────┐
│ 📺 公众号                      [添加自定义平台]   │
├─────────────────────────────────────────────────┤
│ 内置模板：                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📋 深度文章模板                              │ │
│ │ 标题提示词: 5个公式 + JSON输出               │ │
│ │ 正文提示词: 访谈/故事/观点/新闻/演讲         │ │
│ │                      [只读] [重置内置]       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 自定义模板：                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📝 我的模板                    [默认] [编辑] │ │
│ │ ┌─────────────────────────────────────────┐│ │
│ │ │ 标题提示词: ...                          ││ │
│ │ │ 正文提示词: ...                          ││ │
│ │ └─────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────┘ │
│                    [+ 添加自定义模板]            │
└─────────────────────────────────────────────────┘
```

### 状态变更

```typescript
// 删除
const [showFixPreview, setShowFixPreview] = useState(false);
const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
const [fixedTemplate, setFixedTemplate] = useState<FixedTemplate | null>(null);

// 新增
const [formatResult, setFormatResult] = useState<FormatOutput | null>(null);
const [showCompareModal, setShowCompareModal] = useState(false);
```

### 核心逻辑

```typescript
const handleSaveTemplate = () => {
  // 只对自定义模板格式化
  if (!isBuiltInTemplate(templateId)) {
    const result = formatTemplate({
      rawContent: tempContent,
      promptType: 'titlePrompt', // 或 contentPrompt
      platformId: selectedPlatform.id
    });

    if (result.changes.length > 0 || result.warnings.length > 0) {
      setFormatResult(result);
      setShowCompareModal(true);
    } else {
      doSave(tempContent);
    }
  } else {
    // 内置模板不应该走到编辑逻辑
    console.warn('内置模板不可编辑');
  }
};

const handleConfirmFormat = () => {
  doSave(formatResult.formatted);
  setShowCompareModal(false);
};

const handleUseOriginal = () => {
  doSave(tempContent);
  setShowCompareModal(false);
};
```

### 对比弹窗

```tsx
<CompareModal
  isOpen={showCompareModal}
  original={tempContent}
  formatted={formatResult?.formatted || ''}
  changes={formatResult?.changes || []}
  warnings={formatResult?.warnings || []}
  onConfirm={handleConfirmFormat}
  onUseOriginal={handleUseOriginal}
  onCancel={() => setShowCompareModal(false)}
/>
```

---

## 实施步骤

### Step 1: 创建对比弹窗

- [ ] 创建 `src/components/CompareModal.tsx`
- [ ] 左右对比布局
- [ ] 变更说明列表
- [ ] 三按钮：取消 / 使用原版 / 确认格式化

### Step 2: 替换底层

- [ ] 创建 `src/services/autoFormatService.ts`（封装 `formatTemplate`）
- [ ] 删除 `src/services/validator/TemplateValidator.ts`
- [ ] 简化 `src/services/validator/index.ts`

### Step 3: 重构 SettingsPage

- [ ] PlatformTab 重构
  - [ ] 内置模板只读展示
  - [ ] 添加自定义模板入口
  - [ ] 自定义模板编辑触发格式化
- [ ] AnalysisTab 重构（内置只读 + 自定义可编辑）
- [ ] OptimizationTab 重构（内置只读 + 自定义可编辑）
- [ ] 集成 CompareModal

### Step 4: 验证

- [ ] 自定义模板保存时触发格式化
- [ ] 对比弹窗正常显示
- [ ] 用户可选择格式化版或原版
- [ ] 内置模板不可编辑
- [ ] 调用时优先使用自定义模板

---

## 内置/自定义模板区分

```typescript
// 判断是否为内置模板
function isBuiltInTemplate(platformId: string, templateId: string): boolean {
  const builtInPlatforms = ['gzh', 'xhs', 'douyin'];
  return builtInPlatforms.includes(platformId) &&
         templateId.startsWith(platformId);  // 如 gzh-deep
}

// 调用时优先自定义
function getActiveTemplate(platformId: string) {
  const platform = settings.platforms.find(p => p.id === platformId);
  const customTemplate = platform?.templates.find(t => t.id === platform.defaultTemplateId);

  if (customTemplate) {
    return customTemplate;  // 有自定义优先用
  }

  // 没有自定义，返回内置模板（只读）
  return platform?.templates[0];
}
```

---

## 验证标准

- [ ] 自定义模板保存时触发格式化
- [ ] 有变更时对比弹窗正常显示
- [ ] 用户可选择格式化版或原版
- [ ] 内置模板不可编辑
- [ ] 调用时优先使用自定义模板
- [ ] 没有自定义时调用内置模板
