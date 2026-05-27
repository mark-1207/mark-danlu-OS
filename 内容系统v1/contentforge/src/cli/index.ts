import { Command } from 'commander';
import { registerCreateCommand } from './commands/create.js';
import { registerRecreateCommand } from './commands/recreate.js';
import { registerBatchCommand } from './commands/batch.js';
import { registerResumeCommand } from './commands/resume.js';
import { registerConfigCommand } from './commands/config.js';
import { registerLearnCommand } from './commands/learn.js';
import { registerSkillCommand } from './commands/skill.js';
import { registerReviseCommand } from './commands/revise.js';
import { registerStyleCommand } from './commands/style.js';
import { registerComplianceCommand } from './commands/compliance.js';
import { registerTopicCommand } from './commands/topic.js';
import { registerTopicEngineCommand } from './commands/topic-engine.js';
import { registerArticleCommand } from './commands/article.js';
import { registerContentCalendarCommand } from './commands/content-calendar.js';
import { registerTopicGapCommand } from './commands/topic-gap.js';
import { registerPlatformAllocationCommand } from './commands/platform-allocation.js';

export function buildCLI(): Command {
  const program = new Command();

  program
    .name('contentforge')
    .description('AI 多平台内容生成工作流引擎')
    .version('1.0.0');

  registerCreateCommand(program);
  registerRecreateCommand(program);
  registerBatchCommand(program);
  registerResumeCommand(program);
  registerConfigCommand(program);
  registerLearnCommand(program);
  registerSkillCommand(program);
  registerReviseCommand(program);
  registerStyleCommand(program);
  registerComplianceCommand(program);
  registerTopicCommand(program);
  registerTopicEngineCommand(program);
  registerArticleCommand(program);
  registerContentCalendarCommand(program);
  registerTopicGapCommand(program);
  registerPlatformAllocationCommand(program);

  return program;
}
