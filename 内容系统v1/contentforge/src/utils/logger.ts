import winston from 'winston';
import path from 'path';
import fs from 'fs/promises';

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

const consoleFormat = winston.format.printf(({ level, message, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${level.toUpperCase()}] ${message}${metaStr}`;
});

const jsonFormat = winston.format.json();

/**
 * Create a logger instance.
 * If logDir is provided, also writes a JSON log file there.
 */
export function createLogger(logDir?: string): winston.Logger {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), consoleFormat),
      level: LOG_LEVEL,
    }),
  ];

  if (logDir) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'run.log'),
        format: jsonFormat,
        level: LOG_LEVEL,
      }),
    );
  }

  return winston.createLogger({
    level: LOG_LEVEL,
    transports,
  });
}

/**
 * Shared logger instance for the application.
 * Initialized without file transport; file transport is set up per-run.
 */
export const logger = createLogger();

/**
 * Set up file transport for a specific run directory.
 */
export async function setupRunLogger(runDir: string): Promise<void> {
  // Ensure run directory exists
  await fs.mkdir(runDir, { recursive: true });

  // Re-create logger with file transport
  const fileTransport = new winston.transports.File({
    filename: path.join(runDir, 'run.log'),
    format: jsonFormat,
    level: LOG_LEVEL,
  });

  logger.clear();
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), consoleFormat),
    level: LOG_LEVEL,
  }));
  logger.add(fileTransport);
}
