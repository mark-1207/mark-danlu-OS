#!/usr/bin/env node

/**
 * ContentForge CLI Entry Point
 *
 * Usage:
 *   npx contentforge create --keyword "AI"
 *   npx contentforge recreate --input ./article.md
 */

import 'dotenv/config';
import { buildCLI } from './cli/index.js';
import { initTokenizer } from './utils/token-counter.js';

// Initialize tiktoken encoder in background (non-blocking)
initTokenizer().catch(() => {
  // Silently ignore — will fall back to char estimation
});

const program = buildCLI();
program.parse(process.argv);
