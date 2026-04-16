/**
 * Prompt template variable renderer.
 * Supports {{variableName}} and {{#if variableName}}...{{/if}} conditional blocks.
 */

export interface PromptTemplate {
  system: string;
  user: string;
}

/**
 * Render a prompt template by replacing {{variable}} placeholders
 * and processing {{#if}}...{{/if}} conditional blocks.
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | boolean | number | undefined>,
): string {
  let rendered = template;

  // Process conditional blocks: {{#if var}}...{{/if}} and {{#if var}}...{{else}}...{{/if}}
  rendered = rendered.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, varName, ifContent, elseContent = '') => {
      const value = variables[varName];
      if (value !== undefined && value !== false && value !== null && value !== '') {
        return ifContent;
      }
      return elseContent;
    },
  );

  // Replace simple {{variable}} placeholders
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null || value === false) {
      return '';
    }
    return String(value);
  });

  return rendered;
}
