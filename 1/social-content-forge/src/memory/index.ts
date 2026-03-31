import * as fs from 'fs';
import * as path from 'path';
import { GlobalMemory, ProjectMemory } from './types';

const GLOBAL_MEMORY_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.claude/memory/global_memory.md'
);
const PROJECT_MEMORY_DIR = 'docs/memory';

export function loadGlobalMemory(): GlobalMemory | null {
  if (!fs.existsSync(GLOBAL_MEMORY_PATH)) {
    return null;
  }
  const content = fs.readFileSync(GLOBAL_MEMORY_PATH, 'utf-8');
  return parseGlobalMemory(content);
}

export function parseGlobalMemory(content: string): GlobalMemory {
  // Parse markdown memory file
  const communicationStyle = extractSection(content, '沟通风格偏好') || '简洁直接';
  const contentStylePreference = extractSection(content, '项目通用习惯') || '';

  return {
    path: GLOBAL_MEMORY_PATH,
    communicationStyle,
    contentStylePreference,
    preferences: {
      communicationStyle,
      contentStylePreference,
    },
  };
}

export function extractSection(content: string, sectionTitle: string): string | null {
  // Extract content between section headers
  const regex = new RegExp(`##\\s*${sectionTitle}[\\s\\S]*?(?=##|$)`, 'i');
  const match = content.match(regex);
  return match ? match[0].replace(`## ${sectionTitle}`, '').trim() : null;
}

export function loadProjectMemory(projectRoot: string): ProjectMemory | null {
  const indexPath = path.join(projectRoot, PROJECT_MEMORY_DIR, 'index.md');
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  const content = fs.readFileSync(indexPath, 'utf-8');
  return parseProjectMemory(projectRoot, indexPath, content);
}

export function parseProjectMemory(projectRoot: string, indexPath: string, content: string): ProjectMemory {
  // Parse markdown project memory
  return {
    projectId: path.basename(projectRoot),
    indexPath,
    lastUpdated: extractDate(content) || new Date().toISOString(),
    summary: extractSection(content, '项目状态') || '',
    pendingTasks: extractList(content, '待办'),
    recentConclusions: extractList(content, '核心结论'),
    userPreferences: [],
  };
}

export function extractDate(content: string): string | null {
  const match = content.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

export function extractList(content: string, sectionTitle: string): string[] {
  const section = extractSection(content, sectionTitle);
  if (!section) return [];
  // Extract list items (lines starting with - or numbers)
  const items = section.match(/^\s*[-*\d.]\s*(.+)/gm);
  return items ? items.map(item => item.replace(/^\s*[-*\d.]\s*/, '').replace(/^\[\s*\]\s*/, '').trim()) : [];
}

export function appendToMemory(filePath: string, section: string, content: string): void {
  // Append new conclusion to memory file
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  const newEntry = `\n\n## ${section}\n\n${content}`;
  fs.writeFileSync(filePath, existing + newEntry, 'utf-8');
}

export function updateMemoryTimestamp(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  // Update "最后更新" line
  content = content.replace(
    /最后更新：\d{4}-\d{2}-\d{2}/,
    `最后更新：${new Date().toISOString().split('T')[0]}`
  );
  fs.writeFileSync(filePath, content, 'utf-8');
}
