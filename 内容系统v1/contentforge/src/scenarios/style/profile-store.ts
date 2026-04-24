import fs from 'fs/promises';
import path from 'path';
import { StyleProfileSchema, type StyleProfile } from './types.js';

export class StyleProfileStore {
  constructor(private stylesDir: string) {}

  private profilePath(name: string, type: StyleProfile['type']): string {
    return path.join(this.stylesDir, type, `${name}.json`);
  }

  async save(profile: StyleProfile): Promise<void> {
    const dir = path.join(this.stylesDir, profile.type);
    await fs.mkdir(dir, { recursive: true });
    const filePath = this.profilePath(profile.name, profile.type);
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
  }

  async load(name: string, type: StyleProfile['type']): Promise<StyleProfile | null> {
    const filePath = this.profilePath(name, type);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return StyleProfileSchema.parse(JSON.parse(content));
    } catch {
      return null;
    }
  }

  async list(type?: StyleProfile['type']): Promise<StyleProfile[]> {
    const types = type ? [type] : ['personal', 'external', 'blend'];
    const profiles: StyleProfile[] = [];
    for (const t of types) {
      const dir = path.join(this.stylesDir, t);
      try {
        const files = await fs.readdir(dir);
        for (const file of files.filter(f => f.endsWith('.json'))) {
          const profile = await this.load(file.replace('.json', ''), t);
          if (profile) profiles.push(profile);
        }
      } catch {
        // Directory doesn't exist
      }
    }
    return profiles;
  }

  async delete(name: string, type: StyleProfile['type']): Promise<boolean> {
    const filePath = this.profilePath(name, type);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}