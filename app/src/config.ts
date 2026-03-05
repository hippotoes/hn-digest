import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().default('postgres://postgres:postgres@localhost:5433/hndigest'),
  AUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3005'),
  AUTH_TRUST_HOST: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://jaeger:4317'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MOCK_LLM: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
});

const env = envSchema.parse(process.env);

export const config = {
  env,
  ui: {
    pageSize: 10,
  }
};
