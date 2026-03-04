# Architectural Rationale History (QA_HISTORY)

### Inquiry: Shift to DeepSeek Reasoner as Primary (v1.1.0)
**ISO-8601 Timestamp:** 2026-03-02T10:00:00Z
**Contextual Inquiry:** Why prioritize DeepSeek Reasoner over Gemini 2.0 Flash for synthesis?
**Staff Technical Response:**
DeepSeek-R1 (Reasoner) demonstrates superior technical signal extraction and nuanced community sentiment analysis for engineering-heavy content (HN).
1. **Decision:** DeepSeek becomes the primary engine for `extractArguments` (Map) and `generateAnalysis` (Reduce).
2. **Fallback:** Gemini 2.0 Flash remains the high-speed fallback and primary provider for `pgvector` embeddings (3072 dims) to maintain cost efficiency and context window resilience.
3. **Consistency:** This alignment ensures "Modern Broadside" summaries meet the Staff Engineer quality bar for technical depth.

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
