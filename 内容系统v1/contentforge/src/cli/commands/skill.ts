import { Command } from 'commander';
import { runCreate } from './create.js';
import { runRecreate } from './recreate.js';
import { logger } from '../../utils/logger.js';

export interface IntentResult {
  type: 'create' | 'recreate';
  keyword?: string;
  inputPath?: string;
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

  // Detect direction
  const isInteractive = /手动|自己选|选择/i.test(trimmed);
  const direction: 'auto' | 'interactive' = isInteractive ? 'interactive' : 'auto';

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
  options: { auto?: boolean; phase?: 'full' | 'outline' | 'content'; runId?: string } = {},
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
    .option('--phase <phase>', '运行阶段: full | outline | content', 'full')
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
