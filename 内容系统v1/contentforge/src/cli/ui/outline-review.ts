import { createInterface } from 'readline';
import chalk from 'chalk';
import { isTerminalInteractive, getNextAnswer } from './interactive.js';
import type { WechatOutline, XiaohongshuOutline, DouyinOutline } from '../../scenarios/create/types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlatformOutlines {
  wechat: WechatOutline;
  xiaohongshu: XiaohongshuOutline;
  douyin: DouyinOutline;
}

export interface PlatformOutlinesConfirmed {
  wechat?: PlatformOutlineConfirmed;
  xiaohongshu?: PlatformOutlineConfirmed;
  douyin?: PlatformOutlineConfirmed;
}

export interface PlatformOutlineConfirmed {
  title: string;
  caseDirection: string;
  structureType: string;
  seedMaterial: string;
}

export interface ContentConfirmResult {
  action: 'ok' | 'mark' | 'rewrite';
  markedParagraphs?: number[];
}

export interface StructureRecommendation {
  structure: string;
  reason: string;
}

// ─── 14 种论述结构 ──────────────────────────────────────────────────────────

const STRUCTURES = [
  '并列式',      // 几个独立观点平铺（适合"5个方法"类）
  '递进式',      // 层层深入（适合深度分析）
  '对比式',      // 正反对比（适合争议性话题）
  '故事线',      // 以一个真实故事为主线贯穿
  '总分总',      // 结论先行 + 分点论证 + 升华收尾
  '问题解决式',  // 问题→分析→解法
  '清单罗列式',  // 实用清单，逐条说明
  '金字塔式',    // 结论先行，然后分层论证
  '时间线式',    // 按时间顺序叙事
  '场景还原式',  // 从一个具体场景切入，再层层展开
  'AIDA式',      // Attention→Interest→Desire→Action
  '前后对比式',  // Before/After 结构
  '专家访谈式',  // Q&A 对话结构
  '清单行动式',  // 先结论清单，再逐条展开讲why
] as const;

// ─── Structure Recommendation Engine ──────────────────────────────────────────

const STORY_KEYWORDS = ['故事', '经历', '案例', '真人', '朋友说', '我曾经', '他是怎么', '主人公'];
const LIST_KEYWORDS = ['方法', '技巧', '5个', '7个', '10个', '步', '秘诀', '清单', '教你'];
const DEBATE_KEYWORDS = ['争议', '会不会', '能不能', '哪个好', '对比', '选择', '利弊'];
const ANALYSIS_KEYWORDS = ['分析', '拆解', '底层', '本质', '原理', '为什么', '逻辑'];
const GROWTH_KEYWORDS = ['成长', '进步', '改变', '转型', '升职', '涨薪', '逆袭', '突破'];
const AIDA_KEYWORDS = ['注意', '吸引', '欲望', '行动', '转化', '成交', '说服'];

function detectStructure(keyword: string, angle: string): string {
  const text = (keyword + ' ' + angle).toLowerCase();

  if (STORY_KEYWORDS.some(k => text.includes(k))) return '故事线';
  if (LIST_KEYWORDS.some(k => text.includes(k))) return '清单罗列式';
  if (DEBATE_KEYWORDS.some(k => text.includes(k))) return '对比式';
  if (AIDA_KEYWORDS.some(k => text.includes(k))) return 'AIDA式';
  if (ANALYSIS_KEYWORDS.some(k => text.includes(k))) return '递进式';
  if (GROWTH_KEYWORDS.some(k => text.includes(k))) return '时间线式';

  // Default: problem-solving style for topics about "survival" or "adapting"
  if (text.includes('生存') || text.includes('适应') || text.includes('转型')) {
    return '问题解决式';
  }

  return '递进式'; // sensible default
}

export async function recommendStructure(keyword: string, angle: string): Promise<StructureRecommendation> {
  const structure = detectStructure(keyword, angle);

  const reasonMap: Record<string, string> = {
    '故事线': '检测到故事/案例关键词，适合用真实经历作为主线贯穿',
    '清单罗列式': '检测到方法/技巧类关键词，适合清单式输出',
    '对比式': '检测到争议/对比类话题，适合正反两面论述',
    'AIDA式': '检测到说服/转化类关键词，适合注意力→行动路径',
    '递进式': '检测到分析/拆解类关键词，适合层层深入',
    '时间线式': '检测到成长/转型类关键词，适合时间轴叙事',
    '问题解决式': '检测到生存/适应类话题，适合问题→解法结构',
  };

  return {
    structure,
    reason: reasonMap[structure] ?? '根据内容方向自动推荐',
  };
}

// ─── Interactive helpers ───────────────────────────────────────────────────────

function ask(question: string, fallback: string = ''): Promise<string> {
  // Check for pre-collected input from Claude Code
  const preAnswer = getNextAnswer();
  if (preAnswer !== null) {
    console.log(`${question}${preAnswer}`);
    return Promise.resolve(preAnswer);
  }
  if (!isTerminalInteractive()) {
    return Promise.resolve(fallback);
  }
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

function askChoice(question: string, options: string[]): Promise<number> {
  // Check for pre-collected input from Claude Code
  const preAnswer = getNextAnswer();
  if (preAnswer !== null) {
    console.log(question);
    options.forEach((opt, i) => console.log(`  [${i + 1}] ${opt}`));
    const idx = parseInt(preAnswer.trim(), 10) - 1;
    const result = !isNaN(idx) && idx >= 0 && idx < options.length ? idx : 0;
    console.log(`选择序号: ${result + 1}`);
    return Promise.resolve(result);
  }
  if (!isTerminalInteractive()) {
    return Promise.resolve(0); // default to first option
  }
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log(question);
    options.forEach((opt, i) => console.log(`  [${i + 1}] ${opt}`));
    rl.question('选择序号: ', (answer) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      resolve(!isNaN(idx) && idx >= 0 && idx < options.length ? idx : 0);
    });
  });
}

// ─── Outline Review TUI ────────────────────────────────────────────────────────

/**
 * Review and confirm outlines for specified platforms.
 * @param outlines  Three-platform outline object (wechat/xiaohongshu/douyin)
 * @param onRegenerate  Optional async callback(platform) to re-run outline generation
 * @param platforms  'all' or array of platform names to process
 */
export async function confirmOutlines(
  outlines: PlatformOutlines,
  onRegenerate?: (platform: string) => Promise<WechatOutline | XiaohongshuOutline | DouyinOutline>,
  platforms: 'all' | string[] = 'all',
  keyword: string = '',
  angle: string = '',
): Promise<PlatformOutlinesConfirmed> {
  const platformsToProcess = platforms === 'all'
    ? (['wechat', 'xiaohongshu', 'douyin'] as const)
    : (platforms as ('wechat' | 'xiaohongshu' | 'douyin')[]);

  const result: PlatformOutlinesConfirmed = {};

  for (const platform of platformsToProcess) {
    const outline = outlines[platform];
    if (!outline) continue;

    console.log(chalk.cyan(`\n=== 正在确认大纲: ${platform} ===`));

    // Title
    let title = 'title' in outline ? (outline as any).hook?.content?.slice(0, 30) || '' : '';
    if ('sections' in outline && Array.isArray((outline as any).sections)) {
      title = (outline as any).sections[0]?.title || title;
    }

    // Case direction
    let caseDirection = '';
    if ('sections' in outline && Array.isArray((outline as any).sections)) {
      const caseSlots = (outline as any).sections
        .map((s: any) => s.caseSlot)
        .filter(Boolean)
        .join('；');
      caseDirection = caseSlots;
    }

    // Structure (ask recommendation)
    const rec = await recommendStructure(keyword, angle);
    const currentStructure = rec.structure;

    // Show outline summary
    console.log(chalk.bold('\n【当前大纲摘要】'));
    if ('sections' in outline) {
      (outline as any).sections.forEach((s: any, i: number) => {
        console.log(`  ${i + 1}. ${s.title} (${s.purpose}) — 案例方向: ${s.caseSlot || '无'}`);
      });
    }

    // Ask user choices
    console.log(chalk.bold('\n【修改选项】'));
    const structureIdx = await askChoice(
      chalk.cyan('选择论述结构（直接回车使用推荐）:\n'),
      [...STRUCTURES],
    );
    const chosenStructure = STRUCTURES[structureIdx];

    const newCaseDir = await ask(
      chalk.cyan(`案例方向 [${caseDirection}]: `),
      caseDirection,
    );

    const wantsSeed = await ask(
      chalk.cyan('是否有真实经历/案例要注入？(直接回车跳过，输入内容并回车确认): '),
      '',
    );

    // Regenerate option
    let finalOutline = outline;
    if (onRegenerate) {
      const wantsRegen = await ask(
        chalk.yellow('是否重新生成该平台大纲？(y: 重新生成，其他键继续): '),
        'n',
      );
      if (wantsRegen.toLowerCase() === 'y') {
        console.log(chalk.cyan('正在重新生成大纲...'));
        finalOutline = await onRegenerate(platform) as any;
        console.log(chalk.green('大纲已重新生成'));
      }
    }

    // Build confirmed result (partial update: only changed fields)
    result[platform] = {
      title: title || ((finalOutline as any).sections?.[0]?.title || ''),
      caseDirection: newCaseDir || caseDirection,
      structureType: STRUCTURES[structureIdx],
      seedMaterial: wantsSeed.trim(),
    };
  }

  return result;
}

// ─── Content Draft Confirmation ────────────────────────────────────────────────

/**
 * Confirm content draft before review step.
 * @param mode 'simple' = OK/mark/rewrite; 'paragraph' = mark specific paragraphs
 */
export async function confirmContent(
  content: string,
  mode: 'simple' | 'paragraph' = 'simple',
): Promise<ContentConfirmResult> {
  console.log(chalk.cyan('\n=== 草稿确认 ==='));

  if (mode === 'paragraph') {
    // Split into paragraphs and let user mark
    const paragraphs = content.split(/\n\n+/);
    console.log(chalk.bold('\n段落列表:'));
    paragraphs.forEach((p, i) => {
      const preview = p.replace(/[#*]/g, '').trim().slice(0, 60);
      console.log(`  [${i + 1}] ${preview}${preview.length >= 60 ? '...' : ''}`);
    });

    const markedInput = await ask(
      chalk.cyan('输入要修改的段落序号（用逗号分隔，如 2,3,5），直接回车跳过: '),
      '',
    );

    if (!markedInput.trim()) {
      return { action: 'ok' };
    }

    const markedParagraphs = markedInput
      .split(',')
      .map(s => parseInt(s.trim(), 10) - 1)
      .filter(n => !isNaN(n) && n >= 0 && n < paragraphs.length);

    return {
      action: markedParagraphs.length > 0 ? 'mark' : 'ok',
      markedParagraphs,
    };
  }

  // Simple mode
  console.log(chalk.bold('\n[1] OK进审校   [2] 标记要改的段落   [3] 重写'));
  const choice = await ask(chalk.cyan('选择: '), '1');

  switch (choice.trim()) {
    case '2': {
      const paragraphs = content.split(/\n\n+/);
      const markedInput = await ask(
        chalk.cyan(`输入要修改的段落序号（1-${paragraphs.length}，逗号分隔）: `),
        '',
      );
      const markedParagraphs = markedInput
        .split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(n => !isNaN(n) && n >= 0 && n < paragraphs.length);
      return { action: 'mark', markedParagraphs };
    }
    case '3':
      return { action: 'rewrite' };
    default:
      return { action: 'ok' };
  }
}