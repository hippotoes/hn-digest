# Testing Framework: "Reliability First"
**Objective:** End-to-end correctness across a multi-modal, AI-driven system.

## 1. Testing Levels
-   **Unit Tests:** Logic in Scraper (regex, date handling), Orchestrator (prompt construction), and Backend (API logic).
-   **Integration Tests:** API to Database, Scraper to Ingestion Queue, Orchestrator to LLM APIs.
-   **E2E (End-to-End):** Next.js UI tests (Playwright) ensuring story cards render correctly across all devices.

## 2. AI-Specific Testing: "LLM-as-a-Judge"
-   **Golden Dataset:** A hand-curated set of 50 stories with "ground truth" summaries.
-   **Prompt Regression Tests:** Every time a prompt changes, we run the golden dataset and use a second LLM (the "Judge") to score the new output against the ground truth on a scale of 1-5.
-   **Semantic Drift Check:** Verify that the "Summary Confidence Score" from the judge remains > 0.8.

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
