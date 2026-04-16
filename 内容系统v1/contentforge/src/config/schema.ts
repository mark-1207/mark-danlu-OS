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
  search: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.enum(['tavily', 'serper', 'bing']).optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
