# Configuration Registry: Validated Environment Specifications

## 1. Overview
HN Digest uses a **Validated Registry** pattern. All configuration is defined in a central `config.ts` per module, validated via Zod, and exported as a type-safe object.

## 2. Worker Configuration Registry (`worker/src/config.ts`)

| Variable | Type | Default | Impact if Missing |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `z.string().url()` | N/A | **Fatal**: Database connection fail. |
| `REDIS_URL` | `z.string().url()` | `redis://localhost:6381` | **Fatal**: BullMQ queues won't start. |
| `GEMINI_API_KEY` | `z.string()` | N/A | **Fatal**: Embeddings and fallbacks fail. |
| `DEEPSEEK_API_KEY` | `z.string()` | N/A | **Critical**: Primary synthesis will fail. |
| `RESEND_API_KEY` | `z.string()` | `re_mock` | **Low**: Notifications will be logged to console. |
| `MAP_LLM_PROVIDER` | `z.enum()` | `deepseek` | **Medium**: Will use default provider. |
| `MAX_STORY_LIMIT` | `z.number()` | `10` | **Low**: Controls scraper batch size. |

## 3. Web/API Configuration Registry (`app/src/config.ts`)

| Variable | Type | Default | Impact if Missing |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `z.string().url()` | N/A | **Fatal**: Frontend cannot load any data. |
| `AUTH_SECRET` | `z.string()` | N/A | **Fatal**: NextAuth sessions will fail. |
| `NEXTAUTH_URL` | `z.string().url()` | `http://localhost:3005` | **Critical**: Auth redirects will break. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`| `z.string().url()`| `http://jaeger:4317` | **Low**: Tracing won't be exported. |

## 4. Implementation Guidelines
1. **Never use `process.env`** outside of the `config.ts` module.
2. All numeric values must be wrapped in `z.coerce.number()`.
3. In development, defaults are provided for Redis and Jaeger to ensure 100% local parity with minimal setup.
