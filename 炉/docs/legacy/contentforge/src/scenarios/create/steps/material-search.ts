import { z } from 'zod';
import { PipelineStep } from '../../../core/step.js';
import { PipelineContext } from '../../../core/context.js';
import type { LLMProvider } from '../../../llm/types.js';
import { getCachedConfig } from '../../../config/loader.js';
import { callWithFallback } from '../../../utils/llm-call.js';
import { logger } from '../../../utils/logger.js';
import { ObsidianMaterialStore } from './obsidian-material-store.js';
import {
  MaterialSearchOutputSchema,
  type MaterialSearchOutput,
  type Material,
  type WechatOutline,
  type XiaohongshuOutline,
  type DouyinOutline,
  type PlatformAssignments,
  type TopicAnalysis,
} from '../types.js';

const InputSchema = z.object({
  // No required input — reads from context
  _unused: z.string().optional(),
});

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchProvider {
  name: string;
  search: (queries: string[], apiKey: string) => Promise<SearchResult[]>;
}

/**
 * Tavily search provider
 */
const tavilyProvider: SearchProvider = {
  name: 'tavily',
  async search(queries: string[], apiKey: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const query of queries.slice(0, 3)) {
      try {
        const response = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ query, search_depth: 'basic', max_results: 3 }),
        });
        if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);
        const data = await response.json() as { results: Array<{ title: string; url: string; content: string }> };
        for (const item of data.results ?? []) {
          results.push({ title: item.title, url: item.url, snippet: item.content });
        }
      } catch (err) {
        logger.warn('[material-search] Tavily query failed:', String(err));
      }
    }
    return results;
  },
};

/**
 * Serper search provider (Google Serper.dev)
 */
const serperProvider: SearchProvider = {
  name: 'serper',
  async search(queries: string[], apiKey: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const query of queries.slice(0, 3)) {
      try {
        const response = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
          body: JSON.stringify({ q: query, num: 3 }),
        });
        if (!response.ok) throw new Error(`Serper API error: ${response.status}`);
        const data = await response.json() as { organic: Array<{ title: string; link: string; snippet: string }> };
        for (const item of data.organic ?? []) {
          results.push({ title: item.title, url: item.link, snippet: item.snippet });
        }
      } catch (err) {
        logger.warn('[material-search] Serper query failed:', String(err));
      }
    }
    return results;
  },
};

/**
 * Bing search provider
 */
const bingProvider: SearchProvider = {
  name: 'bing',
  async search(queries: string[], apiKey: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (const query of queries.slice(0, 3)) {
      try {
        const encoded = encodeURIComponent(query);
        const response = await fetch(
          `https://api.bing.microsoft.com/v7.0/search?q=${encoded}&count=3`,
          { headers: { 'Ocp-Apim-Subscription-Key': apiKey } },
        );
        if (!response.ok) throw new Error(`Bing API error: ${response.status}`);
        const data = await response.json() as { webPages: { value: Array<{ name: string; url: string; snippet: string }> } };
        for (const item of data.webPages?.value ?? []) {
          results.push({ title: item.name, url: item.url, snippet: item.snippet });
        }
      } catch (err) {
        logger.warn('[material-search] Bing query failed:', String(err));
      }
    }
    return results;
  },
};

function getSearchProvider(providerName: string): SearchProvider | null {
  if (providerName === 'tavily') return tavilyProvider;
  if (providerName === 'serper') return serperProvider;
  if (providerName === 'bing') return bingProvider;
  return null;
}

/**
 * Strip prompt framing from caseSlot text to produce concise search keywords.
 * "需要一个中年白领失业后情绪崩溃的真实案例（可虚构但需细节）"
 *   → "中年白领失业后情绪崩溃"
 */
function extractSearchTerms(text: string): string {
  // Remove parenthetical notes like （可虚构但需细节）, （可虚构）, （来源：XX）
  let cleaned = text.replace(/[（(][^）)]*[）)]/g, '');
  // Remove "需要" / "需要一个" / "一个" prefixed noun framing
  cleaned = cleaned.replace(/^(需要)?一个/, '');
  // Remove "如" / "比如" / "例如" trailing examples
  cleaned = cleaned.replace(/[，,]\s*(如|比如|例如).*$/, '');
  // Remove "说明"/"展示"/"引出"/"反映" leading verbs (keep the object)
  cleaned = cleaned.replace(/^(说明|展示|引出|反映|描述|分析|介绍|呈现|讨论)/, '');
  // Trim and limit to 30 chars — short queries work better
  return cleaned.trim().slice(0, 30);
}

/**
 * Extract search queries from platform outlines and assignments
 */
export function extractQueriesFromOutlines(
  assignments: PlatformAssignments,
  outlines: { wechat?: WechatOutline; xiaohongshu?: XiaohongshuOutline; douyin?: DouyinOutline },
  keyword: string,
): Record<string, string[]> {
  const queries: Record<string, string[]> = { wechat: [], xiaohongshu: [], douyin: [] };

  // WeChat: extract from section case slots and key points
  if (outlines.wechat) {
    for (const section of outlines.wechat.sections ?? []) {
      if (section.caseSlot && !section.caseSlot.includes('无需') && !section.caseSlot.includes('不需要')) {
        const terms = extractSearchTerms(section.caseSlot);
        queries.wechat.push(`${keyword} ${terms || section.title}`);
      }
      for (const point of section.keyPoints ?? []) {
        if (point.length > 5) queries.wechat.push(`${keyword} ${point}`);
      }
    }
  }

  // Xiaohongshu: tips often need real examples
  if (outlines.xiaohongshu) {
    for (const tip of outlines.xiaohongshu.tips ?? []) {
      queries.xiaohongshu.push(`${keyword} ${tip.title}`);
    }
  }

  // Douyin: core point and mini case
  if (outlines.douyin) {
    if (outlines.douyin.corePoint?.statement) {
      queries.douyin.push(`${keyword} ${outlines.douyin.corePoint.statement}`);
    }
    if (outlines.douyin.miniCase) {
      queries.douyin.push(`${keyword} ${outlines.douyin.miniCase}`);
    }
  }

  // Deduplicate and limit
  for (const platform of ['wechat', 'xiaohongshu', 'douyin'] as const) {
    queries[platform] = [...new Set(queries[platform])].slice(0, 4);
  }

  return queries;
}

/**
 * Extract just the case slot text strings from an outline (for obsidian semantic search).
 * Returns array of slot texts, deduplicated.
 */
function extractCaseSlotTexts(outline: WechatOutline | XiaohongshuOutline | DouyinOutline | undefined): string[] {
  const slots: string[] = [];

  if (!outline) return slots;

  if ('sections' in outline) {
    for (const section of (outline as WechatOutline).sections ?? []) {
      if (section.caseSlot && !section.caseSlot.includes('无需') && !section.caseSlot.includes('不需要')) {
        slots.push(section.caseSlot);
      }
    }
  }

  if ('tips' in outline) {
    for (const tip of (outline as XiaohongshuOutline).tips ?? []) {
      if (tip.caseSlot && !tip.caseSlot.includes('无需') && !tip.caseSlot.includes('不需要')) {
        slots.push(tip.caseSlot);
      }
    }
  }

  if ('miniCase' in outline) {
    const douyin = outline as DouyinOutline;
    if (douyin.miniCase) slots.push(douyin.miniCase);
    if (douyin.corePoint?.statement) slots.push(douyin.corePoint.statement);
  }

  return [...new Set(slots)];
}

/**
 * Use LLM to extract materials from raw search results
 */
/**
 * Extract the first JSON array from LLM output, tolerating trailing garbage.
 * Handles: markdown fences, leading text, trailing explanations, single objects.
 */
function extractJsonArray(raw: string): unknown[] | null {
  let text = raw.trim();
  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();

  // Try to find a JSON array first
  const arrStart = text.indexOf('[');
  if (arrStart !== -1) {
    let depth = 0;
    for (let i = arrStart; i < text.length; i++) {
      if (text[i] === '[') depth++;
      else if (text[i] === ']') depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(arrStart, i + 1));
          if (Array.isArray(parsed)) return parsed;
        } catch { /* continue to try single object */ }
        break;
      }
    }
  }

  // Fallback: try parsing as a single JSON object and wrap in array
  const objStart = text.indexOf('{');
  if (objStart !== -1) {
    let depth = 0;
    for (let i = objStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(objStart, i + 1));
          if (parsed && typeof parsed === 'object') return [parsed];
        } catch { /* give up */ }
        break;
      }
    }
  }

  return null;
}

async function extractMaterials(
  _provider: LLMProvider,
  _defaultModel: string,
  platform: 'wechat' | 'xiaohongshu' | 'douyin',
  outlineSection: string,
  searchResults: SearchResult[],
  assignment: string,
): Promise<Material[]> {
  if (searchResults.length === 0) return [];

  const snippetText = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join('\n\n');

  const systemPrompt = `You are a research assistant extracting useful materials from web search results.
For the ${platform} platform, extract data, cases, quotes, or stories that can support content creation.
Only extract information that is relevant, specific, and credible.
Return a JSON array.`;

  const userPrompt = `Platform: ${platform}
Content angle: ${assignment}
Outline section needing support: ${outlineSection}

Search results:
${snippetText}

Extract materials (max 2) that can support this section. Each material should have:
- forSection: brief description of which part this supports
- type: "data", "case", "quote", or "story"
- content: the actual content (data, case, quote, or story summary)
- source: the source URL or name
- reliability: "high", "medium", or "low" (based on source credibility)

Return a JSON array like:
[
  {"forSection": "...", "type": "case", "content": "...", "source": "...", "reliability": "high"}
]

Return ONLY valid JSON, no markdown.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  // callWithFallback: primary(openai/mimo) → fallback(kimi), auto jsonMode retry
  try {
    const content = await callWithFallback(messages, {
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });

    const parsed = extractJsonArray(content);
    if (parsed) {
      return parsed.filter(
        (m): m is Material =>
          m != null && typeof m === 'object' && 'type' in m && 'content' in m && 'source' in m,
      );
    }
    logger.warn(`[material-search] no JSON array found in LLM response for ${platform}: ${content.slice(0, 200)}`);
  } catch (err) {
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    logger.warn(`[material-search] LLM extraction failed for ${platform}: ${errMsg}`);
  }

  return [];
}

export class MaterialSearchStep extends PipelineStep<z.infer<typeof InputSchema>, MaterialSearchOutput> {
  config = {
    name: 'material-search',
    description: 'Search for reference materials across platforms using search APIs',
    optional: true,
    retries: 0,
  };

  inputSchema = InputSchema;
  outputSchema = MaterialSearchOutputSchema;

  constructor(provider: LLMProvider, defaultModel: string) {
    super(provider, defaultModel);
  }

  protected async doExecute(_input: z.infer<typeof InputSchema>, context: PipelineContext): Promise<MaterialSearchOutput> {
    const config = getCachedConfig();
    const searchConfig = config.search;

    // If search is disabled, return empty
    if (!searchConfig?.enabled) {
      logger.info('[Step:material-search] search disabled, skipping');
      return { wechat: [], xiaohongshu: [], douyin: [] };
    }

    const apiKey =
      searchConfig.apiKey ??
      process.env.TAVILY_API_KEY ??
      process.env.SERPER_API_KEY ??
      process.env.BING_API_KEY ??
      '';
    if (!apiKey) {
      logger.warn('[Step:material-search] no search API key found, skipping');
      return { wechat: [], xiaohongshu: [], douyin: [] };
    }

    const providerName = searchConfig.provider ?? 'tavily';
    const searcher = getSearchProvider(providerName);
    if (!searcher) {
      logger.warn(`[Step:material-search] unknown provider: ${providerName}, skipping`);
      return { wechat: [], xiaohongshu: [], douyin: [] };
    }

    // Read from context (set by previous steps)
    const topicAnalysis = context.get<TopicAnalysis>('topic-analysis');
    const assignments = context.get<PlatformAssignments>('topic-assignment');

    // Only require the outlines that were actually generated (partial platform selection OK)
    const outlineWechat = context.get<WechatOutline>('outline-wechat');
    const outlineXiaohongshu = context.get<XiaohongshuOutline>('outline-xiaohongshu');
    const outlineDouyin = context.get<DouyinOutline>('outline-douyin');

    if (!assignments || (!outlineWechat && !outlineXiaohongshu && !outlineDouyin)) {
      logger.warn('[Step:material-search] missing context data (assignments or outlines), skipping');
      return { wechat: [], xiaohongshu: [], douyin: [] };
    }

    const keyword = topicAnalysis?.keyword ?? 'this topic';
    const outlines = {
      wechat: outlineWechat,
      xiaohongshu: outlineXiaohongshu,
      douyin: outlineDouyin,
    };
    const queries = extractQueriesFromOutlines(assignments, outlines, keyword);

    const results: MaterialSearchOutput = { wechat: [], xiaohongshu: [], douyin: [] };

    const platforms: Array<{ key: 'wechat' | 'xiaohongshu' | 'douyin'; assignment: string }> = [
      { key: 'wechat', assignment: assignments.wechat?.angle ?? '' },
      { key: 'xiaohongshu', assignment: assignments.xiaohongshu?.angle ?? '' },
      { key: 'douyin', assignment: assignments.douyin?.angle ?? '' },
    ];

    // Phase 1: Obsidian local material channel (primary source)
    if (searchConfig.obsidianEnabled) {
      const store = new ObsidianMaterialStore();
      try {
        await store.loadIndex();
      } catch {
        logger.warn('[Step:material-search] obsidian store loadIndex failed, skipping obsidian channel');
      }

      const topK = searchConfig.obsidianTopK ?? 3;
      for (const { key } of platforms) {
        const slotTexts = extractCaseSlotTexts(outlines[key]);
        for (const slot of slotTexts.slice(0, 3)) {
          const matches = await store.search(slot, topK);
          for (const m of matches) {
            results[key].push({
              forSection: m.filePath,
              type: 'case',
              content: m.content,
              source: `obsidian:${m.filePath}`,
              reliability: 'high',
            });
          }
        }
      }

      logger.info('[Step:material-search] obsidian channel completed', {
        wechat: results.wechat.length,
        xiaohongshu: results.xiaohongshu.length,
        douyin: results.douyin.length,
      });
    }

    // Phase 2: Web search supplement (only when obsidian results are sparse)
    for (const { key, assignment } of platforms) {
      if (results[key].length >= 2) continue;

      const platformQueries = queries[key];
      if (platformQueries.length === 0) continue;

      logger.info(`[Step:material-search] obsidian sparse for ${key} (${results[key].length} items), supplementing with web search`);

      const searchResults = await searcher.search(platformQueries, apiKey);
      if (searchResults.length === 0) {
        logger.info(`[Step:material-search] no web results for ${key}`);
        continue;
      }

      // Build section description for LLM extraction
      const outline = outlines[key];
      const sectionDesc =
        key === 'wechat'
          ? (outline as WechatOutline).sections?.map((s) => s.title).join(', ') ?? ''
          : key === 'xiaohongshu'
          ? (outline as XiaohongshuOutline).tips?.map((t) => t.title).join(', ') ?? ''
          : (outline as DouyinOutline).corePoint?.statement ?? '';

      const materials = await extractMaterials(
        this.provider,
        this.defaultModel,
        key,
        sectionDesc,
        searchResults,
        assignment,
      );

      // Prefix web sources with 'web:' for clear attribution
      for (const m of materials) {
        results[key].push({ ...m, source: `web:${m.source}` });
      }
    }

    logger.info('[Step:material-search] completed', {
      wechat: results.wechat.length,
      xiaohongshu: results.xiaohongshu.length,
      douyin: results.douyin.length,
    });

    return results;
  }
}
