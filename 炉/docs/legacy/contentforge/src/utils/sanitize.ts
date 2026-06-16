/**
 * Convert a string into a safe filename by removing invalid characters
 * and replacing whitespace with underscores.
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*：，（）；？]/g, '') // remove ASCII/broken punctuation including Chinese variants
    .replace(/[？]/g, '')           // remove Chinese question mark
    .replace(/[：，]/g, '_')       // replace Chinese colon/comma with underscore
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}
