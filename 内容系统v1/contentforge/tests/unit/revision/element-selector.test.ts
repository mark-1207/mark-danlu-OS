import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { selectRevisionElements } from '../../../src/scenarios/revision/steps/element-selector.js';

// Mock readline
vi.mock('readline', () => {
  const mockRl = {
    close: vi.fn(),
    question: vi.fn((_prompt: string, cb: (answer: string) => void) => cb('')),
  };
  return {
    default: {
      createInterface: vi.fn(() => mockRl),
      emitKeypressEvents: vi.fn(),
    },
    __mockRl: mockRl,
  };
});

// Mock process.stdin
const mockStdin = {
  isTTY: true,
  setRawMode: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

describe('selectRevisionElements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'stdin', {
      value: mockStdin,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty selections in non-TTY mode', async () => {
    Object.defineProperty(process, 'stdin', {
      value: { ...mockStdin, isTTY: false },
      writable: true,
    });

    const result = await selectRevisionElements(3);
    expect(result.selections).toEqual([]);
    expect(result.userInstruction).toBe('');
  });

  it('returns empty selections when nothing selected', async () => {
    Object.defineProperty(process, 'stdin', {
      value: { ...mockStdin, isTTY: false },
      writable: true,
    });

    const result = await selectRevisionElements(3);
    expect(result.selections).toHaveLength(0);
  });

  it('resolves with correct structure in non-TTY', async () => {
    Object.defineProperty(process, 'stdin', {
      value: { ...mockStdin, isTTY: false },
      writable: true,
    });

    const result = await selectRevisionElements(3);
    expect(result).toHaveProperty('selections');
    expect(result).toHaveProperty('userInstruction');
    expect(Array.isArray(result.selections)).toBe(true);
    expect(typeof result.userInstruction).toBe('string');
  });
});
