# 质检报告UI重构 - 设计文档

**日期**: 2026-03-26
**状态**: 待实施
**任务**: F) 质检报告UI展示优化

---

## 核心理念

**质检维度的定义权在 qualityPrompt 模板，不在 UI**

- 用户修改模板 → AI 返回的维度随之变化
- UI 必须做成**动态的**，无论模板返回什么都能正确展示
- 不再假设固定6维度，按实际渲染

---

## 类型定义

```typescript
// 动态维度
interface Dimension {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'pass' | 'warning' | 'fail';
  evidence?: string;
  reason: string;
}

// 动态清单项
interface ChecklistItem {
  id: string;
  name: string;
  passed: boolean | 'partial';
  reason: string;
  evidence?: string;
  position?: string;
}

// 动态优化建议
interface OptimizationSuggestion {
  id: string;
  content: string;
  position?: string;
  priority: 'high' | 'medium' | 'low';
  original?: string;
  optimized?: string;
  logic?: string;
}

// 统一质检报告
interface QualityReport {
  overallScore: number;
  grade: 'excellent' | 'good' | 'average' | 'poor';
  dimensions: Dimension[];
  checklist: ChecklistItem[];
  optimizationSuggestions: OptimizationSuggestion[];
}
```

---

## 架构设计

```
OptimizationReportPage
├── LeftPanel (生成内容)
│   └── ContentViewer (可滚动定位 + 高亮)
│
└── RightPanel (质检报告)
    ├── OverallScoreCard (整体评分)
    ├── DimensionList (动态维度)
    │   └── DimensionBar (单维度条形)
    ├── Checklist (动态清单)
    │   └── ChecklistItem (支持定位)
    ├── SuggestionList (动态建议)
    │   └── SuggestionCard (展开/收起 + 对照)
    └── OptimizeButton (一键优化)

CompareModal (优化对比浮层)
└── OriginalOptimizedCompare (原文→优化对照)
```

---

## 组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| OverallScoreCard | QualityReport/OverallScoreCard.tsx | 整体评分展示 |
| DimensionBar | QualityReport/DimensionBar.tsx | 单维度条形图 |
| DimensionList | QualityReport/DimensionList.tsx | 动态维度容器 |
| ChecklistItem | QualityReport/ChecklistItem.tsx | 清单项 + 定位 |
| SuggestionCard | QualityReport/SuggestionCard.tsx | 建议卡 + 对照 |
| OriginalOptimizedCompare | QualityReport/OriginalOptimizedCompare.tsx | 差异高亮对照 |
| ContentViewer | QualityReport/ContentViewer.tsx | 左侧内容 + 定位 |

---

## 交互设计

### 1. Evidence 点击定位

```
用户在右侧清单点击「定位」
  → 左侧内容滚动到对应段落
  → 高亮显示 2 秒后淡出
```

### 2. 优化建议展开

```
用户点击「查看详情」
  → 展开原文→优化对照
  → 差异文字高亮显示

用户点击「应用到正文」
  → 替换正文内容
```

### 3. 一键优化对比

```
优化后显示 CompareModal
  ├── 左侧：优化前内容
  ├── 右侧：优化后内容
  └── 底部：使用原版 / 使用优化版
```

---

## 实施步骤

### Phase 1: 类型和解析层
- [ ] 重构 QualityReport 类型为动态结构
- [ ] 重写 transformQualityResponse 为透传模式
- [ ] 修复优化建议解析 (original/optimized)

### Phase 2: 基础组件
- [ ] 创建 DimensionBar.tsx
- [ ] 创建 OverallScoreCard.tsx
- [ ] 创建 ContentViewer.tsx (滚动定位)

### Phase 3: 清单和建议组件
- [ ] 创建 ChecklistItem.tsx
- [ ] 创建 OriginalOptimizedCompare.tsx
- [ ] 创建 SuggestionCard.tsx

### Phase 4: 容器组件
- [ ] 创建 DimensionList.tsx
- [ ] 创建 SuggestionList.tsx (如需要)

### Phase 5: 页面集成
- [ ] 重构 OptimizationReportPage.tsx
- [ ] 移除 RadarChart
- [ ] 移除硬编码的6维度

### Phase 6: 对比浮层
- [ ] 重构 CompareModal.tsx

### Phase 7: 测试验证
- [ ] 测试各平台维度动态显示
- [ ] 测试 evidence 点击定位
- [ ] 测试 original/optimized 对照
