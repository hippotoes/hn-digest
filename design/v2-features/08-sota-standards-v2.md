# Mission 2 SOTA Implementation Standards
**Objective:** Apply high-end engineering patterns to the feature expansion.

## 1. Authentication: Security-First
*   **Hash Algorithm:** `Argon2id` (memory-hard, resistant to GPU/ASIC attacks).
*   **Session Management:** `Jose` for high-performance JWT handling in Edge/Node.
*   **Validation:** Strict `Zod` schemas for password complexity (no `regex` only, use proper library logic).

## 2. Distributed Pipeline: Map-Reduce AI
*   **Recursive Scraper:** Implement using a **Generator** pattern to handle HN comment trees without memory leaks.
*   **Orchestration:** Use BullMQ **Flows** (Parent/Child jobs).
    *   *Why SOTA:* Ensures the "Reduce" (Synthesis) job only starts when all "Map" (Intermediate) jobs are 100% complete.
*   **Intermediate Store:** Redis `Hashes` for storing sentiment signals before the final DeepSeek synthesis.

## 3. Persistent State: Atomic Operations
*   **Bookmark Toggles:** Use **PostgreSQL CTEs** (Common Table Expressions) for `UPSERT` logic to ensure no race conditions during rapid clicking.
```sql
INSERT INTO bookmarks (user_id, story_id, is_active)
VALUES ($1, $2, true)
ON CONFLICT (user_id, story_id)
DO UPDATE SET is_active = NOT bookmarks.is_active, updated_at = NOW();
```

## 4. Frontend: Modern Server Interaction
*   **Streaming:** `React.Suspense` for the Calendar Manifest.
*   **Optimistic UI:** `useOptimistic` for bookmarking. This provides "Zero Latency" perception.
*   **Progressive Enhancement:** Ensure the app works even if JavaScript is partially blocked (using standard HTML forms for signup).

## 5. Performance: Incremental Views
*   **The Manifest:** Use a `MATERIALIZED VIEW` with `REFRESH CONCURRENTLY` triggered nightly. This keeps the Calendar API response time under 50ms.
