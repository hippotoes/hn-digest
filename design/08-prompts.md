# Implementation Prompts: "The Agentic Library"
**Objective:** A categorized collection of rich, high-fidelity prompts to guide implementation.

---

## Stage 1: The Containerized MVP

### Prompt 1.1: Foundations & Scaffolding
> **Prompt:** "Act as a Staff Platform Engineer. Initialize the `hn-digest` project using Next.js 15, Hono, Drizzle ORM, and Tailwind CSS. Create a `docker-compose.yml` defining an `app` (Next.js/Hono), `worker` (Node service), `db` (PostgreSQL 16 with pgvector), and `redis` (BullMQ host). Setup the basic folder structure as per the design docs, including a `db/schema.ts`. Verify by running `docker-compose up` and performing a simple 'select 1' query from the `app` container to the `db` container."

### Prompt 1.2: Basic Scraper & Inference Pipeline
> **Prompt:** "Act as a Senior Backend Engineer. Implement a simplified version of Module A and Module B.
> 1. Create a worker that fetches the top 10 HN stories and uses `Trafilatura` (Python) to extract text.
> 2. Pass this text to `Gemini-2.0-Flash` to generate a 100-word summary.
> 3. Store the story and its summary in the Postgres database using Drizzle.
> 4. Verify by running the worker once via `docker-compose exec worker node ...` and checking the database for the results."

### Prompt 1.3: MVP Frontend Display
> **Prompt:** "Act as a Senior Frontend Engineer. Build the `DailyDigestPage` in Next.js.
> 1. Fetch the stored stories and summaries from the DB on the server.
> 2. Render them in a clean, Serif-themed layout (headings and body text).
> 3. Verify locally by visiting `localhost:3000` and ensuring today's stories are visible."

---

## Stage 2: Intelligence & Hybrid Search

### Prompt 2.1: Advanced Inference & Sentiment
> **Prompt:** "Act as a Senior AI Engineer. Upgrade the `InferenceOrchestrator` to include full analysis.
> 1. Implement the 300-word technical summary and 4 distinct sentiment clusters as defined in `design/02-inference-orchestrator.md`.
> 2. Integrate `Zod` for schema validation and the `json-repair` utility.
> 3. Implement the one-time 'Repair Call' logic.
> 4. Verify by running integration tests with `MOCK_LLM=true` and then with the real Gemini API for one story."

### Prompt 2.2: Vectorization & Semantic Search
> **Prompt:** "Act as a Database Engineer.
> 1. Add embedding generation (`text-embedding-004`) to the analysis pipeline.
> 2. Implement the hybrid search API in Hono (`GET /api/v1/search`) that combines keyword matching and vector similarity using `pgvector`.
> 3. Verify locally by inserting a test story and searching for it using semantic keywords (e.g., 'Rust memory safety' for a Rust-related story)."

---

## Stage 3: Enterprise Polish & Hardening

### Prompt 3.1: User Profiles & Notifier
> **Prompt:** "Act as a Full-Stack Engineer.
> 1. Setup NextAuth.js or Clerk for user authentication.
> 2. Implement 'Bookmark Story' and 'Topic Preferences' features.
> 3. Setup a BullMQ worker to send daily email alerts based on user-selected topics.
> 4. Verify by creating a test user locally, bookmarking a story, and ensuring the background job triggers correctly."

### Prompt 3.2: Production Hardening
> **Prompt:** "Act as a DevSecOps Engineer.
> 1. Review all `Dockerfile` and `docker-compose` configurations for security best practices.
> 2. Finalize the GitHub Action to deploy to Vercel and AWS/Fly.
> 3. Ensure all environment variables are properly secrets-managed.
> 4. Verify the staging deployment mirrors the local Docker environment."
