# HN Digest: Story Processing Trigger Guide

This guide explains how to manually trigger the Hacker News story ingestion and analysis pipeline in a local deployment. The system uses a **Map-Reduce** architecture powered by BullMQ, Redis, and DeepSeek LLMs.

---

## Method 1: CLI Trigger (Recommended for Local Dev)

The worker service includes a built-in CLI flag to scrape the latest stories and enqueue them for processing.

### Using Docker (Preferred)
If your stack is running via `docker-compose`, use `docker exec` to run the trigger inside the worker container:

```bash
docker compose exec worker npm run start --workspace=@hn-digest/worker -- --enqueue
```

### Using NPM (Local Environment)
If you are running the worker locally outside of Docker:

```bash
# From the project root
npm run start --workspace=@hn-digest/worker -- --enqueue
```

**Parameters:**
- `--enqueue`: Initiates the scraping and queueing process.
- `--limit <number>`: (Optional) Limits the number of stories to process (defaults to 10).

---

## Method 2: Management API Trigger

The worker service hosts a management API on port `3001` (internal to the container) that can fire-and-forget a pipeline run.

### Internal Trigger (Within Docker Network)
You can trigger the pipeline from another container or via `docker exec`:

```bash
docker compose exec worker curl -X POST "http://localhost:3001/pipeline/run?limit=10"
```

### External Trigger (Host Machine)
To use this from your host machine, you must first expose port `3001` in your `docker-compose.yml`:

1.  Add `3001:3001` to the `worker` service ports.
2.  Restart the worker: `docker compose up -d worker`.
3.  Run the curl command:
    ```bash
    curl -X POST "http://localhost:13001/pipeline/run?limit=5"
    ```

---

## Method 3: Automated Testing (Nuclear Option)

For a full end-to-end validation that ignores the cache and forces a fresh run of the ingestion logic, you can run the functional "Nuclear" tests.

```bash
docker compose exec worker npm run test:nuclear
```

---

## Pipeline Architecture Overview

When a trigger is issued, the following sequence occurs:

1.  **Ingestion:** The `AnalysisOrchestrator` fetches the top stories from Hacker News.
2.  **Map Phase (`extract-arguments`):**
    - Comments are chunked (50 per job).
    - Jobs are sent to the `map-queue`.
    - `mapWorker` uses **DeepSeek Chat** to extract key arguments and sentiment signals.
3.  **Reduce Phase (`synthesize-analysis`):**
    - Once all chunks for a story are mapped, a parent job is triggered.
    - `reduceWorker` uses **DeepSeek Reasoner** to synthesize the final technical summary and sentiment grid.
4.  **Embedding & Persistence:**
    - The final summary is embedded using **Gemini**.
    - The story, analysis, and vector embedding are persisted to **PostgreSQL**.
5.  **Manifest Update:**
    - A `refresh-manifest` job is enqueued to update the materialized view used by the frontend.

---

## Monitoring Progress

You can monitor the status of the queues via the management API:

```bash
curl http://localhost:3001/stats
```

This returns the number of active and waiting jobs in both the `map` and `reduce` queues.
