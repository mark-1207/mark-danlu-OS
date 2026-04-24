// src/scenarios/revision/cli/post-gen-prompt.ts
import { confirmRevision } from '../../../cli/ui/prompts.js';

export type PostGenDecision = 'accept' | 'revise' | 'abort';

/**
 * 在 create/recreate 完成后调用，询问用户是否进入修订流程
 */
export async function askPostGen(): Promise<PostGenDecision> {
  return confirmRevision();
}