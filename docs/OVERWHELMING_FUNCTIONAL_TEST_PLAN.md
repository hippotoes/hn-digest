# ☢️ The "Nuclear-Level" Overwhelming Functional Test Plan (500+ Cases)

## 1. Overview
This plan represents an industrial-grade expansion of the testing lifecycle. It moves beyond standard verification into **Adversarial Chaos Engineering**. The goal is 100% reliability in a hostile, non-deterministic environment.

---

## 2. Phase 1: Ingestion & Orchestration (150 Cases)
**Goal:** Verify that not a single byte of Hacker News data is lost or corrupted, regardless of network state.

### 1.1 HN API & Network Resilience (50 Cases)
*   **Cases 1-10 (Response Codes):** Simulate HTTP 100, 204, 301, 302, 307, 308, 400, 401, 403, 404 from every HN endpoint.
*   **Cases 11-20 (Timeouts):** Simulate "Slowloris" responses (1 byte/sec), DNS resolution failures, and TCP connection resets.
*   **Cases 21-30 (Malformed Payloads):** HN returns valid JSON but with `id` as string, `kids` as null, `type` as unknown, `deleted` as integer `1`.
*   **Cases 31-40 (Empty States):** Top stories returns `[]`, user has 0 comments, story has 0 score but 100 comments.
*   **Cases 41-50 (Concurrency):** Trigger 10 simultaneous `runPipeline` calls; verify Redis lock or idempotent handling prevents duplicate story entries.

### 1.2 Scraper & Extraction Adversaries (50 Cases)
*   **Cases 51-60 (Content Bloat):** Articles with 50,000 words, 5,000 images, or 1,000 nested `<table>` tags.
*   **Cases 61-70 (Encoding Chaos):** Articles in Shift-JIS, UTF-16, windows-1252, and mixed-encoding (mojibake) scenarios.
*   **Cases 71-80 (Anti-Bot Walls):** Scraper hits Cloudflare 403, "Access Denied" JS challenges, and captcha walls.
*   **Cases 81-90 (Structure Hijack):** Articles where the "main content" is inside an iframe, shadow DOM, or loaded via heavy async JS.
*   **Cases 91-100 (The "Infinite Page"):** A page that never stops loading (Verify 30s hard-kill on Trafilatura).

### 1.3 Orchestration & BullMQ States (50 Cases)
*   **Cases 101-110 (Job Lifecycles):** Verify state transitions: `Waiting` -> `Active` -> `Completed` -> `Cleaned`.
*   **Cases 111-120 (Failure Recovery):** Map job fails 4 times and succeeds on 5th (Exponential backoff check).
*   **Cases 121-130 (Redis Entropy):** Redis restarts mid-pipeline; verify BullMQ "Stalled Job" logic resumes processing.
*   **Cases 131-140 (Dependency Stall):** Parent job (Reduce) waits for 50 children; 1 child is manually removed from Redis. Verify parent failure.
*   **Cases 141-150 (Priority Inversion):** "Refresh Manifest" job enqueued behind 1000 "Analyze" jobs; verify manifest takes priority.

---

## 3. Phase 2: Intelligence & AI Engine (100 Cases)
**Goal:** Verify the "Staff Engineer" quality of synthesis across 100 adversarial AI scenarios.

### 2.1 Provider & Fallback Logic (30 Cases)
*   **Cases 151-160 (The Cascade):** DeepSeek 503 -> Gemini 2.0 503 -> Gemini 1.5 Flash 200.
*   **Cases 161-170 (Partial Success):** LLM returns 200 OK but with an "Internal Safety Filter" triggered instead of JSON.
*   **Cases 171-180 (Quota Exhaustion):** Mock `insufficient_quota` error and verify alert log component.

### 2.2 Zod & Self-Healing JSON (40 Cases)
*   **Cases 181-190 (Structure Corruption):** JSON keys spelled wrong (e.g., `summery` instead of `summary`).
*   **Cases 191-200 (Type Confusion):** `article_sentiment` returned as an array instead of an object.
*   **Cases 201-210 (Unicode Injection):** LLM injects ZWSP (Zero Width Space) or control characters inside JSON strings.
*   **Cases 211-220 (Markdown Overload):** LLM returns 3 separate markdown code blocks in one response.

### 2.3 Semantic & Truthfulness (30 Cases)
*   **Cases 221-230 (Agreement Bounds):** `estimated_agreement` check for values: "unanimous", "violent disagreement", "N/A", "0.5".
*   **Cases 231-240 (Topic Drift):** Story about "Cooking a Burger using a CPU" -> Topics: "Tech" AND "Others".
*   **Cases 241-250 (Length Constraints):** Force LLM to summarize a 1-sentence story vs a 10,000-word manifesto.

---

## 4. Phase 3: Core API & Vector Surface (100 Cases)
**Goal:** Hardening the API surface against millions of requests and malicious actors.

### 3.1 Vector Search Resilience (40 Cases)
*   **Cases 251-260 (Dimension Mismatch):** Search with 768-dim query against 3072-dim DB embeddings.
*   **Cases 261-270 (SQLi Extravaganza):** Injection in `q`, `limit`, `offset`, and custom headers.
*   **Cases 271-280 (Performance Bounds):** Search query containing 10,000 characters.
*   **Cases 281-290 (Zero-Vector):** Search query that embeds to all zeros.

### 3.2 Bookmarks & Identity (30 Cases)
*   **Cases 291-300 (Concurrency Save):** User clicks "Save" 50 times in 1 second.
*   **Cases 301-310 (Foreign Key Violation):** Attempt to bookmark a story ID that was just deleted from the DB.
*   **Cases 311-320 (Cross-User Leak):** Verify User A cannot see or delete User B's bookmarks via API.

### 3.3 Health & Discovery (30 Cases)
*   **Cases 321-330 (Ready Gates):** Readiness returns 503 if Redis is up but Postgres is down (and vice-versa).
*   **Cases 331-340 (Consistency):** Verify `story_id` counts match across `stories` and `analyses` tables.
*   **Cases 341-350 (Manifest Dates):** Request date `1970-01-01` and `2099-12-31`.

---

## 5. Phase 4: User Experience & Browser E2E (150 Cases)
**Goal:** Pixel-perfect verification across the entire global device matrix.

### 4.1 UI State Transitions (50 Cases)
*   **Cases 351-360 (Connectivity):** Transition UI from "Online" -> "Offline" -> "Reconnecting" -> "Online".
*   **Cases 361-370 (Empty States):** "No stories today", "No bookmarks saved", "Search found nothing".
*   **Cases 371-380 (Error Boundaries):** Component level vs Page level error triggers.
*   **Cases 381-390 (Hydration):** Verify Next.js hydration doesn't cause a layout shift on the Sentiment Grid.
*   **Cases 391-400 (Loading):** Verify 10 different "Skeleton" shapes for various story lengths.

### 4.2 Responsiveness & Devices (50 Cases)
*   **Cases 401-410 (Small Mobile):** iPhone 5/SE (320px width) - Text scaling and button touch targets.
*   **Cases 411-420 (Tablets):** iPad Pro, Galaxy Tab - Transition from 1 to 2 columns.
*   **Cases 421-430 (Desktop):** 1080p, 1440p, 4K - Max-width container adherence.
*   **Cases 431-440 (Foldables):** Screen resize mid-session.
*   **Cases 441-450 (Orientation):** Landscape vs Portrait transitions.

### 4.3 Accessibility (A11y) & Logic (50 Cases)
*   **Cases 451-460 (Screen Readers):** NVDA/VoiceOver - Check image alt text, aria-labels on bookmark stars.
*   **Cases 461-470 (Keyboard Nav):** Focus trapping in modals, skip-to-content links.
*   **Cases 471-480 (Color Contrast):** Dark Mode vs Light Mode WCAG AA compliance check for all sentiment types.
*   **Cases 481-490 (Reduced Motion):** Verify all CSS animations stop when OS flag is set.
*   **Cases 491-500 (Typography):** Verify font fallback (Source Serif 4) if CDN is unreachable.

---

## 6. Execution: The "Endgame" Suite
To execute this 500-case suite, use the **Parametric Matrix Executor**:

```bash
# Full Nuclear Run
npm run test:nuclear

# Scoped Burst (e.g. AI Engine Only)
npm run test:nuclear -- --grep "Phase 2"
```
