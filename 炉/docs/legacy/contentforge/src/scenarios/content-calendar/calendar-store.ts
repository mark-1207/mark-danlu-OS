import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';
import type { CalendarEntry, ContentCalendar } from './types.js';

const CALENDAR_PATH = path.join(process.cwd(), 'output', 'corpus', 'content-calendar.json');

export function defaultCalendar(): ContentCalendar {
  return { entries: [] };
}

export async function loadCalendar(): Promise<ContentCalendar> {
  try {
    const content = await fs.readFile(CALENDAR_PATH, 'utf-8');
    return JSON.parse(content) as ContentCalendar;
  } catch {
    return defaultCalendar();
  }
}

export async function saveCalendar(calendar: ContentCalendar): Promise<void> {
  await fs.mkdir(path.dirname(CALENDAR_PATH), { recursive: true });
  await fs.writeFile(CALENDAR_PATH, JSON.stringify(calendar, null, 2), 'utf-8');
}

export function addEntry(
  calendar: ContentCalendar,
  topic: string,
  platform: CalendarEntry['platform'],
  date: string | null
): CalendarEntry {
  const now = new Date().toISOString();
  const entry: CalendarEntry = {
    id: crypto.randomUUID(),
    topic,
    platform,
    date,
    status: date ? 'planned' : 'backlog',
    runId: null,
    createdAt: now,
    updatedAt: now,
  };
  calendar.entries.push(entry);
  return entry;
}

export function getEntryById(calendar: ContentCalendar, id: string): CalendarEntry | null {
  return calendar.entries.find((e) => e.id === id) ?? null;
}

export function updateEntryStatus(
  calendar: ContentCalendar,
  id: string,
  status: CalendarEntry['status'],
  runId?: string | null
): CalendarEntry | null {
  const entry = getEntryById(calendar, id);
  if (!entry) return null;
  entry.status = status;
  if (runId !== undefined) entry.runId = runId;
  entry.updatedAt = new Date().toISOString();
  return entry;
}

export function removeEntry(calendar: ContentCalendar, id: string): boolean {
  const idx = calendar.entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  calendar.entries.splice(idx, 1);
  return true;
}

export function getEntriesByMonth(calendar: ContentCalendar, yearMonth: string): CalendarEntry[] {
  return calendar.entries
    .filter((e) => e.date?.startsWith(yearMonth))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}