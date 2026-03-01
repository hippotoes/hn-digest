# Module D: API & Backend
**Objective:** Secure, high-performance gateway for the frontend and third-party integrations.

## 1. Responsibilities
-   Serve requested digests (Daily/Weekly/Monthly).
-   Provide a search API (Full-text and Vector-based similarity).
-   Handle user authentication and preferences.
-   Manage notification subscriptions (Email, Slack, Discord).

## 2. Core Components & Logic
-   **API Engine (Hono):**
    -   Centralized router running as a Next.js Route Handler or standalone Node service.
    -   Implements standardized middleware for logging (Pino), error handling, and Zod validation.
-   **Service Layer (Business Logic):**
    -   `DigestService`: Compiles a day's stories and categories into a single JSON object.
    -   `SearchService`: Performs hybrid search using a combination of SQL text matching (`ILIKE`) and vector similarity (`<=>`).
-   **Security Layer:**
    -   Middleware for session validation and CSRF token checking.
-   **Async Workers:**
    -   Offloads heavy tasks like "Send Weekly Newsletter to 1k users" to a BullMQ worker.

## 3. Endpoints & Schema
-   `GET /api/v1/digests/daily/{date}`:
    -   Returns: `{ date, ranking, categories: { [cat]: Story[] } }`
-   `GET /api/v1/search?q={query}&type={hybrid|vector|text}`:
    -   Returns: Top 10 matching stories with similarity scores.
-   `POST /api/v1/bookmarks`:
    -   Body: `{ storyId, userId }` (Adds a story to the user's personal collection).

## 4. Performance Optimization
-   **Runtime:** Hono's ultra-lightweight footprint ensures minimal latency.
-   **SWR (Stale-While-Revalidate):** The API uses `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.
-   **Database Pooling:** Optimized for serverless and containerized environments.

## 5. Technology Stack
-   **Framework:** Hono (integrated with Next.js).
-   **Authentication:** Clerk or Supabase Auth.
-   **Search Engine:** `pgvector` hybrid search.
-   **Queue:** BullMQ + Redis.
