import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('content-calendar', () => {
  const tmpDir = path.join(os.tmpdir(), `contentforge-cal-test-${Date.now()}`);
  const outputDir = path.join(tmpDir, 'output');
  const corpusDir = path.join(outputDir, 'corpus');
  const calendarPath = path.join(corpusDir, 'content-calendar.json');

  beforeEach(async () => {
    await fs.mkdir(corpusDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  // T6: addEntry creates entry with correct fields
  it('T6: addEntry creates entry with correct fields', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { loadCalendar, addEntry, saveCalendar } = await import('../../../src/scenarios/content-calendar/calendar-store.js');
      const calendar = await loadCalendar();

      const entry = addEntry(calendar, '测试选题', 'wechat', '2026-05-28');
      expect(entry.id).toBeTruthy();
      expect(entry.topic).toBe('测试选题');
      expect(entry.platform).toBe('wechat');
      expect(entry.date).toBe('2026-05-28');
      expect(entry.status).toBe('planned');
      expect(entry.runId).toBeNull();
      expect(calendar.entries.length).toBe(1);

      await saveCalendar(calendar);

      // Verify persisted
      const reloaded = await loadCalendar();
      expect(reloaded.entries.length).toBe(1);
      expect(reloaded.entries[0].topic).toBe('测试选题');
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T7: updateEntryStatus changes status
  it('T7: updateEntryStatus changes status and runId', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { loadCalendar, addEntry, updateEntryStatus, saveCalendar, loadCalendar: reload } = await import('../../../src/scenarios/content-calendar/calendar-store.js');
      const calendar = await loadCalendar();

      const entry = addEntry(calendar, '测试选题', 'wechat', '2026-05-28');
      const id = entry.id;

      // Change to generating
      const updated = updateEntryStatus(calendar, id, 'generating');
      expect(updated).toBeDefined();
      expect(updated!.status).toBe('generating');

      // Change to published with runId
      const updated2 = updateEntryStatus(calendar, id, 'published', 'create_1234567890');
      expect(updated2!.status).toBe('published');
      expect(updated2!.runId).toBe('create_1234567890');

      await saveCalendar(calendar);
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T8: removeEntry removes entry
  it('T8: removeEntry removes entry by id', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { loadCalendar, addEntry, removeEntry, saveCalendar } = await import('../../../src/scenarios/content-calendar/calendar-store.js');
      const calendar = await loadCalendar();

      const entry = addEntry(calendar, '测试选题', 'wechat', '2026-05-28');
      const id = entry.id;
      await saveCalendar(calendar);

      // Reload and remove
      const calendar2 = await loadCalendar();
      const result = removeEntry(calendar2, id);
      expect(result).toBe(true);
      expect(calendar2.entries.length).toBe(0);

      // Remove non-existent returns false
      const result2 = removeEntry(calendar2, 'non-existent-id');
      expect(result2).toBe(false);
    } finally {
      process.cwd = originalCwd;
    }
  });

  // T9: getEntriesByMonth filters by date
  it('T9: getEntriesByMonth filters by YYYY-MM', async () => {
    const originalCwd = process.cwd;
    process.cwd = () => tmpDir;

    try {
      const { loadCalendar, addEntry, getEntriesByMonth, saveCalendar } = await import('../../../src/scenarios/content-calendar/calendar-store.js');
      const calendar = await loadCalendar();

      addEntry(calendar, '5月选题', 'wechat', '2026-05-15');
      addEntry(calendar, '6月选题', 'wechat', '2026-06-01');
      addEntry(calendar, '5月无日期', 'wechat', null);
      await saveCalendar(calendar);

      const mayEntries = getEntriesByMonth(calendar, '2026-05');
      expect(mayEntries.length).toBe(1);
      expect(mayEntries[0].topic).toBe('5月选题');

      const juneEntries = getEntriesByMonth(calendar, '2026-06');
      expect(juneEntries.length).toBe(1);
      expect(juneEntries[0].topic).toBe('6月选题');
    } finally {
      process.cwd = originalCwd;
    }
  });
});