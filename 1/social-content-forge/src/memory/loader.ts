import { loadGlobalMemory, loadProjectMemory, GlobalMemory, ProjectMemory, MemoryLoadResult } from './index';
import { checkForNewStyleCases } from '../style-learning'; // forward ref, will be implemented later

export class MemoryLoader {
  constructor(private projectRoot: string) {}

  loadOnStartup(): MemoryLoadResult {
    const globalMemory = loadGlobalMemory();
    const projectMemory = loadProjectMemory(this.projectRoot);

    // Note: checkForNewStyleCases will be wired up when style-learning module exists
    let newCasesFound: string[] = [];
    try {
      const { checkForNewStyleCases } = require('../style-learning');
      newCasesFound = checkForNewStyleCases(this.projectRoot);
    } catch {
      // style-learning not yet implemented, skip
    }

    return {
      globalMemory,
      projectMemory,
      newCasesFound,
    };
  }

  summarizeForContext(result: MemoryLoadResult): string {
    const parts: string[] = [];

    if (result.globalMemory) {
      parts.push(`沟通偏好: ${result.globalMemory.communicationStyle}`);
    }

    if (result.projectMemory) {
      parts.push(`项目状态: ${result.projectMemory.summary}`);
      if (result.projectMemory.pendingTasks.length > 0) {
        parts.push(`待办: ${result.projectMemory.pendingTasks.join(', ')}`);
      }
    }

    return parts.join(' | ');
  }
}
