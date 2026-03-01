# Module A: Scraper Engine
**Objective:** Decoupled, rate-limited, and multi-source data ingestion.

## 1. Responsibilities
-   Fetch top story IDs from HN (Firebase API).
-   Retrieve story metadata and rankings (Algolia Search API).
-   Perform headless or readable-text extraction from external URLs.
-   Queue stories for analysis via a standard `StoryDTO`.

## 2. Core Components & Logic
-   **HN Client:**
    -   Uses `fetch` (with native Node cache) to hit `https://hacker-news.firebaseio.com/v0/topstories.json`.
    -   Parallel-fetches metadata for top 30 stories using `Promise.all`.
-   **Content Scraper:**
    -   Primary: `Trafilatura` (Python bridge) for high-quality, metadata-rich extraction.
    -   Secondary: `Cheerio` + `Got` for lightweight HTML parsing when Trafilatura fails.
    -   PDF Support: Uses `pdf-parse` for academic/technical papers.
-   **Rate Limiter:**
    -   Configurable `MAX_CONCURRENT_REQUESTS` (default: 5).
    -   Domain-level wait times (respecting `robots.txt` when possible).
-   **Ingestion Queue:**
    -   Publishes a `ScrapedStory` message to a **BullMQ** queue (hosted on the local Redis container).
    -   Ensures 100% environment parity between local Docker and production.

## 3. Interfaces & Contracts
```typescript
interface ScrapedStory {
  id: string; // HN objectID
  title: string;
  url: string;
  points: number;
  author: string;
  timestamp: number;
  raw_content: string; // Full extracted text
  comments: CommentDTO[]; // Nested comments up to depth 3
}

interface CommentDTO {
  id: string;
  author: string;
  text: string;
  parent_id?: string;
  score: number;
}
```

## 4. Error Handling & Recovery
-   **Site Blocking:** If a site (e.g., WSJ, NYT) returns a 403, we fall back to searching the story on Archive.org or just using the HN comment snippet.
-   **Python Bridge:** Uses `child_process.exec` to call `trafilatura`. Implements strict timeouts (10s) and handles `stderr` for logging content extraction failures.
-   **Data Sanitization:** Strips all `<script>`, `<style>`, and non-printable characters before passing to the Orchestrator to save tokens.

## 5. Technology Stack & Containerization
-   **Runtime:** Node.js 22.
-   **Docker Image:** `node:22-bullseye` (Includes system-level Python for Trafilatura).
-   **Local Verification:**
    -   Run `docker-compose up scraper` to start the worker.
    -   Use a local `.env.local` to override API URLs with mock servers or direct HN hits.
    -   Validate by checking `Redis` (via `redis-cli`) for newly queued story objects.
