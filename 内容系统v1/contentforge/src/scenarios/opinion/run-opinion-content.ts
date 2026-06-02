/**
 * Run opinion content phase (topic-assignment → outline → material-search → content → review).
 * Used when user runs: opinion --phase content --run-id <opinion_runId>
 */
import { PipelineContext } from '../../core/context.js';
import { loadConfig } from '../../config/loader.js';
import { LLMProviderFactory } from '../../llm/factory.js';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { sanitizeFilename } from '../../utils/sanitize.js';
import { getObsidianWriter } from '../../io/obsidian/writer.js';
import { logger } from '../../utils/logger.js';

export async function resumeOpinionContent(runId: string): Promise<void> {
  // File structure: output/<runId>/{artifacts}
  // PipelineContext.restore(runId, baseDir) looks at path.join(baseDir, runId)
  const baseDir = `${process.cwd()}/output`;
  const context = await PipelineContext.restore(runId, baseDir);

  const config = await loadConfig();
  const llmFactory = new LLMProviderFactory({});
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  const provider = llmFactory.get(config.defaultProvider);
  const defaultModel = config.providers[config.defaultProvider]?.defaultModel ?? 'mimo-v2-flash';

  console.log(chalk.bold('\n🔨 ContentForge — Opinion 内容生成（续）\n'));
  console.log(`Run: ${runId}\n`);

  // Import pipeline steps dynamically to avoid circular deps
  const { TopicAssignmentStep } = await import('../create/steps/topic-assignment.js');
  const { OutlineWechatStep } = await import('../create/steps/outline-generation.js');
  const { MaterialSearchStep } = await import('../create/steps/material-search.js');
  const { ContentWechatStep } = await import('../create/steps/content-generation.js');
  const { ReviewWechatStep } = await import('../create/steps/review-optimization.js');

  // Step: topic-assignment
  console.log('[opinion-content] running topic-assignment...');
  const taStep = new TopicAssignmentStep(provider, defaultModel);
  const taResult = await taStep.execute({}, context);
  if (!taResult.success) throw new Error(`topic-assignment failed: ${taResult.error}`);
  context.set('topic-assignment', taResult.data);
  context.setStepResult('topic-assignment', taResult);
  await context.persist();

  // Step: outline-wechat
  console.log('[opinion-content] running outline-wechat...');
  const olStep = new OutlineWechatStep(provider, defaultModel);
  const olResult = await olStep.execute({}, context);
  if (!olResult.success) throw new Error(`outline-wechat failed: ${olResult.error}`);
  context.set('outline-wechat', olResult.data);
  context.setStepResult('outline-wechat', olResult);
  await context.persist();

  // Step: material-search
  console.log('[opinion-content] running material-search...');
  const matStep = new MaterialSearchStep(provider, defaultModel);
  const matResult = await matStep.execute({}, context);
  context.set('material-search', matResult.data);
  context.setStepResult('material-search', matResult);
  await context.persist();

  // Step: content-wechat
  console.log('[opinion-content] running content-wechat...');
  const cStep = new ContentWechatStep(provider, defaultModel);
  const cResult = await cStep.execute({}, context);
  context.set('content-wechat', cResult.data);
  context.setStepResult('content-wechat', cResult);
  await context.persist();

  // Step: review-wechat
  console.log('[opinion-content] running review-wechat...');
  const rStep = new ReviewWechatStep(provider, defaultModel);
  const rResult = await rStep.execute({}, context);
  context.set('review-wechat', rResult.data);
  context.setStepResult('review-wechat', rResult);
  await context.persist();

  // Write .md file + sync to Obsidian (same pattern as create pipeline)
  const runDir = path.join(baseDir, runId);
  const reviewResult = context.get<{ recommendedTitle: string; revisedContent: string }>('review-wechat');
  if (reviewResult) {
    const { recommendedTitle, revisedContent } = reviewResult;
    const safeTitle = sanitizeFilename(recommendedTitle);
    const filePath = path.join(runDir, `${safeTitle}.wechat.md`);
    await fs.writeFile(filePath, revisedContent, 'utf-8');
    logger.info(`[opinion] article written: ${filePath}`);

    // Sync to Obsidian
    try {
      const obsidianConfig = config.obsidian;
      if (obsidianConfig?.vaultPath) {
        const writer = getObsidianWriter(obsidianConfig.vaultPath, obsidianConfig.writeDir);
        const topicAnalysis = context.get<{ subTopics?: { name: string }[]; keyword?: string }>('topic-analysis');
        const obsidianPath = await writer.writeArticle({
          title: recommendedTitle,
          content: revisedContent,
          platform: 'wechat',
          topics: topicAnalysis?.subTopics?.map((s) => s.name) ?? [],
          keyword: topicAnalysis?.keyword,
        });
        logger.info(`[opinion] article synced to Obsidian: ${obsidianPath}`);
      }
    } catch (err) {
      logger.warn(`[opinion] failed to write article to Obsidian:`, String(err));
    }
  }

  console.log(chalk.green('\n✅ Opinion 内容生成完成\n'));
  console.log('Token:', context.getTotalTokenUsage());
}
