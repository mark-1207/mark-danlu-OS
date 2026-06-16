// Revision suggestions — common revision actions based on creative preferences

import { loadCreativePreferences, getEffectiveTitlePatterns, getEffectiveHookPatterns } from '../../learning/creative-preferences.js';
import type { RevisionElement } from '../types.js';

interface Suggestion {
  label: string;
  instruction: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Get revision suggestions for a selected element.
 * Based on learned effective patterns from past revisions.
 */
export function getRevisionSuggestions(
  element: RevisionElement,
  _platform: 'wechat' | 'xiaohongshu' | 'douyin' = 'wechat',
): Suggestion[] {
  const prefs = loadCreativePreferences();
  const suggestions: Suggestion[] = [];

  if (element === 'title') {
    // From learned title patterns
    const patterns = getEffectiveTitlePatterns(_platform);
    if (patterns.length > 0) {
      suggestions.push({
        label: '应用有效模式',
        instruction: patterns[0],
        confidence: 'high',
      });
    }
    // Generic suggestions
    suggestions.push(
      { label: '更有冲击力', instruction: '标题更有冲击力，语气更狠', confidence: 'medium' },
      { label: '更短更精准', instruction: '标题更短更精准，去掉冗余', confidence: 'medium' },
      { label: '加数字', instruction: '标题加具体数字，增加可信度', confidence: 'medium' },
      { label: '反常识', instruction: '标题用反常识角度，引发好奇', confidence: 'low' },
    );
  }

  if (element === 'hook') {
    const patterns = getEffectiveHookPatterns(_platform);
    if (patterns.length > 0) {
      suggestions.push({
        label: '应用有效模式',
        instruction: patterns[0],
        confidence: 'high',
      });
    }
    suggestions.push(
      { label: '更短更有劲', instruction: 'hook 更短更有劲，开头三句内出亮点', confidence: 'high' },
      { label: '场景代入', instruction: '开头加一个具体场景，增强代入感', confidence: 'medium' },
      { label: '数字开头', instruction: '开头用数字勾起好奇心', confidence: 'medium' },
      { label: '情绪更狠', instruction: '开头情绪更狠，直击痛点', confidence: 'low' },
    );
  }

  if (element === 'body') {
    const structPref = prefs[_platform]?.structure?.preference;
    if (structPref) {
      suggestions.push({
        label: `强化${structPref}结构`,
        instruction: `正文强化${structPref}结构，段落间增加逻辑衔接`,
        confidence: 'medium',
      });
    }
    suggestions.push(
      { label: '更口语化', instruction: '整体语气更口语化，像在和人说话', confidence: 'high' },
      { label: '增加案例', instruction: '增加一个贴近读者的具体案例', confidence: 'medium' },
      { label: '删减冗余', instruction: '删减重复论点，精简每段核心句', confidence: 'medium' },
    );
  }

  if (element === 'cta') {
    suggestions.push(
      { label: '更有行动力', instruction: 'CTA 更具体，给出明确行动指引', confidence: 'high' },
      { label: '情绪收尾', instruction: '结尾情绪不要泄，保持在高点收', confidence: 'medium' },
      { label: '留思考空间', instruction: '结尾留一个开放问题，引发读者思考', confidence: 'low' },
    );
  }

  if (element === 'example') {
    suggestions.push(
      { label: '换成普通人故事', instruction: '案例换成普通人的故事，增强代入感', confidence: 'high' },
      { label: '增加数据支撑', instruction: '案例加具体数据，增强说服力', confidence: 'medium' },
    );
  }

  if (element === 'power-sentence') {
    suggestions.push(
      { label: '更强金句', instruction: '金句更有冲击力，一句话让人记住', confidence: 'high' },
      { label: '更有共鸣', instruction: '金句更贴近目标读者情绪，产生共鸣', confidence: 'medium' },
    );
  }

  return suggestions;
}

/**
 * Render suggestions as a formatted string for TUI display
 */
export function formatSuggestions(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) return '';
  const parts: string[] = [];
  for (const s of suggestions) {
    const icon = s.confidence === 'high' ? '🔴' : s.confidence === 'medium' ? '🟡' : '⚪';
    parts.push(`  ${icon} ${s.label}: "${s.instruction}"`);
  }
  return parts.join('\n');
}
