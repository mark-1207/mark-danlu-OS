import fs from 'fs/promises';
import path from 'path';
import type { RevisionManifest } from '../scenarios/revision/types.js';
import { RevisionManifestSchema } from '../scenarios/revision/types.js';

export class RevisionStore {
  constructor(private outputDir: string) {}

  async loadManifest(runId: string): Promise<RevisionManifest | null> {
    const manifestPath = path.join(this.outputDir, runId, 'revisions', 'manifest.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      return RevisionManifestSchema.parse(JSON.parse(content));
    } catch {
      return null;
    }
  }

  async revertToVersion(runId: string, version: string): Promise<{ success: boolean; error?: string }> {
    const manifest = await this.loadManifest(runId);
    if (!manifest) {
      return { success: false, error: '未找到修订历史' };
    }

    const targetVersion = manifest.versions.find(v => v.version === version);
    if (!targetVersion) {
      return { success: false, error: `版本 ${version} 不存在` };
    }

    const versionPath = path.join(this.outputDir, runId, 'revisions', `${version}.md`);
    let versionContent: string;
    try {
      versionContent = await fs.readFile(versionPath, 'utf-8');
    } catch {
      return { success: false, error: `版本文件 ${version}.md 不存在` };
    }

    // The version content is the combined content of all platforms separated by '\n\n---\n\n'
    // We need to split it and write back to the run's content artifacts
    const sections = versionContent.split('\n\n---\n\n');
    const platformMap: Record<string, string> = {
      wechat: sections[0] ?? '',
      xiaohongshu: sections[1] ?? '',
      douyin: sections[2] ?? '',
    };

    const runDir = path.join(this.outputDir, runId);
    for (const [platform, content] of Object.entries(platformMap)) {
      if (content) {
        await fs.writeFile(path.join(runDir, `content-${platform}.json`), JSON.stringify(content, null, 2), 'utf-8');
      }
    }

    // Update manifest's currentVersion
    manifest.currentVersion = version;
    const manifestPath = path.join(this.outputDir, runId, 'revisions', 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return { success: true };
  }
}
