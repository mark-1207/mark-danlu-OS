/**
 * Convert a string into a safe filename by removing invalid characters
 * and replacing whitespace with underscores.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}
