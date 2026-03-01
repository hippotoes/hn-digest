# Mission 3: Observability & Tracing User Guide

## 1. Introduction
Our observability system is built on **Distributed Tracing (OpenTelemetry)** and **Structured Logging (Pino)**. This allows us to track a single story's journey across the Scraper, Redis, Gemini (Map), and DeepSeek (Reduce).

## 2. Searching Logs via `traceId`
Every operation is assigned a unique `traceId`.

### How to find a specific story's journey:
1.  **Locate the ID:** Find the HN Story ID or the internal UUID from the dashboard.
2.  **Filter in Axiom/BetterStack:** Use the query: `storyId == "47202708"`.
3.  **Correlate:** All logs associated with that story will share the same `traceId`. You can now see the scraper logs, the individual Gemini chunk logs, and the final synthesis in chronological order.

## 3. Visualizing the Trace Waterfall
In your Tracing UI (Honeycomb/Jaeger), each "Map-Reduce" flow looks like a waterfall:
*   **Top Level Span:** `synthesize-analysis` (The total time the user waits).
*   **Child Spans:**
    *   `extract-arguments` (Multiple parallel bars representing Gemini jobs).
    *   `deepseek-reasoning` (A long bar showing the synthesis phase).
    *   `db-persistence` (Small bars at the end showing SQL performance).

**Actionable Insight:** If the waterfall shows Gemini jobs finishing in 2s but the DeepSeek job taking 90s, you have identified the bottleneck.

## 4. Monitoring Technical Health
Use the **Grafana Dashboard** to monitor:
*   **LLM Error Rate:** Filter by `level == "error"` and `component == "inference"`. High rates indicate API keys are exhausted or schemas are changing.
*   **JSON Repair Count:** Monitor `json_repair_triggered`. If this is high, our DeepSeek prompt is deteriorating and needs tuning.
*   **Queue Backlog:** Monitor `bullmq_active_jobs`. If this stays high despite concurrency tweaks, we need to scale the worker pool.

## 5. Local Debugging
While developing locally, you don't need a heavy UI.
*   **CLI Tooling:** Use `pino-pretty` to read the JSON logs in a human-readable format:
    `docker compose logs -f worker | npx pino-pretty`
*   **Trace Headers:** The API returns `x-trace-id` in the response headers. Use this to search your local logs instantly.
