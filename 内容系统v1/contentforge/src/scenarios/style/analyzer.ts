import fs from 'fs/promises';
import path from 'path';
import { loadConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import type { StyleProfile, ArticleTag } from './types.js';
import { StyleProfileStore } from './profile-store.js';
import { safeJsonParse } from '../../utils/json-parser.js';

export interface AnalyzeOptions {
  stylesDir: string;
  corpusDir: string;
  articleTags?: Record<string, ArticleTag>;
  userName?: string;
}

export async function analyzePersonalStyle(options: AnalyzeOptions): Promise<StyleProfile> {
  const config = await loadConfig();
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  const provider = llmFactory.get('kimi');
  const model = config.providers['kimi']?.defaultModel ?? 'moonshot-v1-8k';

  const snippets = await collectArticleSnippets(options.corpusDir, options.articleTags);

  const prompt = `你是一位写作风格分析专家。从以下文章片段中提取写作风格特征。

文章片段：
${snippets}

请提取以下风格特征（严格 JSON 输出）：
{
  "vocabularyWeights": {
    "高频词": ["词1", "词2"],
    "避免词": ["词1"]
  },
  "emotionalTone": "整体情绪基调描述",
  "structuralPreference": {
    "hook": "开头风格描述",
    "transition": "过渡风格描述",
    "closing": "结尾风格描述"
  },
  "narrativeStyle": {
    "caseType": "偏好案例类型",
    "logicVsEmotion": "逻辑vs感性比例",
    "dataUsage": "数据使用偏好"
  }
}
只输出 JSON，不要其他文字。`;

  const response = await provider.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    maxTokens: 2048,
    jsonMode: true,
  });

  const parsed = safeJsonParse<StyleProfile['dimensions']>(response.content, 'analyzer');

  const profile: StyleProfile = {
    name: options.userName ?? 'personal',
    type: 'personal',
    dimensions: parsed,
    sourceArticles: Object.keys(options.articleTags ?? {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    articleTags: options.articleTags ?? {},
  };

  const profileStore = new StyleProfileStore(options.stylesDir);
  await profileStore.save(profile);

  return profile;
}

async function collectArticleSnippets(
  corpusDir: string,
  tags?: Record<string, ArticleTag>,
): Promise<string> {
  const editedDir = path.join(corpusDir, 'edited');
  const snippets: string[] = [];

  try {
    const entries = await fs.readdir(editedDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.name.endsWith('.md')) continue;
      const tag = tags?.[entry.name] ?? 'normal';
      if (tag === 'deviant') continue;

      const content = await fs.readFile(path.join(editedDir, entry.name), 'utf-8');
      const wordCount = 300;
      const snippet = `【${entry.name}】\n${content.slice(0, wordCount)}`;
      snippets.push(snippet);
      if (tag === 'representative') snippets.push(snippet); // x2 weight
    }
  } catch {
    // Directory doesn't exist
  }

  return snippets.join('\n\n---\n\n');
}