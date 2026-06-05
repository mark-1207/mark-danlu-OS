import { Command } from 'commander';
import { runCreate } from './create.js';
import { runRecreate } from './recreate.js';
import { runOpinion } from '../../scenarios/opinion/index.js';
import { logger } from '../../utils/logger.js';

export interface IntentResult {
  type: 'create' | 'recreate' | 'opinion';
  keyword?: string;
  inputPath?: string;
  opinion?: string;  // present when type === 'opinion'
  platforms: string[];
  direction?: 'auto' | 'interactive';
}

const RECREATE_INTENT_PATTERNS: Array<{ pattern: RegExp; platform?: string }> = [
  { pattern: /二创/i },
  { pattern: /改写/i },
  { pattern: /爆款/i },
  { pattern: /rewrite/i },
];

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /公众号|微信(?![豪])|wechat/i, platform: 'wechat' },
  { pattern: /小红书|xhs|种草/i, platform: 'xiaohongshu' },
  { pattern: /抖音|douyin/i, platform: 'douyin' },
];

const ALL_PLATFORMS = ['wechat', 'xiaohongshu', 'douyin'];

const ALL_PATTERN = /三平台|全部平台|三个平台|所有平台/i;

// Opinion detection: 判断句式、问号、讨论关键词
const OPINION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\?$/, reason: 'ends with question mark' },
  { pattern: /[？]$/, reason: 'ends with Chinese question mark' },
  { pattern: /凭什么|为什么|怎么可/i, reason: 'challenge question pattern' },
  { pattern: /讨论|分析|聊聊|说说|聊聊.*[我想觉得认为]/i, reason: 'discussion keyword' },
];

// 判断句式：包含"是"/"不是"/"才是"等判断词，且短输入（<30字）
const JUDGMENT_INDICATORS = /是|不是|才是|不是\s*而|倒不如|本应是|其实是|说到底是|说白了/i;
const SHORT_JUDGMENT_THRESHOLD = 30;

/**
 * Extract file path from text, supporting formats like:
 * - "改写这个文章：d:/path/file.md"
 * - "二创：d:/path/file.md"
 * - "d:/path/file.md"
 */
function extractFilePath(text: string): string | undefined {
  // Try "：path" or ":path" pattern after intent keywords
  const colonMatch = text.match(/[：:]\s*([A-Za-z]:[\\/][^\s\x00-\x1f]+)/);
  if (colonMatch) return colonMatch[1];

  // Try bare .md path
  const mdMatch = text.match(/([A-Za-z]:[\\/][^\s]+?\.md)/i);
  if (mdMatch) return mdMatch[1];

  return undefined;
}

/**
 * Check if text contains a file path (any extension)
 */
function hasFilePath(text: string): boolean {
  return /[A-Za-z]:[\\/][^\s]+/.test(text);
}

/**
 * Check if text contains recreation intent keywords
 */
function hasRecreateIntent(text: string): boolean {
  return RECREATE_INTENT_PATTERNS.some(({ pattern }) => pattern.test(text));
}

/**
 * Detect opinion intent.
 * Triggers when:
 * - Ends with question mark (?)
 * - Contains challenge question patterns (凭什么/为什么/怎么可)
 * - Contains discussion keywords (讨论/分析/聊聊)
 * - Short input (<30 chars) with judgment words (是/不是/才是)
 */
function hasOpinionIntent(text: string): boolean {
  const trimmed = text.trim();
  // Question mark anywhere → opinion question (strip platform words in post-processing)
  if (/[？?]/.test(trimmed)) return true;
  if (/凭什么|为什么|怎么可/i.test(trimmed)) return true;
  if (/讨论|分析|聊聊|说说|我的看法是/i.test(trimmed)) return true;
  if (trimmed.length <= SHORT_JUDGMENT_THRESHOLD && JUDGMENT_INDICATORS.test(trimmed)) return true;
  return false;
}

/**
 * Parse natural language input to determine intent.
 * No LLM needed — pure pattern matching.
 *
 * Recreation is triggered if EITHER:
 * - text contains a .md file path, OR
 * - text contains recreation intent keywords (二创/改写/爆款/rewrite)
 */
export function parseIntent(text: string): IntentResult {
  const trimmed = text.trim();

  // Extract platforms mentioned
  const platforms: string[] = [];
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(trimmed)) {
      platforms.push(platform);
    }
  }

  // Extract file path
  const inputPath = extractFilePath(trimmed);
  const hasFile = hasFilePath(trimmed);
  const hasIntent = hasRecreateIntent(trimmed);
  const hasOpinion = hasOpinionIntent(trimmed);

  // Detect direction
  const isInteractive = /手动|自己选|选择/i.test(trimmed);
  const direction: 'auto' | 'interactive' = isInteractive ? 'interactive' : 'auto';

  // Opinion intent: check FIRST (higher priority than create/recreate for opinion inputs)
  if (hasOpinion && !hasIntent && !inputPath) {
    // Strip opinion trigger words and platform words to get clean opinion text
    let opinion = trimmed
      .replace(/^(讨论|分析|聊聊|说说)[：:]\s*/i, '')
      .replace(/凭什么|为什么|怎么可/g, '')
      .replace(/\s*[？?].*$/, '')  // strip from question mark onwards
      .trim();
    if (opinion.length < 2) opinion = trimmed.replace(/\s*[？?]\s*$/, '').trim();

    const result: IntentResult = {
      type: 'opinion',
      opinion: opinion.length > 1 ? opinion : trimmed,
      platforms: platforms.length > 0 ? platforms : ALL_PLATFORMS,
      direction,
    };
    logger.debug(`[skill] intent: opinion, opinion="${result.opinion}", platforms=${result.platforms.join(',')}`);
    return result;
  }

  // Intent logic: OR condition — path OR intent keyword triggers recreate
  if (inputPath || hasIntent) {
    // recreate
    const result: IntentResult = {
      type: 'recreate',
      inputPath: inputPath ?? undefined,
      platforms: platforms.length > 0 ? platforms : ALL_PLATFORMS,
      direction,
    };
    logger.debug(`[skill] intent: recreate, path=${inputPath}, hasIntent=${hasIntent}, platforms=${result.platforms.join(',')}`);
    return result;
  }

  // create — extract keyword by removing intent words, platform words, and punctuation
  const intentWords = /帮我|写一篇|生成|创作|搞一个|关于|发|到|给|把|帮我|请|给我/i;
  const platformWords = /公众号|微信|小红书|抖音|种草|douyin|wechat|xhs|三平台|全部平台|三个平台|所有平台/gi;
  const punctuation = /[，。！？、；："'""'''，、…【】《》（）(){}[\],!?]/gi;

  let keyword = trimmed
    .replace(punctuation, ' ')
    .replace(platformWords, ' ')
    .replace(intentWords, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If nothing meaningful remained (e.g. user just said "公众号"), use whole text
  const result: IntentResult = {
    type: 'create',
    keyword: keyword.length > 1 ? keyword : trimmed,
    platforms: platforms.length > 0 ? platforms : ALL_PLATFORMS,
  };
  logger.debug(`[skill] intent: create, keyword="${keyword}", platforms=${result.platforms.join(',')}`);
  return result;
}

export async function runSkill(
  input: string,
  options: { auto?: boolean; phase?: 'full' | 'outline' | 'material-gap' | 'content-draft' | 'content' | 'review'; runId?: string } = {},
): Promise<void> {
  const intent = parseIntent(input);

  if (intent.type === 'create') {
    if (!intent.keyword) {
      throw new Error('无法从输入中提取主题关键词，请重新描述。例如：帮我写一篇关于AI的文章');
    }
    const platforms = intent.platforms.join(',');
    await runCreate(intent.keyword, {
      platforms: platforms || undefined,
      context: undefined,
      interactive: options.auto === true ? false : undefined,
      phase: options.phase ?? 'full',
      runId: options.runId,
    });
  } else if (intent.type === 'opinion') {
    await runOpinion(intent.opinion ?? input, {
      platforms: intent.platforms,
      interactive: options.auto === true ? false : undefined,
      phase: (options.phase ?? 'full') as 'content' | 'review' | 'full' | 'refine' | 'review-only',
      runId: options.runId,
    });
  } else {
    if (!intent.inputPath) {
      throw new Error('无法从输入中提取文章路径，请包含 .md 文件路径。例如：帮我二创：d:/文章.md');
    }
    await runRecreate(intent.inputPath, intent.direction ?? 'auto', intent.platforms);
  }
}

export function registerSkillCommand(program: Command): void {
  program
    .command('skill')
    .description('自然语言统一入口：描述需求即可，自动判断原创/二创及目标平台')
    .argument('<text>', '自然语言描述，例如：帮我写一篇关于AI的文章 发公众号')
    .option('--auto', '使用默认选项全自动运行（无需确认，适合 CI/快速测试）')
    .option('--phase <phase>', '运行阶段: outline | material-gap | content-draft | content | review | full', 'full')
    .option('--run-id <id>', '指定 run ID（phase=content 时必填）')
    .action(async (text: string, opts: { auto?: boolean; phase?: string; runId?: string }) => {
      try {
        await runSkill(text, {
          auto: opts.auto,
          phase: (opts.phase as 'full' | 'outline' | 'content') ?? 'full',
          runId: opts.runId,
        });
      } catch (error) {
        logger.error('skill command failed', { error: String(error) });
        console.error(`错误: ${error}`);
        process.exit(1);
      }
    });
}
