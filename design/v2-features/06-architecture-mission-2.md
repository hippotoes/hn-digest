# Mission 2 Architecture: "The Intelligence Engine"
**Objective:** Evolve from a linear pipeline to a multi-stage, event-driven system with stateful user interactions.

## 1. Current vs. Future State

| Component | V1 (Current) | V2 (Mission 2) | Rationale |
| :--- | :--- | :--- | :--- |
| **Auth** | Mock Credentials | Argon2id + JWT | Production-grade security. |
| **Comments** | Top 25 (Shallow) | Exhaustive Recursive Tree | Deep technical sentiment accuracy. |
| **Pipeline** | Linear Loop | Map-Reduce Orchestration | Handle massive comment context. |
| **Navigation** | "Latest" Only | Manifest-Driven Calendar | Scalable historical discovery. |
| **Data Flow** | One-way Push | Bidirectional State | Support Bookmark Toggles (On/Off). |

## 2. Comprehensive System Diagram
```mermaid
graph TD
    %% Trigger Layer
    Cron[Daily Cron] -->|Trigger| Scraper
    User[User Session] -->|Toggle Bookmark| API

    %% Scraper & Pipeline (The Map Stage)
    subgraph "Ingestion Engine (Map)"
        Scraper[Recursive Scraper] -->|Fetch Children| HNAPI[HN Algolia API]
        Scraper -->|Comment Batches| Queue[BullMQ: Map Queue]
    end

    %% Intelligence Engine (The Reduce Stage)
    subgraph "Intelligence Engine (Reduce)"
        Queue -->|Process| MapWorker[Gemini: Argument Extraction]
        MapWorker -->|Intermediate Signals| Redis[(Redis: Intermediate Store)]
        Redis -->|Synthesis| ReduceWorker[DeepSeek: Sentiment Synthesis]
        ReduceWorker -->|Final Clusters| DB
    end

    %% Persistence Layer
    subgraph "Persistence Layer"
        DB[(PostgreSQL + pgvector)]
        DB -->|Materialized View| Manifest[Calendar Manifest]
    end

    %% Interface Layer
    subgraph "Web Interface"
        API[Hono API Server] -->|Query| DB
        Web[Next.js App] -->|Server Actions| API
        Web -->|Fetch| Manifest
    end
```

## 3. Tech Stack Refinements (SOTA)
*   **Crypto:** `argon2` for hashing (winner of PHC).
*   **Caching:** `Incremental Materialized Views` in Postgres for the Calendar Manifest (sub-millisecond retrieval).
*   **Queueing:** BullMQ `Parent/Child` dependencies for Map-Reduce logic.
*   **Vector Search:** `pgvector` HNSW index for high-speed semantic retrieval as data grows.
