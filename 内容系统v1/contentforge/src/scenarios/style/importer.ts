import fs from 'fs/promises';
import { loadConfig } from '../../config/loader.js';
import { llmFactory } from '../../llm/factory.js';
import type { StyleProfile } from './types.js';
import { StyleProfileStore } from './profile-store.js';
import { safeJsonParse } from '../../utils/json-parser.js';

export interface ImportOptions {
  stylesDir: string;
  name: string;
  articlePath: string;
}

export async function importExternalStyle(options: ImportOptions): Promise<StyleProfile> {
  const config = await loadConfig();
  for (const [name, providerConfig] of Object.entries(config.providers)) {
    llmFactory.register(name, providerConfig);
  }
  const provider = llmFactory.get('kimi');
  const model = config.providers['kimi']?.defaultModel ?? 'moonshot-v1-8k';

  const content = await fs.readFile(options.articlePath, 'utf-8');
  const snippet = content.slice(0, 8000);

  const prompt = `你是一位写作风格分析专家。从以下文章中提取写作风格特征。

文章：
${snippet}

请提取以下风格特征（严格 JSON 输出）：
{
  "vocabularyWeights": {
    "高频词": ["词1", "词2"],
    "避免词": ["词1"]
  },
  "emotionalTone": "情绪基调",
  "structuralPreference": {
    "hook": "开头风格",
    "transition": "过渡风格",
    "closing": "结尾风格"
  },
  "narrativeStyle": {
    "caseType": "案例类型",
    "logicVsEmotion": "比例",
    "dataUsage": "数据使用"
  }
}
只输出 JSON。`;

  const response = await provider.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    maxTokens: 2048,
    jsonMode: true,
  });

  const parsed = safeJsonParse<StyleProfile['dimensions']>(response.content, 'importer');

  const profile: StyleProfile = {
    name: options.name,
    type: 'external',
    dimensions: parsed,
    sourceArticles: [options.articlePath],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    articleTags: {},
  };

  const profileStore = new StyleProfileStore(options.stylesDir);
  await profileStore.save(profile);

  return profile;
}
