import { describe, it, expect } from 'vitest';
import { renderPrompt } from '../../src/prompts/renderer.js';

describe('renderPrompt', () => {
  it('replaces simple {{variable}} placeholders', () => {
    const template = 'Hello, {{name}}! Today is {{day}}.';
    const result = renderPrompt(template, { name: 'Alice', day: 'Monday' });
    expect(result).toBe('Hello, Alice! Today is Monday.');
  });

  it('replaces missing variables with empty string', () => {
    const template = 'Hello, {{name}}{{suffix}}!';
    const result = renderPrompt(template, { name: 'Bob' });
    expect(result).toBe('Hello, Bob!');
  });

  it('handles conditional {{#if var}}...{{/if}} block when truthy', () => {
    const template = 'Start{{#if showMiddle}} middle {{/if}}end';
    const result = renderPrompt(template, { showMiddle: true });
    expect(result).toBe('Start middle end');
  });

  it('omits conditional block when falsy', () => {
    const template = 'Start{{#if showMiddle}} middle {{/if}}end';
    const result = renderPrompt(template, { showMiddle: false });
    expect(result).toBe('Startend');
  });

  it('supports {{#if}}...{{else}}...{{/if}}', () => {
    const template = '{{#if premium}}Premium content{{else}}Free content{{/if}}';
    expect(renderPrompt(template, { premium: true })).toBe('Premium content');
    expect(renderPrompt(template, { premium: false })).toBe('Free content');
  });

  it('handles nested variables in conditional', () => {
    const template = '{{#if user}}Hello {{name}}{{/if}}';
    expect(renderPrompt(template, { user: 'Alice', name: 'Alice' })).toBe('Hello Alice');
    expect(renderPrompt(template, { user: '', name: '' })).toBe('');
  });

  it('handles number variables', () => {
    const template = 'Count: {{count}}';
    expect(renderPrompt(template, { count: 42 })).toBe('Count: 42');
  });
});
