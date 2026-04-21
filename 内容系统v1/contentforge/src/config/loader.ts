import { cosmiconfig } from 'cosmiconfig';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ConfigSchema, type Config } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import { logger } from '../utils/logger.js';
import { deepMerge } from '../utils/deep-merge.js';

const moduleName = 'contentforge';

/**
 * Load and validate configuration from:
 * 1. `config/contentforge.yaml` (project root config/ subdirectory) — preferred
 * 2. `contentforge.config.yaml` in current directory (root-level fallback)
 * 3. `contentforge.config.json`
 * 4. `package.json` contentforge field
 * Falls back to DEFAULT_CONFIG if no config file found.
 */
export async function loadConfig(): Promise<Config> {
  try {
    // Try config/contentforge.yaml first (project root config/ directory)
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const projectRoot = join(__dirname, '..');
    const configInConfigDir = join(projectRoot, 'config', 'contentforge.yaml');

    const cosmiconfigInstance = cosmiconfig(moduleName);
    let raw: Record<string, unknown> | undefined;
    let filepath: string | undefined;

    // Priority 1: load from config/contentforge.yaml
    try {
      const loaded = await cosmiconfigInstance.load(configInConfigDir);
      if (loaded) {
        raw = loaded.config as Record<string, unknown>;
        filepath = loaded.filepath;
      }
    } catch {
      // config/contentforge.yaml not found, fall through to search
    }

    // Priority 2: cosmiconfig search (finds root-level config, package.json field)
    if (!raw) {
      const result = await cosmiconfigInstance.search();
      if (result?.config) {
        raw = result.config as Record<string, unknown>;
        filepath = result.filepath;
      }
    }

    if (raw) {
      const merged = deepMerge(DEFAULT_CONFIG, raw);
      const validated = ConfigSchema.parse(merged);
      logger.info(`Loaded config from ${filepath}`);
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
