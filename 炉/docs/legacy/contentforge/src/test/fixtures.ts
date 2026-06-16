import type { Config } from '../config/schema.js';

export function makeFakeConfig(): Config {
  return {
    providers: {},
    defaultProvider: 'xiaomi',
    obsidian: {
      vaultPath: '',
      readDirs: [],
      writeDir: '',
    },
    output: {
      dir: './output',
      saveIntermediateArtifacts: false,
    },
  };
}