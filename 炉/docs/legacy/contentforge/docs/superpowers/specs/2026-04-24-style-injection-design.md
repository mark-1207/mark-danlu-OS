# Style Injection into Content Generation — Design Spec

> 日期：2026-04-24
> 状态：待批准

## 问题背景

`style TUI` 已在 create/recreate CLI 层调用，结果（`injectResult`）存入 `context.set('style-inject', injectResult)`。

但 `content-generation.ts` 的 `doExecute` 完全未读取 `style-inject`，风格参数没有注入到生成 prompt，导致风格 TUI 白做了。

此外，碎片库加载时未利用风格关键词，碎片选择与风格相关性不高。

## 目标

1. **P0**：create 和 recreate 的 content-generation 读取 `style-inject`，注入到 LLM prompt
2. **P2**：碎片加载时用风格关键词做相关性排序

## 架构

```
[style-inject] → InjectResult { systemPrompt, constraints }
                              ↓
              [content-generation doExecute]
                              ↓
              systemPrompt = styleInject.systemPrompt + '\n\n' + basePrompt
              constraints  → 拼入 userPrompt 或 systemPrompt
                              ↓
              [LLM 生成] + [碎片库选 examples（keyword 增强）]
```

## InjectResult 结构（已有）

```typescript
interface InjectResult {
  systemPrompt: string;  // 定性风格描述
  constraints: string[]; // 词汇偏好 ["避免使用：首先、其次", "偏好用词：你会发现、真正让人"]
}
```

## 注入策略

- `systemPrompt`：拼在 base system prompt 之前，让 AI 首先看到风格定义
- `constraints`：作为 userPrompt 末尾的约束指令

## 风格关键词提取

```typescript
extractStyleKeywords(profile: StyleProfile | null): string[]
// 从 profile.dimensions 提取：emotionalTone、caseType、logicVsEmotion、高频词前3个
```

传给 `FragmentLoader.getSentenceFragments(..., contextKeywords)` 和 `getParagraphFragments(..., contextKeywords)`，实现相关性排序。

## 数据流

```
styleTUI() → injectStyle(profile) → InjectResult
                                     ↓
                          context.set('style-inject', injectResult)
                                     ↓
                    content-generation doExecute 读取
                                     ↓
                    systemPrompt = styleInject.systemPrompt + basePrompt
                    constraints  → 拼入 userPrompt
                                     ↓
                    FragmentLoader 加载时用 extractStyleKeywords(profile) 做 keyword 排序
```
