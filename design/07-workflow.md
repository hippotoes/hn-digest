# Development Process & Workflow
**Objective:** A rigorous, staged routine for building the HN Digest, prioritizing 100% local verification and "Deployment from Day 1."

## 1. The Staged Implementation Journey

### Stage 1: The Containerized MVP (Weeks 1-2)
**Goal:** A functional end-to-end pipeline (Fetch -> Analyze -> Store -> View).
- **Core Tasks:**
  - Setup Docker Orchestration (App, DB, Worker, Redis).
  - Basic Scraper: Fetch top 10 HN stories and extract text via Trafilatura.
  - Basic Inference: Single LLM call (Gemini) for a simple summary.
  - Basic Persistence: Store story and summary in Postgres.
  - Basic API: Hono-based endpoint for fetching the daily digest.
  - Basic UI: List today's summaries in a simple Serif theme.
- **Reference:** See `design/08-prompts.md#stage-1-mvp` for implementation prompts.

### Stage 2: Intelligence & Hybrid Search (Weeks 3-4)
**Goal:** Deep analysis, sentiment clusters, and semantic search.
- **Core Tasks:**
  - Queueing: Implement BullMQ for robust job management between scraper and analyzer.
  - Sentiment Engine: Implement the 4-cluster analysis and prevalence scoring.
  - Reliability: Implement JSON repair and "Self-Healing" logic.
  - Vectorization: Generate and store story embeddings (pgvector).
  - Hybrid Search: Implement the combined SQL + Vector search in Hono.
- **Reference:** See `design/08-prompts.md#stage-2-intelligence` for implementation prompts.

### Stage 3: Enterprise Polish & Hardening (Weeks 5-6)
**Goal:** Notifications, user features, and system-wide verification.
- **Core Tasks:**
  - User Layer: Authentication, bookmarks, and topic preferences.
  - Notifier: Slack/Email alerts via background workers.
  - Audits: Performance (Lighthouse), Security, and Accessibility (a11y).
  - Production CD: Finalize GitHub Actions for multi-environment deployment.
- **Reference:** See `design/10-verification-prompts.md` for audit prompts.

---

## 2. The Daily Development Routine
For every feature or bug fix, the developer (or agent) must follow this 5-step loop:

1. **Context Alignment:**
   - Read the relevant module document (e.g., `design/01-scraper-engine.md`).
   - Identify the target implementation prompt in `design/08-prompts.md`.

2. **Isolated Implementation:**
   - Develop the logic within the local Docker container (`docker-compose exec ...`).
   - Ensure all new code follows `design/09-standards.md`.

3. **Local Verification (Mandatory):**
   - Run unit/integration tests: `docker-compose run --rm worker npm test`.
   - Perform a manual check of the UI or API via `localhost`.
   - Verify DB state using Drizzle Studio.

4. **Documentation & Schema Sync:**
   - If the schema changed, run `npx drizzle-kit generate:pg`.
   - Update the module design document if any interfaces were modified.

5. **Commit & Push:**
   - Ensure `pre-commit` hooks pass.
   - Push to `main` (or feature branch) to trigger the "Local-Parity" CI pipeline.

---

## 3. Global Guardrails
- **No Manual Deploys:** All deployments must happen via CI after passing the containerized test suite.
- **Mock-First:** Use `MOCK_LLM=true` for 90% of local development to preserve credits and speed up the inner loop.
- **Parity is Law:** Any change that works locally but fails in Docker is considered a regression.
