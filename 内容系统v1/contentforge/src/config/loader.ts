import { cosmiconfig } from 'cosmiconfig';
import { ConfigSchema, type Config } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { logger } from '../utils/logger.js';
import { deepMerge } from '../utils/deep-merge.js';

const moduleName = 'contentforge';

/**
 * Load and validate configuration from:
 * 1. `contentforge.config.yaml` in current directory
 * 2. `contentforge.config.json`
 * 3. `package.json` contentforge field
 * Falls back to DEFAULT_CONFIG if no config file found.
 */
export async function loadConfig(): Promise<Config> {
  try {
    const cosmiconfigInstance = cosmiconfig(moduleName, {
      searchPlaces: [
        'contentforge.config.yaml',
        'contentforge.config.yml',
        'contentforge.config.json',
        'package.json',
      ],
    });

    const result = await cosmiconfigInstance.search();

    if (result && result.config) {
      const raw = result.config;
      // Merge with defaults so partial configs are fine
      const merged = deepMerge(DEFAULT_CONFIG, raw);
      const validated = ConfigSchema.parse(merged);
      logger.info(`Loaded config from ${result.filepath}`);
      return validated;
    }

    logger.info('No config file found, using defaults');
    return DEFAULT_CONFIG;
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(`Config load error: ${error.message}, using defaults`);
    }
    return DEFAULT_CONFIG;
  }
}

/**
 * Synchronous config access for cases where async isn't available.
 * Returns defaults if not yet loaded — call loadConfig() first.
 */
let _cachedConfig: Config | null = null;

export function setCachedConfig(config: Config): void {
  _cachedConfig = config;
}

export function getCachedConfig(): Config {
  if (!_cachedConfig) {
    return DEFAULT_CONFIG;
  }
  return _cachedConfig;
}
