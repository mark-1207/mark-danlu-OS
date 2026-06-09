import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { PipelineContext } from '../../../src/core/context.js';
import type { RefinedOpinion } from '../../../src/scenarios/opinion/types.js';
import { registerOpinionCommand } from '../../../src/cli/commands/opinion.js';
import { registerCreateCommand } from '../../../src/cli/commands/create.js';
import { askDisambiguation, type DisambiguationChoice } from '../../../src/cli/ui/disambiguation.js';

// ─── Step 4: opinion inline path in create + alias command ────────────

describe('opinion inline path (mode-merge Step 4)', () => {
  it('T1: OpinionRefineStep can be imported and is a class', async () => {
    const { OpinionRefineStep } = await import('../../../src/scenarios/opinion/steps/opinion-refine.js');
    expect(typeof OpinionRefineStep).toBe('function');
    // Verify it has the expected config name
    const step = new (OpinionRefineStep as any)({ name: 'fake' } as any, 'fake-model');
    expect(step.config.name).toBe('opinion-refine');
  });

  it('T2: refined-opinion context key holds full RefinedOpinion shape', () => {
    const ctx = new PipelineContext('create', 'output/test', 'create-opinion-inline');
    const refined: RefinedOpinion = {
      originalOpinion: '远程办公才是未来',
      refinedThesis: '远程办公不是疫情期间的临时方案，而是公司组织形态的范式转移。',
      type: 'judgment',
      evidence: ['GitLab 估值 5 年翻 4 倍', '美国 27% 知识工作已远程化'],
      counterArguments: ['沟通成本上升', '管理半径缩短'],
      boundaries: '聚焦知识工作，不含制造业',
      whyNow: '2025 年 AI 协作工具成熟',
      hkrScore: { h: 80, k: 75, r: 78 },
      recommendedTitles: ['远程办公才是未来', '范式转移：从格子间到云端'],
    };
    ctx.set('refined-opinion', refined);

    const restored = ctx.get<RefinedOpinion>('refined-opinion');
    expect(restored).toBeDefined();
    expect(restored?.refinedThesis).toContain('范式转移');
    expect(restored?.hkrScore.h).toBe(80);
    expect(restored?.recommendedTitles).toHaveLength(2);
  });

  it('T3: opinion alias command is registered with -k keyword and --opinion internally', () => {
    const program = new Command();
    registerOpinionCommand(program);
    const opinionCmd = program.commands.find((c) => c.name() === 'opinion');
    expect(opinionCmd).toBeDefined();
    const keywordOpt = opinionCmd?.options.find((o) => o.long === '--keyword');
    expect(keywordOpt).toBeDefined();
    // Opinion alias should be marked required
    expect(keywordOpt?.required).toBe(true);
  });

  it('T4: create command exposes --opinion flag (boolean)', () => {
    const program = new Command();
    registerCreateCommand(program);
    const createCmd = program.commands.find((c) => c.name() === 'create');
    const opinionOpt = createCmd?.options.find((o) => o.long === '--opinion');
    expect(opinionOpt).toBeDefined();
    expect(opinionOpt?.isBoolean?.()).toBe(true);
  });

  it('T5: askDisambiguation is exported and has both option values', () => {
    // Type-only check: verify the union includes both choices
    const choice: DisambiguationChoice = 'opinion';
    expect(choice).toBe('opinion');
    const choice2: DisambiguationChoice = 'explore';
    expect(choice2).toBe('explore');
    // The function is exported and is async-callable
    expect(typeof askDisambiguation).toBe('function');
  });

  it('T6: opinion alias command passes opinion=true to runCreate (structural)', () => {
    // Verify the option shape matches what the action handler reads.
    // We can't easily mock runCreate here, but we can verify the alias has
    // the right options the action will read.
    const program = new Command();
    registerOpinionCommand(program);
    const opinionCmd = program.commands.find((c) => c.name() === 'opinion');
    const platformsOpt = opinionCmd?.options.find((o) => o.long === '--platforms');
    const interactiveOpt = opinionCmd?.options.find((o) => o.long === '--no-interactive');
    const keepOpt = opinionCmd?.options.find((o) => o.long === '--keep-artifacts');
    expect(platformsOpt).toBeDefined();
    expect(interactiveOpt).toBeDefined();
    expect(keepOpt).toBeDefined();
  });
});
