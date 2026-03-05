# Architectural Rationale History (QA_HISTORY)

### Inquiry: Shift to DeepSeek Reasoner as Primary (v1.1.0)
**ISO-8601 Timestamp:** 2026-03-02T10:00:00Z
**Contextual Inquiry:** Why prioritize DeepSeek Reasoner over Gemini 2.0 Flash for synthesis?
**Staff Technical Response:**
DeepSeek-V3 (Chat) demonstrates superior technical signal extraction and nuanced community sentiment analysis for engineering-heavy content (HN).
1. **Decision:** DeepSeek becomes the primary engine for `extractArguments` (Map) and `generateAnalysis` (Reduce).
2. **Fallback:** Gemini 2.0 Flash remains the high-speed fallback and primary provider for `pgvector` embeddings (3072 dims) to maintain cost efficiency and context window resilience.
3. **Consistency:** This alignment ensures "Modern Broadside" summaries meet the Staff Engineer quality bar for technical depth.

### Inquiry: Analysis of EADDRINUSE Error in Worker Service (v1.1.2)
**ISO-8601 Timestamp:** 2026-03-05T15:15:00Z
**Contextual Inquiry:** Why does `docker compose exec worker npm run start -- --enqueue` fail with `Error: listen EADDRINUSE: address already in use :::3001`?
**Staff Technical Response:**
A technical investigation into the `@hn-digest/worker` startup sequence revealed a conflict between the persistent container process and ad-hoc CLI executions.

1. **Root Cause: Automatic API Server Boot**
    - **Context:** The `worker` container is designed as a long-running service that hosts a Management API on port 3001 for health checks and manual triggers.
    - **Analysis:** `worker/src/infrastructure/api-server.ts` contains a top-level side effect that calls `serve()` on port 3001 if `NODE_ENV !== 'test'`. This module is imported at the top level of `worker/src/index.ts`.
    - **Conflict:** Using `docker compose exec` to run `npm run start -- --enqueue` spawns a *secondary* Node.js process within the *same* network namespace (the container). This secondary process also imports `index.ts`, which attempts to bind a second listener to port 3001, resulting in `EADDRINUSE`.

2. **Resolution Strategy**
    - **Short-term:** Use `docker compose exec worker node -e "import('./src/index.js').then(m => m.runScraperAndEnqueue())"` (if compiled) or refactor the entry point.
    - **Long-term:** Decouple the API server from the main module's side effects. The API server should only be initialized if the process is explicitly started as a "server" or if no CLI arguments like `--enqueue` are provided. Move `import './infrastructure/api-server'` into the `else` block of the `if (require.main === module)` check in `src/index.ts`.

### Inquiry: Analysis of Reduce Stage Failures (v1.1.1)
**ISO-8601 Timestamp:** 2026-03-05T14:30:00Z
**Contextual Inquiry:** Identify the root causes of "value.toISOString is not a function" and Zod "too_small" errors in the worker logs.
**Staff Technical Response:**
A technical audit of the `worker` service logs revealed two critical regression points in the Map-Reduce pipeline:

1. **Root Cause: `value.toISOString is not a function`**
    - **Context:** Occurs in `DrizzleAnalysisRepository.saveAnalysis` during the persistence phase of a Reduce job.
    - **Analysis:** BullMQ job data is serialized to JSON for storage in Redis. The `ScrapedStory.timestamp` field (a `Date` object) is converted to an ISO string during serialization. When the `reduceWorker` retrieves the job, `story.timestamp` is a `string`. Drizzle ORM's `timestamp` column mapping expects a `Date` object to perform its own internal formatting (calling `.toISOString()`). Passing the raw string directly triggers the type error.
    - **Resolution Strategy:** Re-instantiate the `Date` object in the repository layer using `new Date(story.timestamp)` before passing it to the Drizzle insertion logic.

2. **Root Cause: Zod `too_small` for `summary_paragraphs`**
    - **Context:** Occurs during `LLMIntelligence.generateAnalysis` validation.
    - **Analysis:** The `AnalysisDTOSchema` enforces a `.min(2)` constraint on the `summary_paragraphs` array. While the system prompt provides a two-paragraph example, it lacks an explicit "MUST" directive for the count. Consequently, DeepSeek (or any LLM) may occasionally provide a single, dense paragraph for shorter articles, violating the schema.
    - **Resolution Strategy:** Harden the LLM system prompt in `LLMIntelligence.ts` with explicit schema rules: `"summary_paragraphs" MUST be an array of at least 2 strings.`

3. **Secondary Discovery: Embedding Dimension Mismatch**
    - **Analysis:** Logs indicated an "expected 768 dimensions, not 3072" error. This is a direct consequence of switching to `Gemini 2.0 Flash` for embeddings, which uses a 3072-dimension vector by default, while the `analyses.embedding` column in `packages/db/schema.ts` was hardcoded to 768.
    - **Resolution Strategy:** Synchronize the database schema with the model output by updating the `vector` dimension to 3072.

## [v1.0.0] - 2026-03-01

### Inquiry: 100% Test Coverage Strategy for V2 Overhaul
**ISO-8601 Timestamp:** 2026-03-03T12:10:00Z
**Contextual Inquiry:** How can we ensure 100% test coverage and system resilience for the V2 overhaul?
**Staff Technical Response:**
A comprehensive "Ironclad" Test Plan was developed, merging existing E2E/Integration tests with 24+ new critical cases targeting infrastructure chaos (Redis/DB failures), Python bridge timeouts, RSC hydration errors, and OTel trace propagation. 100% Line/Branch coverage via Vitest and Playwright is now a mandatory sign-off gate. See `docs/TEST_PLAN_V2_OVERHAUL.md` for details.

### Inquiry: Analysis of High-Concurrency Parallel Stress Test
**Staff Technical Response:**
Removing orchestration staggering successfully proved that the system can handle a full parallel burst.
1. **Prompt Hardening Result:** The "OBJECT not string" constraint resolved the previous sentiment drift. DeepSeek now correctly structures cohort analysis as objects.
2. **Topic Drift Discovery:** A new fragility was identified: under load, the model ignores the `topic` enum in favor of descriptive titles.
3. **Strategic Recommendation:** We must implement a **Topic Canonicalizer** within the Zod schema's `preprocess` or `.catch()` logic. This will map creative LLM topics (e.g., "AI's Impact on Junior Devs") to our stable buckets (e.g., "AI Applications") without failing the entire synthesis.
