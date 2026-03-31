import { describe, it, expect, beforeEach } from 'vitest';
import { CaseReader } from '../../src/style-learning/case-reader';
import { LibraryIndexer } from '../../src/style-learning/library-indexer';
import { checkForNewStyleCases } from '../../src/style-learning';

describe('CaseReader', () => {
  const PROJECT_ROOT = 'D:/myproject/1/social-content-forge';
  let reader: CaseReader;

  beforeEach(() => {
    reader = new CaseReader(PROJECT_ROOT);
  });

  it('should read all cases', () => {
    const cases = reader.readAllCases();
    expect(Array.isArray(cases)).toBe(true);
  });

  it('should return null for invalid file', () => {
    const result = reader.readCaseFile('/invalid/path.md', 'good');
    expect(result).toBeNull();
  });

  it('should get latest case', () => {
    const latest = reader.getLatestCase();
    if (latest) {
      expect(latest.filename).toBeTruthy();
      expect(latest.content).toBeTruthy();
    }
  });
});

describe('LibraryIndexer', () => {
  const PROJECT_ROOT = 'D:/myproject/1/social-content-forge';
  let indexer: LibraryIndexer;

  beforeEach(() => {
    indexer = new LibraryIndexer(PROJECT_ROOT);
  });

  it('should get index', () => {
    const index = indexer.getIndex();
    expect(index.lastUpdated).toBeTruthy();
  });

  it('should get/set last checked file', () => {
    const original = indexer.getLastCheckedFile();
    indexer.setLastCheckedFile('test-file.md');
    expect(indexer.getLastCheckedFile()).toBe('test-file.md');
    // Restore
    indexer.setLastCheckedFile(original);
  });
});

describe('checkForNewStyleCases', () => {
  it('should return array of filenames', () => {
    const result = checkForNewStyleCases('D:/myproject/1/social-content-forge');
    expect(Array.isArray(result)).toBe(true);
  });
});