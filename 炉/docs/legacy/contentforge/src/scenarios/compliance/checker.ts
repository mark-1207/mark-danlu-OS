import fs from 'fs/promises';
import path from 'path';
import type { ComplianceIssue, ComplianceResult, Platform, PlatformRules } from './types.js';

const platformFiles: Record<string, string> = {
  wechat: 'wechat.json',
  xiaohongshu: 'xiaohongshu.json',
  douyin: 'douyin.json',
};

function detectPlatform(fileName: string): Platform {
  const lower = fileName.toLowerCase();
  if (lower.includes('xhs') || lower.includes('xiaohongshu')) return 'xiaohongshu';
  if (lower.includes('d.md') || lower.includes('douyin')) return 'douyin';
  if (lower.includes('wechat') || lower.includes('wx')) return 'wechat';
  return 'wechat';
}

async function loadPlatformRules(platform: Platform): Promise<PlatformRules> {
  const dataDir = path.join(process.cwd(), 'data', 'compliance');

  const defaultRules: PlatformRules = {
    titleMaxLength: 20,
    bodyMinLength: 300,
    bodyMaxLength: 20000,
    forbiddenWords: [],
    sensitivePatterns: [],
  };

  try {
    const fileName = platformFiles[platform];
    if (!fileName) return defaultRules;

    const filePath = path.join(dataDir, 'platforms', fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultRules;
  }
}

async function loadForbiddenWords(): Promise<string[]> {
  const dataDir = path.join(process.cwd(), 'data', 'compliance');
  try {
    const content = await fs.readFile(path.join(dataDir, 'forbidden-words.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export async function checkCompliance(content: string, fileName: string): Promise<ComplianceResult> {
  const platform = detectPlatform(fileName);
  const rules = await loadPlatformRules(platform);
  const forbiddenWords = await loadForbiddenWords();
  const issues: ComplianceIssue[] = [];

  const lines = content.split('\n');
  const title = lines[0]?.replace(/^#+\s*/, '').trim() ?? '';
  const body = lines.slice(1).join('\n').trim();

  // 1. 敏感词检测
  for (const word of forbiddenWords) {
    const lineIndex = lines.findIndex(line => line.includes(word));
    if (lineIndex >= 0) {
      issues.push({
        type: 'sensitive',
        severity: 'warn',
        message: `检测到敏感词"${word}"`,
        line: lineIndex + 1,
        matchedWord: word,
      });
    }
  }

  // 2. 平台违禁词
  for (const word of rules.forbiddenWords) {
    const lineIndex = lines.findIndex(line => line.includes(word));
    if (lineIndex >= 0) {
      issues.push({
        type: 'forbidden',
        severity: 'warn',
        message: `${platform}平台违禁词"${word}"`,
        line: lineIndex + 1,
        matchedWord: word,
      });
    }
  }

  // 3. 格式检查
  if (title.length > rules.titleMaxLength) {
    issues.push({
      type: 'format',
      severity: 'warn',
      message: `标题过长（${title.length}字，建议≤${rules.titleMaxLength}）`,
    });
  }

  const bodyLength = body.replace(/\s/g, '').length;
  if (bodyLength < rules.bodyMinLength) {
    issues.push({
      type: 'format',
      severity: 'warn',
      message: `正文过短（${bodyLength}字，建议≥${rules.bodyMinLength}）`,
    });
  }
  if (bodyLength > rules.bodyMaxLength) {
    issues.push({
      type: 'format',
      severity: 'warn',
      message: `正文过长（${bodyLength}字，建议≤${rules.bodyMaxLength}）`,
    });
  }

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    platform,
    fileName,
  };
}
