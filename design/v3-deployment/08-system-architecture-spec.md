# Mission 3: Comprehensive Data Flow & System Architecture

## 1. System Topology Overview
The `hn-digest` system is a distributed, event-driven intelligence engine. It utilizes a **Map-Reduce** pattern to parallelize the extraction of community signals and a **Reasoning-First** approach to synthesize technical briefs.

```mermaid
graph TD
    %% Entry Point
    Cron[GitHub Action / Cron] -->|Trigger| WorkerCmd[Worker CLI: --enqueue]

    subgraph "Ingress & Extraction (The Scraper)"
        WorkerCmd --> DBCheck{ID exists?}
        DBCheck -->|No| HNAPI[Hacker News API]
        DBCheck -->|Yes| Skip[Skip Story]
        HNAPI -->|Story IDs| StoryFetch[Story Metadata Fetch]
        StoryFetch -->|URL| ContentExt[Trafilatura / Markdown Fallback]
        StoryFetch -->|Comment IDs| RecursiveFetch[Recursive Comment Tree Crawler]
    end

    subgraph "Distributed Map Phase (DeepSeek V3 / Gemini)"
        RecursiveFetch -->|Comment Chunks| MapQueue[BullMQ: map-queue]
        MapQueue -->|Parallel Concurrency 10| LLMMap[DeepSeek-Chat / Gemini Fallback]
        LLMMap -->|Technical Signals| SignalStore[Redis: Child Job Results]
    end

    subgraph "Reasoning & Synthesis Phase (DeepSeek Reasoner)"
        SignalStore -->|All Signals + Raw Content| ReduceQueue[BullMQ: reduce-queue]
        ReduceQueue -->|High Latency Synthesis| DeepSeek[DeepSeek Reasoner]
        DeepSeek -->|Structured Analysis| DurableStep{Durable Logic}
    end

    subgraph "Indexing & Persistence (Drizzle ORM)"
        DurableStep -->|Persist First| SaveAnalysis[Postgres: analyses table]
        SaveAnalysis -->|Analysis Text| Embedder[Gemini / Together AI]
        Embedder -->|Vector| UpdateVector[Postgres: update analysis.embedding]
        DurableStep -.->|Embedding Fail| SoftFail[Log Warning, Analysis Persists]
    end

    subgraph "Egress & Visualization (Next.js 15)"
        DB[(PostgreSQL + pgvector)] -->|Server Components| RSC[Next.js App Router]
        RSC -->|Interactive Dashboard| UserBrowser[End User]
        Traces[OTel Traces] -->|gRPC| Jaeger[Jaeger v2 UI]
        Metrics[RED Metrics] -->|Scrape| Prometheus[Prometheus Dashboard]
    end

    %% Observability Links
    LLMMap -.->|Span| Traces
    DeepSeek -.->|Span| Traces
    Embedder -.->|Span| Traces
```

## 2. Component Specifications

### A. The Scraper (Resilient & Respectful)
- **Primary:** `trafilatura` (Python bridge).
- **Secondary Fallback:** `node-html-markdown` (Direct HTTP fetch).
- **Ethics:** Strict 1s inter-story and 250ms inter-comment delays with User-Agent mirroring.
- **Incremental Logic:** High-efficiency ID filtering against DB before fetching metadata.

### B. The Map Phase (High Throughput)
- **Primary Model:** `deepseek-chat` (V3).
- **Fallback Model:** `gemini-2.0-flash`.
- **Concurrency:** **10 parallel jobs** (unthrottled for DeepSeek, exponential backoff for Gemini).
- **Function:** Compresses 50+ comments into raw technical arguments (Signals).

### C. The Reduce Phase (Reasoning-First)
- **Model:** `deepseek-reasoner`.
- **Logic:** Chain-of-Thought synthesis of Article + Community Signals.
- **Durability:** **Durable Synthesis** pattern ensures analysis is saved even if secondary steps fail.

### D. The Indexing Phase (Graceful Degradation)
- **Model:** `gemini-embedding-001` or `togethercomputer/m2-bert-80M`.
- **Control:** Toggled via `EMBEDDING_PROVIDER` env var.
- **Fault Tolerance:** Non-blocking step; failure logs a warning but preserves the UI content.

### E. The UI & Observability
- **Frontend:** Next.js 15 RSC + Tailwind CSS ("Broadside" Aesthetic).
- **Logging:** Structured JSON via `Pino` with `traceId` correlation.
- **Tracing:** OTel gRPC -> Jaeger v2 (Service Performance Monitoring enabled).
- **Metrics:** Prometheus scraping SpanMetrics for real-time RED visualization.

## 3. Data Integrity Constraints (Hardened)
- **Drizzle Schema:** Enforced DB-level enums and `CHECK` constraints.
- **Concurrency:** Parallel orchestration (no artificial delay) proved via stress test.
- **Retries:** Exponential backoff (5s base) for all LLM jobs.
