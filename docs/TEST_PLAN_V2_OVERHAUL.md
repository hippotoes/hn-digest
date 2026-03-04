# HN Digest: "Ironclad" Test Plan (V2 Overhaul)

## 1. Overview
This document outlines the comprehensive testing strategy to achieve 100% code coverage and production-grade resilience for the `hn-digest` system. It covers the Frontend (Next.js 15), API (Hono), Background Workers (BullMQ), and Infrastructure (PostgreSQL/Redis/AI).

## 2. Testing Layers & Coverage Matrix

| Layer | Test Suite | Type | Tool | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Domain** | **Core Business Rules** | Unit | Vitest | Sentiment mapping, story ranking, DTOs. | **Planned** |
| **Worker** | **JSON Hardening** | Unit | Vitest | Self-healing LLM output validation. | **Existing** |
| **Worker** | **Python Bridge** | Integration | Vitest | Trafilatura extraction resilience. | **Planned** |
| **Worker** | **BullMQ Flows** | Functional | Vitest | Parent-Child job state management. | **Planned** |
| **Worker** | **Inference/AI** | Unit/Int. | Vitest | Provider fallbacks (DeepSeek -> Gemini). | **Existing** |
| **Worker** | **Persistence** | Infra | Vitest | Drizzle/PG transaction resilience. | **Existing** |
| **App** | **API Surface** | Integration | Vitest | Hono route logic & rate limiting. | **Existing** |
| **App** | **RSC/SSR** | Unit | Vitest | Component hydration and error boundaries. | **Planned** |
| **App** | **Search/Vector** | Integration | Vitest | PgVector accuracy & performance. | **Existing** |
| **E2E** | **Auth Flow** | E2E | Playwright | Signup, Login, Session Expiry. | **Existing** |
| **E2E** | **Bookmarks** | E2E | Playwright | Persistence & Optimistic UI rollbacks. | **Existing** |
| **E2E** | **UX/Sentiment** | E2E/UI | Playwright | Visual integrity & Responsiveness. | **Existing** |
| **System** | **Observability** | Integration | Vitest | OTel Trace & Log correlation. | **Planned** |
| **System** | **Security** | Security | Vitest/Zod | Sanitization & Prompt Injection. | **Planned** |

## 3. New Critical Test Cases (The "Gap" to 100%)

### 3.1 Worker Infrastructure Chaos
- **Redis Connection Loss:** Mock `ioredis` to throw connection errors during job enqueuing.
- **DB Deadlock:** Simulate concurrent writes to the same `story_id` to verify Drizzle retry logic.
- **Job Timeout:** Verify that a "stalled" scraping job is correctly moved back to the queue or failed after N retries.

### 3.2 Python & Scraper Resilience
- **Trafilatura Timeout:** Mock `child_process.exec` to hang and verify the Node worker terminates the process safely.
- **Malicious HTML:** Fixture-based testing with 10MB+ files and infinite recursion HTML to prevent memory leaks.
- **Empty Response:** Handle stories where the content is purely an image or video (no text to extract).

### 3.3 Frontend (Next.js 15) Boundaries
- **RSC Hydration Error:** Verify that the application falls back to a "Friendly Recovery" UI if the server component stream is corrupted.
- **Search Latency:** Simulate a 5-second delay in vector search and verify the Loading Skeleton state.
- **A11y (Accessibility):** Use `@axe-core/playwright` to ensure 100% WCAG AA compliance.

### 3.4 Observability & Security
- **Trace Correlation:** Verify that a `trace_id` generated in the Frontend is propagated through the API to the Worker logs.
- **Prompt Injection:** Ensure that scraped content containing "Ignore all previous instructions" does not affect the LLM analysis prompt.

## 4. Execution Strategy

### 4.1 Measuring Coverage
Coverage is measured using Vitest's V8 provider. The target is **100% Line, Branch, and Function coverage**.
```bash
# Generate coverage report
npm test -- --coverage
```

### 4.2 Local Parity (Docker)
All integration and E2E tests must run inside the `docker-compose` environment to ensure environment parity.
- `vitest` runs against mocked services where appropriate.
- `playwright` runs against the full stack (App + Worker + DB + Redis).

### 4.3 Validation & Sign-off
A stage is considered complete only when:
1. `npm test` (Unit/Integration) passes with 100% coverage.
2. `npx playwright test` (E2E) passes across 3 browsers (Chromium, Firefox, Webkit).
3. The "HITL Quality Gates" (Verification prompts from design docs) are satisfied.
