import type { Config } from '../config/schema.js';

export function makeFakeConfig(): Config {
  return {
    llm: {
      providers: [],
      rotation: { primary: 'xiaomi', fallback: ['kimi'] },
    },
    obsidian: {
      enabled: false,
      vaultPath: '',
    },
    feishu: {
      enabled: false,
      appId: '',
      appSecret: '',
    },
    output: {
      dir: './output',
    },
  };
}