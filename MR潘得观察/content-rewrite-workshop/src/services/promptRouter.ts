import matter from 'gray-matter';
import { llmManager } from './llm/manager';
import { useSettingsStore } from '../stores/settingsStore';
import type { Message } from './llm/types';

// 使用 Vite 的 import.meta.url 方式获取 prompts 目录路径
const PROMPTS_DIR = new URL('../prompts', import.meta.url).href.replace(/\/$/, '');

/**
 * 流式输出片段
 */
export interface StreamingChunk {
  content: string;
  done: boolean;
}

/**
 * 路由执行结果（非流式）
 */
export interface RouterResult {
  success: boolean;
  raw: string;
  parsed: any | null;
  usedTemplateId: string;
  usedModel: string;
  error?: string;
}

/**
 * 流式执行结果
 */
export interface StreamResult {
  success: boolean;
  content: string;
  usedTemplateId: string;
  usedModel: string;
  error?: string;
}

/**
 * 模板配置
 */
export interface TemplateConfig {
  id: string;
  name: string;
  type?: string;
  platform?: string;
  variables?: string[];
  outputFormat?: 'json' | 'text';
  system?: boolean;
  filePath: string;
  content: string;
}

/**
 * Prompt 路由中枢
 * 负责模板加载、变量替换、LLM 调用
 */
export class PromptRouter {
  private routeTable: Map<string, TemplateConfig> = new Map();
  private initialized: boolean = false;

  /**
   * 初始化：扫描 prompts 目录构建路由表
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const templates = this.scanDirectory(PROMPTS_DIR);

    for (const template of templates) {
      this.routeTable.set(template.id, template);
    }

    this.initialized = true;
  }

  /**
   * 递归扫描目录，返回所有模板配置
   */
  private scanDirectory(dirPath: string): TemplateConfig[] {
    const results: TemplateConfig[] = [];

    // 使用 fetch 获取目录列表（Vite 静态资源方式）
    // 由于 Vite 不支持直接读取目录，我们使用动态 import 方式扫描
    // 这里我们硬编码已知的模板路径，因为 Vite 的 import.meta.glob 可以获取文件列表
    const templates = import.meta.glob('../prompts/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

    for (const [filePath, rawContent] of Object.entries(templates)) {
      try {
        const parsed = matter(rawContent);
        const relativePath = filePath.replace(/^.*\/prompts\//, 'prompts/').replace(/\.md$/, '');

        const template: TemplateConfig = {
          id: parsed.data.id || relativePath.replace(/[\/\\]/g, '-'),
          name: parsed.data.name || parsed.data.id || relativePath,
          type: parsed.data.type,
          platform: parsed.data.platform,
          variables: parsed.data.variables || [],
          outputFormat: parsed.data.outputFormat || 'text',
          system: parsed.data.system || false,
          filePath: filePath,
          content: parsed.content.trim(),
        };

        results.push(template);
      } catch (error) {
        console.warn(`Failed to parse template at ${filePath}:`, error);
      }
    }

    return results;
  }

  /**
   * 替换模板中的变量
   * 将 {xxx} 替换为 context 中的值，未找到的变量替换为空字符串
   */
  private replaceVariables(template: string, context: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : '';
    });
  }

  /**
   * 执行模板（同步模式）
   */
  async execute(
    templateId: string,
    context: Record<string, string>,
    options?: {
      systemPrompt?: string;
      model?: string;
    }
  ): Promise<RouterResult> {
    // 自动初始化
    if (!this.initialized) {
      await this.init();
    }

    // 查找模板
    const template = this.routeTable.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 获取 AI 配置
    const { ai } = useSettingsStore.getState();
    const providers = ai.providers;
    const failover = ai.failover;

    // 替换变量
    const promptContent = this.replaceVariables(template.content, context);

    // 构建消息
    const messages: Message[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: promptContent });

    try {
      // 调用 LLM
      const response = await llmManager.chat(messages, providers, failover, {
        model: options?.model,
      });

      const raw = response.content;
      let parsed: any | null = null;
      let parseError: string | undefined;

      // 如果是 JSON 格式，尝试解析
      if (template.outputFormat === 'json') {
        try {
          // 去除 markdown 代码块标记
          const jsonStr = raw.replace(/```json\s*([\s\S]*?)```/i, '$1').trim();
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          parseError = e instanceof Error ? e.message : 'JSON parse failed';
        }
      }

      return {
        success: !parseError,
        raw,
        parsed,
        usedTemplateId: templateId,
        usedModel: response.model || options?.model || providers.find(p => p.isPrimary)?.model || '',
        error: parseError || undefined,
      };
    } catch (error) {
      return {
        success: false,
        raw: '',
        parsed: null,
        usedTemplateId: templateId,
        usedModel: options?.model || providers.find(p => p.isPrimary)?.model || '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 执行模板（流式模式）
   * 流式失败时降级到同步模式
   */
  async executeStream(
    templateId: string,
    context: Record<string, string>,
    onChunk: (chunk: StreamingChunk) => void,
    options?: {
      systemPrompt?: string;
      model?: string;
    }
  ): Promise<StreamResult> {
    // 自动初始化
    if (!this.initialized) {
      await this.init();
    }

    // 查找模板
    const template = this.routeTable.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 获取 AI 配置
    const { ai } = useSettingsStore.getState();
    const providers = ai.providers;
    const failover = ai.failover;

    // 替换变量
    const promptContent = this.replaceVariables(template.content, context);

    // 构建消息
    const messages: Message[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: promptContent });

    // 尝试流式调用
    try {
      await llmManager.chatStream(
        messages,
        providers,
        failover,
        (chunk) => {
          onChunk({
            content: chunk.content,
            done: chunk.done,
          });
        },
        {
          model: options?.model,
        }
      );

      return {
        success: true,
        content: '', // 流式模式下内容通过 onChunk 传递
        usedTemplateId: templateId,
        usedModel: options?.model || providers.find(p => p.isPrimary)?.model || '',
      };
    } catch (error) {
      // 流式失败，降级到同步模式并模拟流式输出
      console.warn(`Streaming failed for template ${templateId}, falling back to sync mode:`, error);

      try {
        const result = await this.execute(templateId, context, options);

        if (result.success) {
          // 模拟流式输出：分批发送，每批50字符，20ms延迟
          const content = result.raw;
          const chunkSize = 50;
          const delay = 20;

          for (let i = 0; i < content.length; i += chunkSize) {
            const chunkContent = content.slice(i, i + chunkSize);
            const isDone = i + chunkSize >= content.length;

            onChunk({
              content: chunkContent,
              done: isDone,
            });

            if (!isDone) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          return {
            success: true,
            content: result.raw,
            usedTemplateId: templateId,
            usedModel: result.usedModel,
          };
        } else {
          return {
            success: false,
            content: '',
            usedTemplateId: templateId,
            usedModel: result.usedModel,
            error: result.error,
          };
        }
      } catch (fallbackError) {
        return {
          success: false,
          content: '',
          usedTemplateId: templateId,
          usedModel: options?.model || providers.find(p => p.isPrimary)?.model || '',
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        };
      }
    }
  }

  /**
   * 获取所有已加载的模板
   */
  getTemplates(): TemplateConfig[] {
    return Array.from(this.routeTable.values());
  }

  /**
   * 根据 ID 获取模板
   */
  getTemplate(templateId: string): TemplateConfig | undefined {
    return this.routeTable.get(templateId);
  }

  /**
   * 根据 type 获取模板列表
   */
  getTemplatesByType(type: string): TemplateConfig[] {
    return Array.from(this.routeTable.values()).filter(t => t.type === type);
  }

  /**
   * 根据 platform 获取模板列表
   */
  getTemplatesByPlatform(platform: string): TemplateConfig[] {
    return Array.from(this.routeTable.values()).filter(t => t.platform === platform);
  }

  /**
   * 重新扫描并加载模板
   */
  async reload(): Promise<void> {
    this.routeTable.clear();
    this.initialized = false;
    await this.init();
  }
}

// 导出单例
export const promptRouter = new PromptRouter();
