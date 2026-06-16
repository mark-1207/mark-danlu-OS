# Style Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 style-inject 接入 create/recreate 的 content-generation，碎片加载加风格关键词排序

**Architecture:**
- `inject.ts`: `extractStyleKeywords()` 从 profile 提取关键词
- `recreate/steps/content-generation.ts`: 读取 style-inject，注入 systemPrompt + constraints，碎片加载加 keyword
- `create/steps/content-generation.ts`: 同上

---

## Task 1: inject.ts 加 extractStyleKeywords

**Files:**
- Modify: `src/scenarios/style/inject.ts`

- [ ] **Step 1: 添加 extractStyleKeywords 函数**

```typescript
export function extractStyleKeywords(profile: StyleProfile | null): string[] {
  if (!profile) return [];
  const { dimensions } = profile;
  const keywords: string[] = [];
  if (dimensions.emotionalTone) keywords.push(dimensions.emotionalTone);
  if (dimensions.narrativeStyle.caseType) keywords.push(dimensions.narrativeStyle.caseType);
  if (dimensions.narrativeStyle.logicVsEmotion) keywords.push(dimensions.narrativeStyle.logicVsEmotion);
  keywords.push(...dimensions.vocabularyWeights.高频词.slice(0, 3));
  return keywords;
}
```

- [ ] **Step 2: Build**

Run: `cd contentforge && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/scenarios/style/inject.ts
git commit -m "feat(style): add extractStyleKeywords for fragment relevance scoring"
```

---

## Task 2: recreate content-generation 接入 style-inject

**Files:**
- Modify: `src/scenarios/recreate/steps/content-generation.ts`

- [ ] **Step 1: 添加 import**

```typescript
import { injectStyle, extractStyleKeywords, type InjectResult } from '../../style/inject.js';
```

- [ ] **Step 2: 修改 doExecute**

在 doExecute 开头读取 style-inject：

```typescript
const styleInject = context.get<InjectResult>('style-inject');
const styleKeywords = extractStyleKeywords(styleInject ? styleInject.constraints as unknown as { dimensions: { emotionalTone: string; narrativeStyle: { caseType: string; logicVsEmotion: string }; vocabularyWeights: { 高频词: string[] } } } : null);
```

（说明：injectResult 本身不含 profile，constraints 只是字符串数组，所以从 styleInject.constraints 提取关键词不够准确。更简单的方式是让 InjectResult 也包含 profile 引用，或者直接传 styleKeywords=[]。这里先用空数组 fallback，等 Task 3 统一处理。）

不对——更准确的做法是：style-inject 存入的是 `StyleSelection { profile, injectResult }`，profile 在 CLI 层。应该把 profile 也存入 context，或者 injectResult 里包含 keywords。

看 create.ts 的 styleTUI 返回值：
```typescript
const { profile, injectResult } = await styleTUI({ stylesDir, corpusDir });
context.set('style-inject', injectResult);
```

injectResult 是 `{ systemPrompt, constraints }`，不含 profile。所以需要把 profile 也存入 context，比如 `context.set('style-profile', profile)`。

**调整方案**：在 CLI 层，存入两个 key：
- `style-inject`: `{ systemPrompt, constraints }`
- `style-profile`: `StyleProfile`

这样 content-generation 读取 `style-profile` 调用 `extractStyleKeywords`。

- [ ] **Step 2a: 修改 CLI 存入 style-profile**

在 create.ts 和 recreate.ts 的 styleTUI 调用后加：
```typescript
context.set('style-profile', styleResult.profile);
```

- [ ] **Step 2b: 修改 doExecute**

```typescript
const styleInject = context.get<InjectResult>('style-inject');
const styleProfile = context.get<StyleProfile>('style-profile');
const styleKeywords = extractStyleKeywords(styleProfile ?? null);

// Build system prompt
let systemPrompt = promptLoader.render(template.system, {});
if (styleInject) {
  systemPrompt = styleInject.systemPrompt + '\n\n' + systemPrompt;
}

// Build constraints section
let constraintsSection = '';
if (styleInject && styleInject.constraints.length > 0) {
  constraintsSection = '\n\n## 风格约束\n' + styleInject.constraints.map(c => `- ${c}`).join('\n');
}

// Fragment loading with style keywords
const sentences = loader.getSentenceFragments(undefined, 'universal', 5, styleKeywords.length > 0 ? styleKeywords : undefined);
const paragraphs = loader.getParagraphFragments(undefined, 'universal', 3, styleKeywords.length > 0 ? styleKeywords : undefined);
```

- [ ] **Step 3: Build**

Run: `cd contentforge && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/scenarios/recreate/steps/content-generation.ts src/cli/commands/recreate.ts
git commit -m "feat(recreate): inject style profile into content generation prompt"
```

---

## Task 3: create content-generation 接入 style-inject

**Files:**
- Modify: `src/scenarios/create/steps/content-generation.ts`
- Modify: `src/cli/commands/create.ts`

- [ ] **Step 1: create.ts CLI 层加 style-profile 存入**

在 styleTUI 调用后加 `context.set('style-profile', styleResult.profile)`

- [ ] **Step 2: create/steps/content-generation.ts 加 import**

```typescript
import { injectStyle, extractStyleKeywords, type InjectResult } from '../../style/inject.js';
import type { StyleProfile } from '../../style/types.js';
```

- [ ] **Step 3: 三个平台 Wechat/Xiaohongshu/Douyin 的 doExecute 各加风格注入**

以 Wechat 为例，修改 doExecute：
```typescript
const styleInject = context.get<InjectResult>('style-inject');
const styleProfile = context.get<StyleProfile>('style-profile');
const styleKeywords = extractStyleKeywords(styleProfile ?? null);

let systemPrompt = promptLoader.render(template.system, {});
if (styleInject) {
  systemPrompt = styleInject.systemPrompt + '\n\n' + systemPrompt;
}

let constraintsSection = '';
if (styleInject && styleInject.constraints.length > 0) {
  constraintsSection = '\n\n## 风格约束\n' + styleInject.constraints.map(c => `- ${c}`).join('\n');
}
```

userPrompt 末尾加 constraintsSection。

注意：create 的 content-generation 目前没有碎片加载逻辑，碎片加载是 recreate 独用的（P2 只改 recreate 即可）。

- [ ] **Step 4: Build**

Run: `cd contentforge && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/scenarios/create/steps/content-generation.ts src/cli/commands/create.ts
git commit -m "feat(create): inject style profile into content generation prompt"
```

---

## Task 4: 验证

- [ ] `npm run build` 通过
- [ ] `node dist/index.js create --keyword "AI" --no-interactive` 正常跑完

---

## 执行顺序

1. Task 1: inject.ts 加 extractStyleKeywords
2. Task 2: recreate 接入 style-inject + style-profile
3. Task 3: create 接入 style-inject + style-profile
4. Task 4: 验证

---

## Plan Complete
