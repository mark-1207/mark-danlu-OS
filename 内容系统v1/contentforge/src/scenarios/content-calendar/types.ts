export interface CalendarEntry {
  id: string;
  topic: string;
  platform: 'wechat' | 'xiaohongshu' | 'douyin';
  date: string | null;
  status: 'backlog' | 'planned' | 'generating' | 'published' | 'skipped';
  runId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentCalendar {
  entries: CalendarEntry[];
}

export type CalendarStatus = CalendarEntry['status'];