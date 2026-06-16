// src/scenarios/revision/cli/post-gen-prompt.ts
import { confirmRevision } from '../../../cli/ui/prompts.js';

export type PostGenDecision = 'save' | 'revise' | 'abort';

/**
 * 在 create/recreate 完成后调用，询问用户后续操作
 * - save:    直接保存输出（清理中间文件 + 同步 Obsidian）
 * - revise:  进入初稿修订（RevisionPipeline）
 * - abort:   放弃
 */
export async function askPostGen(): Promise<PostGenDecision> {
  return confirmRevision();
}