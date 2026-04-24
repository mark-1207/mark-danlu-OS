// tests/unit/revision/post-gen-prompt.test.ts
import { describe, it, expect, vi } from 'vitest';
import { askPostGen } from '../../../src/scenarios/revision/cli/post-gen-prompt.js';

vi.mock('../../../src/cli/ui/prompts.js', () => ({
  confirmRevision: vi.fn(),
}));

describe('post-gen-prompt', () => {
  it('returns revise when user chooses r', async () => {
    const { confirmRevision } = await import('../../../src/cli/ui/prompts.js');
    vi.mocked(confirmRevision).mockResolvedValue('revise');
    const result = await askPostGen();
    expect(result).toBe('revise');
  });

  it('returns accept when user is satisfied', async () => {
    const { confirmRevision } = await import('../../../src/cli/ui/prompts.js');
    vi.mocked(confirmRevision).mockResolvedValue('accept');
    const result = await askPostGen();
    expect(result).toBe('accept');
  });

  it('returns abort when user is dissatisfied', async () => {
    const { confirmRevision } = await import('../../../src/cli/ui/prompts.js');
    vi.mocked(confirmRevision).mockResolvedValue('abort');
    const result = await askPostGen();
    expect(result).toBe('abort');
  });
});