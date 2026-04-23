import { describe, it, expect } from 'vitest';
import { RevisionElementSchema, RevisionSelectionSchema, AppliedRevisionSchema, RevisionManifestSchema } from '../../../src/scenarios/revision/types.js';

describe('revision types', () => {
  it('validates element enum', () => {
    expect(RevisionElementSchema.parse('title')).toBe('title');
    expect(() => RevisionElementSchema.parse('invalid')).toThrow();
  });

  it('validates revision selection', () => {
    const sel = { element: 'hook', platforms: ['wechat'] };
    expect(RevisionSelectionSchema.parse(sel)).toEqual(sel);
  });

  it('validates applied revision', () => {
    const rev = {
      version: 'v1',
      timestamp: new Date().toISOString(),
      selections: [{ element: 'hook', platforms: ['wechat'] }],
      userInstruction: 'hook 更精炼',
      appliedTriggers: [],
    };
    expect(AppliedRevisionSchema.parse(rev)).toEqual(rev);
  });

  it('validates manifest', () => {
    const manifest = {
      parentRunId: 'run-123',
      currentVersion: 'v2',
      versions: [],
    };
    expect(RevisionManifestSchema.parse(manifest)).toEqual(manifest);
  });
});