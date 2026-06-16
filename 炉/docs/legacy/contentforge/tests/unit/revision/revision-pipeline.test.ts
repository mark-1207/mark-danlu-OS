import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RevisionPipeline } from '../../../src/scenarios/revision/index.js';
import { PipelineContext } from '../../../src/core/context.js';
import * as elementSelector from '../../../src/scenarios/revision/steps/element-selector.js';

vi.mock('../../../src/core/context.js');
vi.mock('../../../src/scenarios/revision/steps/element-selector.js');
vi.mock('../../../src/scenarios/revision/steps/rewrite-executor.js');

describe('RevisionPipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('instantiates with options', () => {
    const pipeline = new RevisionPipeline({
      parentRunId: 'run-123',
      provider: { chat: vi.fn() } as any,
      defaultModel: 'claude-3-5-sonnet',
      outputDir: '/tmp/output',
    });
    expect(pipeline).toBeDefined();
  });

  it('returns failure when no elements selected', async () => {
    // Mock PipelineContext.restore to return a mock parent context
    const mockParentContext = new PipelineContext('create', '/tmp/output', 'run-123');
    mockParentContext.set('content-wechat', 'wechat content');
    mockParentContext.set('content-xiaohongshu', 'xiaohongshu content');
    mockParentContext.set('content-douyin', 'douyin content');
    vi.mocked(PipelineContext.restore).mockResolvedValue(mockParentContext as any);

    // Mock selectRevisionElements to return empty selections
    vi.mocked(elementSelector.selectRevisionElements).mockResolvedValue({
      selections: [],
      userInstruction: '',
    });

    const pipeline = new RevisionPipeline({
      parentRunId: 'run-123',
      provider: { chat: vi.fn() } as any,
      defaultModel: 'claude-3-5-sonnet',
      outputDir: '/tmp/output',
    });

    const result = await pipeline.run();
    expect(result.success).toBe(false);
    expect(result.runId).toMatch(/^rev-/);
  });
});
