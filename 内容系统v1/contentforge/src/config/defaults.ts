import type { Config } from './schema.js';

export const DEFAULT_CONFIG: Config = {
  providers: {
    anthropic: {
      type: 'anthropic',
      defaultModel: 'claude-sonnet-4-20250514',
    },
    openai: {
      type: 'openai',
      defaultModel: 'gpt-4o',
    },
  },
  defaultProvider: 'anthropic',
  scenarios: {
    create: {
      steps: {
        'topic-analysis': { temperature: 0.7, maxTokens: 4000 },
        'topic-assignment': { temperature: 0.6, maxTokens: 4000 },
        'outline-generation': { temperature: 0.6, maxTokens: 4000 },
        'content-generation': { temperature: 0.8, maxTokens: 8000 },
        'review-optimization': { temperature: 0.4, maxTokens: 8000 },
      },
    },
    recreate: {
      steps: {
        'viral-deconstruction': { temperature: 0.3, maxTokens: 6000 },
        'viral-differentiation': { temperature: 0.8, maxTokens: 4000 },
        'new-outline': { temperature: 0.6, maxTokens: 4000 },
        'content-generation': { temperature: 0.8, maxTokens: 8000 },
        'dual-review': { temperature: 0.3, maxTokens: 8000 },
      },
    },
  },
  concurrency: {
    maxParallel: 3,
    batchSize: 5,
  },
  output: {
    dir: './output',
    saveIntermediateArtifacts: true,
  },
  costControl: {
    maxCostPerRun: undefined,
    onExceedAction: 'skip-local-rewrite',
  },
  inputValidation: {
    minLengthError: 200,
    minLengthWarn: 500,
    htmlHandling: 'strip',
  },
  search: {
    enabled: false,
  },
  embedding: {
    primary: 'tavily',
    fallback: 'google',
  },
  image: {
    primary: 'pollinations',
    width: 1024,
    height: 1024,
    model: 'flux',
  },
  textProviders: {
    rotationOrder: ['openai', 'kimi', 'gemini'],
  },
  obsidian: {
    vaultPath: 'd:/软件/obsidian笔记/内容素材库',
    readDirs: [
      '40_知识库/原子库',
      '40_知识库/洞察库',
      '40_知识库/金句库',
      '40_知识库/思维模型',
      '40_知识库/人生哲学',
      '30_研究/书籍拆解',
    ],
    writeDir: '50_资源/生成文章',
  },
};
