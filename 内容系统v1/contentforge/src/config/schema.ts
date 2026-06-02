import { z } from 'zod';

const ProviderConfigSchema = z.object({
  type: z.enum(['anthropic', 'openai', 'kimi']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  defaultModel: z.string(),
});

const StepOverrideSchema = z.object({
  providerKey: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
});

const ConfigSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
  defaultProvider: z.string(),
  scenarios: z
    .object({
      create: z
        .object({
          steps: z.record(z.string(), StepOverrideSchema).optional(),
        })
        .optional(),
      recreate: z
        .object({
          steps: z.record(z.string(), StepOverrideSchema).optional(),
        })
        .optional(),
    })
    .optional(),
  concurrency: z
    .object({
      maxParallel: z.number().default(3),
      batchSize: z.number().default(5),
    })
    .optional(),
  output: z
    .object({
      dir: z.string().default('./output'),
      saveIntermediateArtifacts: z.boolean().default(true),
    })
    .optional(),
  costControl: z
    .object({
      maxCostPerRun: z.number().optional().describe('Maximum estimated cost per run in USD'),
      onExceedAction: z.enum(['skip-local-rewrite', 'abort']).default('skip-local-rewrite'),
    })
    .nullish(),
  inputValidation: z
    .object({
      minLengthError: z.number().optional().describe('Minimum content length (chars) to allow — below this blocks with error'),
      minLengthWarn: z.number().optional().describe('Content length below this generates a warning but continues'),
      htmlHandling: z.enum(['strip', 'reject']).default('strip'),
    })
    .optional(),
  search: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.enum(['tavily', 'serper', 'bing']).optional(),
      apiKey: z.string().optional(),
      obsidianEnabled: z.boolean().default(false),
      obsidianTopK: z.number().default(3),
      obsidianThreshold: z.number().min(0).max(1).default(0.80),
    })
    .optional(),
  embedding: z
    .object({
      primary: z.enum(['tavily', 'google']).default('tavily'),
      fallback: z.enum(['tavily', 'google']).default('google'),
    })
    .optional(),
  image: z
    .object({
      primary: z.enum(['pollinations']).default('pollinations'),
      width: z.number().default(1024),
      height: z.number().default(1024),
      model: z.string().default('flux'),
    })
    .optional(),
  textProviders: z
    .object({
      rotationOrder: z.array(z.string()).default(['openai', 'kimi', 'gemini']),
    })
    .optional(),
  obsidian: z
    .object({
      vaultPath: z.string().describe('Absolute path to Obsidian vault root'),
      readDirs: z
        .array(z.string())
        .default(['40_知识库/原子库', '40_知识库/洞察库', '40_知识库/金句库', '40_知识库/思维模型', '40_知识库/人生哲学', '30_研究/书籍拆解'])
        .describe('Relative paths under vault to read knowledge from'),
      writeDir: z.string().default('50_资源/生成文章').describe('Relative path under vault to write generated articles'),
      embeddingSearch: z
        .object({
          enabled: z.boolean().default(false).describe('Enable embedding-based semantic re-ranking in Obsidian search'),
          semanticWeight: z.number().min(0).max(1).default(0.5).describe('Weight for semantic score vs keyword (0=keyword-only, 1=semantic-only)'),
          topK: z.number().default(8).describe('Max results to return from semantic search'),
        })
        .optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
