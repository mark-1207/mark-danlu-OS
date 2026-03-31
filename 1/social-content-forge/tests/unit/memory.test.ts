import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadGlobalMemory, loadProjectMemory, parseGlobalMemory, parseProjectMemory, extractSection, extractList } from '../../src/memory';

describe('Memory Module', () => {
  const PROJECT_ROOT = 'D:/myproject/1/social-content-forge';

  describe('parseGlobalMemory', () => {
    it('should parse communication style from markdown', () => {
      const content = `## 沟通风格偏好

- 简洁直接，不喜欢废话
- 要有事实在

## 项目通用习惯

- 方案要简洁
`;
      const memory = parseGlobalMemory(content);
      expect(memory.communicationStyle).toContain('简洁直接');
    });

    it('should return default if sections not found', () => {
      const content = `# Random content`;
      const memory = parseGlobalMemory(content);
      expect(memory.communicationStyle).toBe('简洁直接');
    });
  });

  describe('extractSection', () => {
    it('should extract section content', () => {
      const content = `## 项目状态

v2 规划中

## 核心结论

- 热点发现
- 自我进化`;
      const section = extractSection(content, '项目状态');
      expect(section).toContain('v2 规划中');
    });

    it('should return null for non-existent section', () => {
      const content = `## 其他内容`;
      const section = extractSection(content, '不存在的章节');
      expect(section).toBeNull();
    });
  });

  describe('extractList', () => {
    it('should extract list items', () => {
      const content = `## 待办

- [ ] 任务1
- [ ] 任务2
- 任务3`;
      const items = extractList(content, '待办');
      expect(items.length).toBe(3);
      expect(items).toContain('任务1');
    });
  });

  describe('loadProjectMemory', () => {
    it('should load existing project memory', () => {
      const memory = loadProjectMemory(PROJECT_ROOT);
      // May be null if memory doesn't exist yet
      if (memory) {
        expect(memory.projectId).toBeTruthy();
        expect(memory.lastUpdated).toBeTruthy();
      }
    });
  });
});
