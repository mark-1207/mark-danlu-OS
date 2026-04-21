import { Command } from 'commander';
import { registerCreateCommand } from './commands/create.js';
import { registerRecreateCommand } from './commands/recreate.js';
import { registerBatchCommand } from './commands/batch.js';
import { registerResumeCommand } from './commands/resume.js';
import { registerConfigCommand } from './commands/config.js';
import { registerLearnCommand } from './commands/learn.js';
import { registerSkillCommand } from './commands/skill.js';

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

  return program;
}
