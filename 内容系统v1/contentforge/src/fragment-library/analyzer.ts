import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import { llmFactory } from '../llm/factory.js';
import { loadConfig } from '../config/loader.js';
import {
  type SentenceFragment,
  type ParagraphFragment,
  type FragmentExtractionResult,
  SentenceFragmentSchema,
  ParagraphFragmentSchema,
  StyleProfileSchema,
  FragmentManifestEntrySchema,
} from './types.js';
import { getFragmentStore } from './fragment-store.js';
import { safeJsonParse } from '../utils/json-parser.js';

const CORPUS_EDITED = 'corpus/edited';
const CORPUS_EXTERNAL = 'corpus/external';

function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        yield full;
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
}

function inferPlatform(filename: string): SentenceFragment['platform'] {
  const lower = filename.toLowerCase();
  if (lower.includes('wechat') || lower.includes('公众号')) return 'wechat';
  if (lower.includes('xiaohongshu') || lower.includes('小红书')) return 'xiaohongshu';
  if (lower.includes('douyin') || lower.includes('抖音')) return 'douyin';
  return 'universal';
}

// ─── Edited pair analysis ───────────────────────────────────────

interface EditedPair {
  originalPath: string;
  editedPath: string;
  original: string;
  edited: string;
}

async function findEditedPairs(corpusDir: string): Promise<EditedPair[]> {
  const pairs: EditedPair[] = [];

  // Scan edited/ directory
  for await (const editedPath of walkDir(path.join(corpusDir, CORPUS_EDITED))) {
    const relative = path.relative(path.join(corpusDir, CORPUS_EDITED), editedPath);

    // Strip version suffix (_v1, _v2, etc.) to get base name, then look for original
    const versionMatch = relative.match(/^(.+)_v(\d+)\.md$/);
    const baseName = versionMatch ? versionMatch[1] : relative.replace(/\.md$/, '');
    const originalPath = path.join(corpusDir, 'corpus/original', `${baseName}.md`);

    try {
      const [original, edited] = await Promise.all([
        fs.readFile(originalPath, 'utf-8'),
        fs.readFile(editedPath, 'utf-8'),
      ]);
      pairs.push({ originalPath, editedPath, original, edited });
    } catch {
      // Original doesn't exist for this edited file — skip
    }
  }

  return pairs;
}

// ─── External article analysis ──────────────────────────────────

async function findExternalArticles(corpusDir: string): Promise<Array<{ path: string; content: string }>> {
  const articles: Array<{ path: string; content: string }> = [];
  for await (const p of walkDir(path.join(corpusDir, CORPUS_EXTERNAL))) {
    const content = await fs.readFile(p, 'utf-8');
    articles.push({ path: p, content });
  }
  return articles;
}

// ─── LLM-based extraction ───────────────────────────────────────

async function extractFromEditedPair(
  pair: EditedPair,
  provider: ReturnType<typeof llmFactory.build>,
  model: string,
): Promise<FragmentExtractionResult> {
  const prompt = `你是一位内容风格分析专家。从用户的编辑对比中提取写作风格特征。

原始版本：
${pair.original}

用户修改版本：
${pair.edited}

请分析用户做了什么改动，提取以下内容：

1. **句式级改动**（用户改写的具体句式）：
   - 开头钩子：用户如何重写开头？
   - 过渡句：用户用了什么方式连接段落？
   - 金句：用户写了什么有力度的短句？
   - 结尾/CTA：用户如何收尾或召唤行动？

2. **段落级改动**（结构/叙事风格变化）：
   - 开头段落结构变化
   - 论证展开方式变化
   - 情绪曲线设计变化
   - 结尾结构变化

3. **用词偏好变化**：
   - 用户倾向使用的新词汇（相比原文）
   - 用户避免使用的词

输出格式（严格 JSON）：
{
  "sentenceFragments": [{
    "type": "hook|transition|cta|power-line|rhetorical-question|data-opener",
    "text": "用户改写后的具体句式（保留原文语气风格的关键句）",
    "structure": "这个句式的结构描述",
    "source": "edited",
    "sourceFile": "${path.basename(pair.editedPath)}",
    "platform": "universal",
    "tags": ["改写", "用户偏好"]
  }],
  "paragraphFragments": [{
    "type": "opening|argument|emotional-peak|closing|case-study",
    "content": "用户改写后的段落（50-150字）",
    "narrativeStructure": "这段的叙事结构描述",
    "emotionalArc": "这段的情绪弧线",
    "source": "edited",
    "sourceFile": "${path.basename(pair.editedPath)}",
    "platform": "universal",
    "tags": ["改写", "用户偏好"]
  }],
  "styleProfileDelta": {
    "vocabularyWeights": {"新词": 1, "避免的词": -1},
    "emotionalTone": "用户修改后倾向的情绪基调",
    "structuralPreference": "用户偏好的结构风格"
  }
}

只输出 JSON，不要有其他文字。`;

  try {
    const response = await provider.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = safeJsonParse<FragmentExtractionResult>(response.content, 'analyzer.edited');
    return SentenceFragmentSchema.array().parse(parsed.sentenceFragments).length >= 0
      ? parsed
      : { sentenceFragments: [], paragraphFragments: [], styleProfileDelta: {} };
  } catch (e) {
    console.warn(`Failed to analyze edited pair ${pair.editedPath}: ${e}`);
    return { sentenceFragments: [], paragraphFragments: [], styleProfileDelta: {} };
  }
}

async function extractFromExternalArticle(
  article: { path: string; content: string },
  provider: ReturnType<typeof llmFactory.build>,
  model: string,
): Promise<FragmentExtractionResult> {
  const prompt = `你是一位内容质量分析专家。从以下文章中提取可复用的写作结构。

文章：
${article.content.slice(0, 8000)}

请提取以下内容：

1. **句式级提取**：
   - 开头钩子句式（3个最有代表性的）
   - 段落过渡句式（2-3个）
   - 金句（3-5个最有力量的短句）
   - 结尾/CTA 句式（2个）

2. **段落级提取**：
   - 开头段落结构（1-2种）
   - 论证展开方式（1-2种）
   - 情绪曲线设计（1-2种）
   - 结尾结构（1-2种）

3. **用词特征**：
   - 高频使用的有力量感的词

输出格式（严格 JSON）：
{
  "sentenceFragments": [{
    "type": "hook|transition|cta|power-line|rhetorical-question|data-opener",
    "text": "提取的句式（保持原文的语气和风格）",
    "structure": "这个句式的结构描述",
    "source": "external",
    "sourceFile": "${path.basename(article.path)}",
    "platform": "universal",
    "tags": ["外部参考", "可复用"]
  }],
  "paragraphFragments": [{
    "type": "opening|argument|emotional-peak|closing|case-study",
    "content": "提取的段落（50-150字）",
    "narrativeStructure": "这段的叙事结构描述",
    "emotionalArc": "这段的情绪弧线",
    "source": "external",
    "sourceFile": "${path.basename(article.path)}",
    "platform": "universal",
    "tags": ["外部参考", "可复用"]
  }],
  "styleProfileDelta": {
    "vocabularyWeights": {"高频词": 1},
    "emotionalTone": "文章整体的情绪基调"
  }
}

只输出 JSON，不要有其他文字。`;

  try {
    const response = await provider.chat({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = safeJsonParse<FragmentExtractionResult>(response.content, 'analyzer.external');
    return parsed;
  } catch (e) {
    console.warn(`Failed to analyze external article ${article.path}: ${e}`);
    return { sentenceFragments: [], paragraphFragments: [], styleProfileDelta: {} };
  }
}

// ─── Main learn function ────────────────────────────────────────

export async function runFragmentAnalysis(corpusDir: string): Promise<{
  editedAnalyzed: number;
  externalAnalyzed: number;
  fragmentsAdded: number;
}> {
  const config = await loadConfig();

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }

  const provider = llmFactory.get('kimi');
  const model = config.providers['kimi']?.defaultModel ?? 'moonshot-v1-8k';

  const store = getFragmentStore(corpusDir);
  await store.ensureLoaded();

  // Analyze edited pairs
  const pairs = await findEditedPairs(corpusDir);
  let editedAnalyzed = 0;
  let fragmentsAdded = 0;

  for (const pair of pairs) {
    const result = await extractFromEditedPair(pair, provider, model);
    const existingSentences = store.getAllSentences();
    const existingParagraphs = store.getAllParagraphs();
    const addedIds: string[] = [];

    for (const frag of result.sentenceFragments) {
      const dedup = !existingSentences.some(e => e.text === frag.text);
      if (dedup) {
        const id = store.newSentenceId();
        store.addSentence({ ...frag, id, platform: inferPlatform(pair.editedPath) });
        addedIds.push(id);
        fragmentsAdded++;
      }
    }

    for (const frag of result.paragraphFragments) {
      const dedup = !existingParagraphs.some(e => e.content === frag.content);
      if (dedup) {
        const id = store.newParagraphId();
        store.addParagraph({ ...frag, id, platform: inferPlatform(pair.editedPath) });
        addedIds.push(id);
        fragmentsAdded++;
      }
    }

    if (result.styleProfileDelta) {
      store.updateStyleProfile(result.styleProfileDelta);
    }

    // Record manifest entry
    if (addedIds.length > 0) {
      const runId = path.basename(pair.originalPath, '.md');
      store.addManifestEntry(
        FragmentManifestEntrySchema.parse({
          manifestId: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          analyzedAt: new Date().toISOString(),
          sourceType: 'edited-pair',
          sourcePaths: [pair.originalPath, pair.editedPath],
          runId,
          sentenceCount: result.sentenceFragments.length,
          paragraphCount: result.paragraphFragments.length,
          fragmentIds: addedIds,
        }),
      );
    }

    editedAnalyzed++;
  }

  // Analyze external articles
  const externals = await findExternalArticles(corpusDir);
  let externalAnalyzed = 0;

  for (const article of externals) {
    const result = await extractFromExternalArticle(article, provider, model);
    const existingSentences = store.getAllSentences();
    const existingParagraphs = store.getAllParagraphs();
    const addedIds: string[] = [];

    for (const frag of result.sentenceFragments) {
      const dedup = !existingSentences.some(e => e.text === frag.text);
      if (dedup) {
        const id = store.newSentenceId();
        store.addSentence({ ...frag, id, platform: inferPlatform(article.path) });
        addedIds.push(id);
        fragmentsAdded++;
      }
    }

    for (const frag of result.paragraphFragments) {
      const dedup = !existingParagraphs.some(e => e.content === frag.content);
      if (dedup) {
        const id = store.newParagraphId();
        store.addParagraph({ ...frag, id, platform: inferPlatform(article.path) });
        addedIds.push(id);
        fragmentsAdded++;
      }
    }

    if (result.styleProfileDelta) {
      store.updateStyleProfile(result.styleProfileDelta);
    }

    if (addedIds.length > 0) {
      store.addManifestEntry(
        FragmentManifestEntrySchema.parse({
          manifestId: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          analyzedAt: new Date().toISOString(),
          sourceType: 'external',
          sourcePaths: [article.path],
          runId: undefined,
          sentenceCount: result.sentenceFragments.length,
          paragraphCount: result.paragraphFragments.length,
          fragmentIds: addedIds,
        }),
      );
    }

    externalAnalyzed++;
  }

  await store.save();
  return { editedAnalyzed, externalAnalyzed, fragmentsAdded };
}
