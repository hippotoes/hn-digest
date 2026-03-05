import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().default('postgres://postgres:postgres@localhost:5433/hndigest'),
  REDIS_URL: z.string().url().default('redis://localhost:6381'),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().default('re_mock'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://jaeger:4317'),
  MAP_LLM_PROVIDER: z.enum(['deepseek', 'gemini']).default('deepseek'),
  TRANSPARENT_MAP: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  EMBEDDING_PROVIDER: z.enum(['gemini', 'together']).default('gemini'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MOCK_LLM: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
});

const env = envSchema.parse(process.env);

export const config = {
  env,
  scraper: {
    maxStoryLimit: 10,
    storyDelayMs: 1000,
    commentDelayMs: 250,
    retries: 3,
    trafilaturaTimeoutMs: 15000,
    maxContentLength: 15000,
  },
  jobs: {
    mapAttempts: 5,
    mapBackoffMs: 5000,
    reduceAttempts: 3,
    reduceBackoffMs: 10000,
    refreshManifestDelayMs: 300000,
    commentChunkSize: 50,
  },
  ai: {
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-chat',
    geminiModel: 'gemini-2.0-flash',
    embeddingModel: 'gemini-embedding-001',
    togetherEmbeddingModel: 'togethercomputer/m2-bert-80M-32k-retrieval',
    togetherBaseUrl: 'https://api.together.xyz/v1',
  }
};
