# Testing Framework: "Reliability First"
**Objective:** End-to-end correctness across a multi-modal, AI-driven system, with 100% automated verification.

## 1. Automated Testing Mandate
Every implementation step MUST be followed by an automated verification script executed by the agent. No human intervention is required for:
-   **Environment Setup:** Docker containers must be initialized and health-checked via script.
-   **Data Integrity:** DB migrations and seed data must be verified via SQL queries or ORM checks.
-   **Logic Validation:** Unit and integration tests (Vitest) must run to 100% pass rate.
-   **E2E Flow:** Playwright or `curl`-based smoke tests must confirm the full pipeline (Scraper -> Redis -> Worker -> DB -> API).

## 2. Testing Levels & Agent Execution
-   **Unit Tests:** Logic in Scraper, Orchestrator, and Hono API.
    -   *Agent Command:* `docker-compose run --rm worker npm run test:unit`
-   **Integration Tests:** API-to-DB and Worker-to-Redis interactions.
    -   *Agent Command:* `docker-compose run --rm worker npm run test:integration`
-   **E2E Smoke Tests:** Playwright-based browser tests for the UI.
    -   *Agent Command:* `docker-compose run --rm tests npx playwright test`

## 3. AI-Specific Testing: "Automated Judge"
-   **Golden Dataset:** A hand-curated set of 50 stories.
-   **Agent Verification:** The agent will trigger the `Golden Dataset` evaluation and parse the results. If the "Hallucination Score" exceeds the threshold (e.g., > 10% errors), the agent must backtrack and refine the prompt without being asked.

## 3. Infrastructure & CI/CD (Day 1)
-   **Local Containerized Tests:**
    -   Command: `docker-compose -f docker-compose.test.yml up --exit-code-from tests`.
    -   This spins up a fresh Postgres and Redis, runs all tests, and then shuts down.
-   **GitHub Actions:**
    -   Uses the exact same `docker-compose.test.yml` as the developer.
    -   Guarantees that "If it passes locally, it passes in CI."

## 4. Technology Stack & Containerization
-   **Vitest:** Runs inside the `worker` container.
-   **Playwright:** Runs against the `app` container.
-   **Environment:** All environment variables for testing are defined in `.env.test`.

## 5. Human-in-the-Loop (HITL) Quality Gates
While the agent automates technical verification (unit, integration, E2E), the following qualitative checks require human intervention before a stage is considered "Complete" or deployed to production.

### Module A: Scraper Engine
-   **Boilerplate Accuracy:** Spot-check 3-5 extracted articles. Ensure the scraper isn't capturing "Sign up for our newsletter" or "Related Stories".
-   **Paywall/WAF Strategy:** Decide if proxy services (e.g., Bright Data) are needed if major sites (WSJ, Bloomberg) return empty text.
-   **PDF Sanity:** Open parsed PDFs in the DB to ensure formulas/code blocks didn't turn into unreadable junk.

### Module B: Inference Orchestrator
-   **Technical Depth Audit:** Read 10 summaries to ensure they are "Staff Level" (insightful, architectural) rather than "Junior Level" (rephrasing the title).
-   **Cluster Distinctness:** Verify that the 4 sentiment clusters represent truly distinct cohorts, not just rewording of the same sentiment.
-   **Hallucination "False Positives":** Check if the automated Judge model is being too aggressive (flagging valid tech jargon) or too lenient.

### Module C: Persistence Layer
-   **Vector "Relevance" Check:** Perform a manual semantic search (e.g., "Kubernetes networking"). Ensure results are highly relevant.
-   **Data Growth Review:** Monitor Postgres storage after 1 week to confirm the 7-day TTL for raw text is sufficient.

### Module D: API & Backend
-   **Third-Party Console Config:** Manually configure Clerk/Supabase Auth dashboards (Redirect URLs, Social Logins).
-   **Email Deliverability:** Check your "Spam" folder to ensure SPF/DKIM records are working for BullMQ email alerts.
-   **Secret Management:** Provide real production API keys (Gemini, DB). The agent cannot create these.

### Module E: Web Client
-   **Real-Device Touch Test:** Load the UI on a physical mobile device. Ensure targets like the "Sentiment Gauge" are easy to tap.
-   **Contrast & Readability:** Subjectively evaluate if the "Playfair Display" font weight and dark-mode contrast are comfortable for long reading sessions.
-   **Navigation Flow:** Assess the framerate and "premium feel" of smooth scrolling and accordion expansions.

### System-Wide
-   **Billing Alert Thresholds:** Set "Hard Limits" in Google Cloud/OpenAI consoles to prevent budget overruns.
-   **Production "Green Light":** Explicitly approve the push to production after reviewing the staging environment.
