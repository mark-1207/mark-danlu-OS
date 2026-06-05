/**
 * Prompt template variable renderer.
 * Supports {{variableName}}, {{#if variableName}}...{{/if}} conditional blocks,
 * and {{#each arrayVar}}...{{/each}} iteration blocks.
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
  variables: Record<string, string | boolean | number | object | undefined>,
): string {
  let rendered = template;

  // Process each blocks: {{#each arrayVar}}...{{/each}}
  rendered = rendered.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, arrayVar, blockContent) => {
      const array = variables[arrayVar];
      if (!Array.isArray(array) || array.length === 0) {
        return '';
      }
      return array.map(item => {
        let block = blockContent;
        // Replace {{this.property}} first (e.g., {{this.name}})
        block = block.replace(/\{\{this\.(\w+)\}\}/g, (_: string, propName: string) => {
          if (item && typeof item === 'object' && propName in item) {
            return String((item as Record<string, unknown>)[propName]);
          }
          return '';
        });
        // Replace {{this}} with the current item
        block = block.replace(/\{\{this\}\}/g, String(item));
        // Replace {{property}} with item.property (for current item context)
        block = block.replace(/\{\{(\w+)\}\}/g, (_: string, propName: string) => {
          if (item && typeof item === 'object' && propName in item) {
            return String((item as Record<string, unknown>)[propName]);
          }
          return '';
        });
        return block;
      }).join('');
    },
  );

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
