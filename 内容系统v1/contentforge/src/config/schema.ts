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
});

export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
