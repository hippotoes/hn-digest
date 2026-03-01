# HN Digest: Prototype to Enterprise Overhaul
**Author:** Staff Full-Stack Engineer

## 1. Executive Summary
The current `hn-digest` is a high-potential script-based prototype. To transform this into a full-fledged, scalable, and resilient product, we need to move from a synchronous, local-execution model to a distributed, cloud-native architecture. This overhaul focuses on performance, observability, and user experience.

---

## 2. Architectural Vision: "The Intelligence Engine"

### 2.1. Backend & Data Pipeline
*   **Infrastructure:** Migrate to a Serverless/Edge-first architecture using **Next.js** (Vercel) or **AWS Lambda**.
*   **Asynchronous Orchestration:**
    *   Replace synchronous loops with a distributed task queue (e.g., **Upstash QStash** or **BullMQ**).
    *   Implement "Fan-out" pattern: One trigger fetches HN IDs, which spawns $N$ individual analysis tasks.
*   **Persistence Layer:**
    *   **PostgreSQL (Prisma/Drizzle):** Store story metadata, AI summaries, and sentiment clusters.
    *   **Vector Database (Pinecone/pgvector):** Enable semantic search across historical digests.
*   **AI Resilience:**
    *   Implement **LLM Fallback & Routing**: Route to Gemini 2.0 Flash for speed/cost, fallback to DeepSeek-V3 or Claude 3.5 Sonnet for complex reasoning.
    *   **Prompt Management:** Use a tool like **LangSmith** or **Portkey** for versioning and A/B testing prompts.

### 2.2. Frontend: "The Modern Broadside"
*   **Framework:** **Next.js 15 (App Router)** with React Server Components (RSC) for near-instant page loads.
*   **Design System:**
    *   **Tailwind CSS + Shadcn UI** for a polished, accessible interface.
    *   Retain the "Source Serif 4" and "Playfair Display" aesthetic but add micro-interactions (Framer Motion).
*   **Dynamic Features:**
    *   User accounts with "Saved Stories" and custom email/Slack notifications.
    *   Real-time "Live" mode using WebSockets to show analysis as it happens.

---

## 3. Engineering Excellence (Staff-Level Priorities)

### 3.1. Observability & Reliability
*   **Tracing:** Implement **Sentry** for error tracking and **OpenTelemetry** for request tracing across the AI pipeline.
*   **Health Checks:** Automated "Drift Detection" to ensure AI summaries align with the original article content (using LLM-as-a-judge).
*   **Rate Limiting:** Global rate limiting at the API Gateway level to protect LLM quotas.

### 3.2. Performance Optimization
*   **Edge Caching:** Cache generated reports at the edge with stale-while-revalidate (SWR) headers.
*   **Streaming UI:** Stream LLM responses directly to the frontend for "live-typing" summary effects, reducing perceived latency.

### 3.3. Scalability
*   **Multi-Region Deployment:** Ensure the scraper/analyzer can run in multiple regions to circumvent regional API outages or latency.
*   **Cold Storage:** Move old digests (>90 days) to cheaper S3-based storage with an on-demand retrieval mechanism.

---

## 4. Implementation Roadmap (Phase 1)
1.  **Containerization:** Wrap the current logic in Docker for consistent environment execution.
2.  **API Extraction:** Move the analysis logic into a standalone FastAPI or Hono service.
3.  **Database Migration:** Move `manifest.json` state to a managed database.
4.  **CI/CD:** Implement GitHub Actions with staging/production environments and automated integration tests for the AI output.

---

## 5. Overhaul Status: Complete (Stage 3)

### 5.1. Project Summary
The HN Digest has been successfully transformed from a single-file Python script into a robust, containerized, and distributed AI intelligence engine. The system now supports asynchronous scraping, deep reasoning-based analysis, and semantic search.

### 5.2. Implementation Status
- [x] **Scraper:** Node.js + Python Trafilatura bridge.
- [x] **Analysis:** DeepSeek reasoning + Gemini Vector Embeddings (3072 dims).
- [x] **API:** Standalone Hono server serving latest digests and hybrid search.
- [x] **UI:** Next.js 15 App Router with "Modern Broadside" aesthetic.
- [x] **User Layer:** Functional Auth, Bookmarks, and Notification background workers.
- [x] **Verification:** 100% automated test suite (Vitest + Playwright) and HITL quality gates formally integrated.

---
*This prototype is now ready for production deployment considerations.*
