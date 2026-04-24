// RevisionPipeline — standalone orchestrator for the revision loop
// R0 (element select) → R1 (rewrite) → confirm → loop or exit

import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import { PipelineContext } from '../../core/context.js';
import type { LLMProvider } from '../../llm/types.js';
import { selectRevisionElements } from './steps/element-selector.js';
import { executeRevisionRewrite } from './steps/rewrite-executor.js';
import type { RevisionSelection, AppliedRevision, RevisionManifest } from './types.js';

export interface RevisionPipelineOptions {
  parentRunId: string;
  provider: LLMProvider;
  defaultModel: string;
  outputDir: string;
}

/**
 * Simple yes/no confirmation prompt.
 * Falls back to false (reject) in non-TTY environments.
 */
async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = await import('readline').then((m) =>
    m.createInterface({ input: process.stdin, output: process.stdout }),
  );
  return new Promise<boolean>((resolve) => {
    const handleError = (err: Error) => {
      rl.close();
      resolve(false);
    };
    rl.on('error', handleError);
    rl.question(chalk.cyan(message + ' [y/N] '), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export class RevisionPipeline {
  private options: RevisionPipelineOptions;
  private currentVersion: string = 'v1';
  private revisionCount: number = 0; // number of completed revision cycles

  constructor(options: RevisionPipelineOptions) {
    this.options = options;
  }

  async run(): Promise<{ success: boolean; runId: string }> {
    // 1. Restore context from parentRunId
    const parentContext = await PipelineContext.restore(this.options.parentRunId, this.options.outputDir);

    // 2. Create new context for this revision run
    const runId = `rev-${nanoid(8)}`;
    const outputDir = path.join(this.options.outputDir, runId);
    const context = new PipelineContext('revision', outputDir, runId);

    // Copy relevant artifacts from parent context
    this.restoreParentArtifacts(parentContext, context);

    // Store parentRunId for traceability
    context.set('parentRunId', this.options.parentRunId);

    // 3. Get current content from parent run (各平台内容)
    let contents = this.extractContents(parentContext);

    // 4. Main revision loop: R0 → R1 → confirm → loop or exit
    while (true) {
      try {
        // R0: Element selection
        const { selections, userInstruction } = await selectRevisionElements();
        if (selections.length === 0) {
          console.log(chalk.dim('未选择任何元素，退出修订'));
          return { success: false, runId };
        }

        // R1: Execute rewrite
        console.log(chalk.cyan('\n⏳ 正在修订...\n'));
        const result = await executeRevisionRewrite(
          selections,
          contents,
          userInstruction,
          context,
          this.options.provider,
          this.options.defaultModel,
        );

        // Update contents with rewritten versions (immutable update)
        contents = { ...contents, ...result.updatedContent };

        // Show results
        console.log(chalk.green('\n✓ 修订完成\n'));
        for (const trigger of result.appliedTriggers) {
          console.log(`  ${trigger.element}: ${trigger.action}`);
          if (trigger.newText) {
            console.log(`    新: ${trigger.newText.substring(0, 80)}...`);
          }
        }

      // R2: Confirm
      const confirmed = await confirm('这版可以吗？');
      if (confirmed) {
        // Persist lineage to parent runId
        await this.persistLineage(result.appliedTriggers, userInstruction, selections, contents);

        // Persist final content to new runId
        await this.persistFinalContent(context, contents);

        // Trigger review-optimization
        await this.triggerReviewOptimization(context);

        return { success: true, runId };
      } else {
        // Loop back to R0 with updated contents
        this.revisionCount++;
        this.currentVersion = `v${this.revisionCount + 1}`;
      }
      } catch (err) {
        console.error(chalk.red(`\n错误: ${err instanceof Error ? err.message : String(err)}`));
        console.log(chalk.dim('请重试或按 Ctrl+C 退出'));
      }
    }
  }

  private restoreParentArtifacts(parent: PipelineContext, child: PipelineContext): void {
    // Copy topic-analysis, outline, viralGenome, etc.
    const keys = [
      'topic-analysis-confirmed',
      'topic-assignment-confirmed',
      'viral-genome',
      'content-wechat',
      'content-xiaohongshu',
      'content-douyin',
    ];
    for (const key of keys) {
      const value = parent.get(key);
      if (value !== undefined) child.set(key, value);
    }
  }

  private extractContents(context: PipelineContext): Record<string, string> {
    // Extract platform content from context (wechat-content, xiaohongshu-content, douyin-content)
    return {
      wechat: context.get<string>('content-wechat') ?? '',
      xiaohongshu: context.get<string>('content-xiaohongshu') ?? '',
      douyin: context.get<string>('content-douyin') ?? '',
    };
  }

  private async persistLineage(
    appliedTriggers: AppliedRevision['appliedTriggers'],
    userInstruction: string,
    selections: RevisionSelection[],
    contents: Record<string, string>,
  ): Promise<void> {
    const parentDir = path.join(this.options.outputDir, this.options.parentRunId, 'revisions');
    const manifestPath = path.join(parentDir, 'manifest.json');

    // Load or create manifest
    let manifest: RevisionManifest;
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    } catch {
      manifest = {
        parentRunId: this.options.parentRunId,
        currentVersion: 'v1',
        versions: [],
      };
    }

    const revision: AppliedRevision = {
      version: this.currentVersion,
      timestamp: new Date().toISOString(),
      selections,
      userInstruction,
      appliedTriggers,
    };

    manifest.versions.push(revision);
    manifest.currentVersion = this.currentVersion;

    try {
      await fs.mkdir(parentDir, { recursive: true });
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      await fs.writeFile(
        path.join(parentDir, `${this.currentVersion}.md`),
        Object.values(contents).join('\n\n---\n\n'),
        'utf-8',
      );
    } catch (err) {
      console.warn(chalk.yellow(`警告:  lineage 持久化失败: ${err instanceof Error ? err.message : String(err)} (内容已保存到 runId)`));
    }
  }

  private async persistFinalContent(context: PipelineContext, contents: Record<string, string>): Promise<void> {
    context.set('content-wechat', contents.wechat);
    context.set('content-xiaohongshu', contents.xiaohongshu);
    context.set('content-douyin', contents.douyin);
    await context.persist();
  }

  private async triggerReviewOptimization(_context: PipelineContext): Promise<void> {
    // TODO: This will be implemented when we integrate with review-optimization step
    // For now, just log that we're handing off
    console.log(chalk.cyan('\n→ 进入内容审查优化...\n'));
  }
}
