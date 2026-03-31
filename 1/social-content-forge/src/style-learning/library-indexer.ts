import * as fs from 'fs';
import * as path from 'path';
import { LibraryIndex } from './types';

const STYLE_LIBRARY_PATH = 'docs/style-library';
const INDEX_FILE = 'library.json';

export class LibraryIndexer {
  constructor(private projectRoot: string) {}

  /**
   * Get the library index
   */
  getIndex(): LibraryIndex {
    const indexPath = path.join(this.projectRoot, STYLE_LIBRARY_PATH, INDEX_FILE);

    if (fs.existsSync(indexPath)) {
      try {
        const content = fs.readFileSync(indexPath, 'utf-8');
        const data = JSON.parse(content);
        return {
          lastUpdated: data.lastUpdated || new Date().toISOString().split('T')[0],
          lastCheckedFile: data.lastCheckedFile || '',
          goodCount: data.goodCount || 0,
          badCount: data.badCount || 0,
          totalInsights: data.totalInsights || 0,
        };
      } catch (e) {
        // Fall through
      }
    }

    return {
      lastUpdated: new Date().toISOString().split('T')[0],
      lastCheckedFile: '',
      goodCount: 0,
      badCount: 0,
      totalInsights: 0,
    };
  }

  /**
   * Update the library index
   */
  updateIndex(index: LibraryIndex): void {
    const indexPath = path.join(this.projectRoot, STYLE_LIBRARY_PATH, INDEX_FILE);
    const dirPath = path.dirname(indexPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const data = {
      lastUpdated: new Date().toISOString().split('T')[0],
      lastCheckedFile: index.lastCheckedFile,
      goodCount: index.goodCount,
      badCount: index.badCount,
      totalInsights: index.totalInsights,
    };

    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get the last checked file from index
   */
  getLastCheckedFile(): string {
    return this.getIndex().lastCheckedFile;
  }

  /**
   * Set the last checked file
   */
  setLastCheckedFile(filename: string): void {
    const index = this.getIndex();
    index.lastCheckedFile = filename;
    this.updateIndex(index);
  }
}