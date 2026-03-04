# ☢️ Nuclear Test Expansion Plan (20x Scale-Up)

This document outlines the strategy for expanding existing low-volume tests (<20 cases) by a factor of 20x to reach "Nuclear" coverage levels.

## 1. Objective
Identify all test suites currently operating at "standard" volumes and upgrade them to "stress-test" volumes using parametric data generation, fuzzy inputs, and state-machine permutations.

## 2. Target Files & Expansion Metrics

| File Path | Current Cases | Target Cases (20x) | Expansion Strategy |
| :--- | :--- | :--- | :--- |
| `app/tests/api.test.ts` | 10 | 200 | Parametric route testing with 20x variety in headers, auth states, and DB mock failures. |
| `app/tests/bookmarks.spec.ts` | 2 | 40 | E2E permutations of bookmarking, unbookmarking, and multi-tab sync scenarios. |
| `app/tests/mvp.spec.ts` | 1 | 20 | Viewport, browser locale, and network latency permutations for the core landing page. |
| `app/tests/search.test.ts` | 5 | 100 | 100x fuzzy search queries including Unicode, SQLi strings, and long-tail keywords. |
| `worker/tests/AnalysisOrchestrator.test.ts` | 3 | 60 | Race condition simulation and 20x permutations of story discovery states. |
| `worker/tests/BullMQQueue.test.ts` | 8 | 160 | 160x job lifecycle transitions including stalls, retries, and high-concurrency flows. |
| `worker/tests/DrizzleRepository.test.ts` | 4 | 80 | 80x persistence edge cases (e.g., massive text, invalid characters, conflict resolution). |
| `worker/tests/inference.test.ts` | 11 | 220 | 220x LLM prompt/response pairs with varied levels of JSON corruption and token limits. |
| `worker/tests/scraper.test.ts` | 8 | 160 | 160x HTML structure variations, nested comment depths, and encoding types. |
| `worker/tests/JsonHardening.test.ts` | 10 | 200 | 200x malformed JSON samples (missing brackets, trailing commas, mixed types). |
| `app/tests/functional/VectorSearchAPI.test.ts` | 4 | 80 | 80x vector dimension variations and similarity threshold edge cases. |

## 3. Implementation Tactics

### A. Parametric Data Generation
Transition from static `it()` blocks to `it.each()` or `test.describe` loops using generated arrays.
```typescript
const stressPayloads = Array.from({ length: 20 }, (_, i) => ({ id: i, data: generateFuzzyData(i) }));
it.each(stressPayloads)('Case %id: processes fuzzy payload', ({ data }) => { ... });
```

### B. Adversarial Inputs
For every expanded case, inject 20% "hostile" data:
- Zero-width spaces and control characters.
- Deeply nested JSON (10+ levels).
- Simulated network timeouts (using `vi.mock` delays).

### C. Resource Management
- **Parallelization**: Ensure expanded tests run in parallel to prevent CI slowdown.
- **Mocking**: Use `MOCK_LLM` and local DB containers to avoid external costs/rate limits.

## 4. Timeline
- **Phase 1**: Infrastructure & Unit Tests (`JsonHardening`, `Drizzle`, `Scraper`).
- **Phase 2**: Application Logic (`API`, `Search`, `Orchestrator`).
- **Phase 3**: E2E & Browser Stress (`MVP`, `Bookmarks`).

---
*Authorized by Gemini CLI - March 3, 2026*
