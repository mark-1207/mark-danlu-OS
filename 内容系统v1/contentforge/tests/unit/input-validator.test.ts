import { describe, it, expect } from 'vitest';
import { validateAndCleanInput } from '../../src/utils/input-validator.js';

describe('input-validator', () => {
  describe('validateAndCleanInput', () => {
    it('passes valid normal article', async () => {
      // Need > 500 chars to avoid warning, > 200 to pass length check
      const content = '# 标题\n\n这是一篇正常的文章，有足够的正文内容用于分析。\n\n## 第二段\n\n这里有很多段落文本，确保内容足够长能够进行分析。'.repeat(8);
      const result = await validateAndCleanInput(Buffer.from(content, 'utf-8'), 'test.md');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.detectedIssues.wasHtml).toBe(false);
    });

    it('detects and strips HTML', async () => {
      // Need > 200 chars AFTER HTML stripping - HTML adds overhead, so raw needs more
      const htmlContent = '<html><body>' +
        '<p>这是 HTML 内容，包含足够的文字来通过长度检查。后面还有更多内容，确保整体文本足够长，能够通过最低长度要求。'.repeat(3) + '</p>' +
        '<br>第二行内容继续。第三段内容增加长度。'.repeat(3) +
        '</body></html>';
      const result = await validateAndCleanInput(Buffer.from(htmlContent), 'test.html');
      expect(result.errors).toHaveLength(0);
      expect(result.detectedIssues.wasHtml).toBe(true);
      expect(result.cleaned).not.toContain('<p>');
      expect(result.cleaned).not.toContain('<br>');
      expect(result.cleaned).toContain('这是 HTML 内容');
    });

    it('errors on empty content', async () => {
      const result = await validateAndCleanInput(Buffer.from(''), 'empty.md');
      expect(result.errors.some(e => e.includes('为空'))).toBe(true);
    });

    it('errors on pure links file', async () => {
      const content = 'https://example.com/article1\nhttps://example.com/article2\nhttps://example.com/article3';
      const result = await validateAndCleanInput(Buffer.from(content), 'links.txt');
      expect(result.errors.some(e => e.includes('链接') || e.includes('有效内容'))).toBe(true);
    });

    it('errors on pure title (no body)', async () => {
      const content = '# 这只是一个标题';
      const result = await validateAndCleanInput(Buffer.from(content), 'title.md');
      expect(result.errors.some(e => e.includes('标题'))).toBe(true);
    });

    it('errors on truncated content', async () => {
      // Need > 200 chars AND body >= 100 to pass isPureTitle and minLengthError
      // Then trigger isTruncated via unbalanced ASCII brackets [ only
      const body = '正文内容第一段，有足够的文字量来通过纯标题检查。第二段继续提供更多内容，确保整体达到最低长度要求。'.repeat(4);
      const truncatedPart = '这是一段没有完成的文字，没有闭合的括号[[[[[[';
      const content = '# 标题\n\n' + body + truncatedPart;
      const result = await validateAndCleanInput(Buffer.from(content), 'truncated.md');
      expect(result.errors.some(e => e.includes('截断'))).toBe(true);
    });

    it('errors on too-short content', async () => {
      // Total < 200 chars to fail minLengthError (but body must be < 100 AND total < 200 to fail isPureTitle first)
      // If body >= 100 but total < 200, isPureTitle catches it with "标题" error
      // So we need body < 100 AND total < 200 to get "过短" error
      const content = '# 标题\n\n只有一点点内容。';
      const result = await validateAndCleanInput(Buffer.from(content), 'short.md');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/过短|标题/);
    });

    it('warns on short-but-acceptable content (200-500 chars)', async () => {
      // Need total >= 200 AND body >= 100 to pass isPureTitle and minLengthError
      // Need total < 500 to trigger the "较短" warning
      const body = '这是一段可以接受的长度，但不算太长。'.repeat(12);
      const content = '# 标题\n\n' + body;
      const result = await validateAndCleanInput(Buffer.from(content), 'medium.md');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('较短');
    });

    it('passes UTF-8 encoded Chinese content', async () => {
      // Need > 500 chars for no warnings, > 200 for no errors
      const content = '# 中文标题\n\n这是中文正文内容。有足够的字数用于分析。\n\n第二段正文内容。'.repeat(7);
      const result = await validateAndCleanInput(Buffer.from(content, 'utf-8'), 'chinese.md');
      expect(result.errors).toHaveLength(0);
    });
  });
});
