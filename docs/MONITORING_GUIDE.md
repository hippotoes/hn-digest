# HN Digest: Monitoring & Observability Guide

This guide details how to monitor the progress, health, and performance of the story processing pipeline in a local deployment.

---

## 1. Real-time Queue Status (Management API)

The worker service exposes a management API (port `3001`) that provides a snapshot of the BullMQ job queues. This is the fastest way to see how many stories are currently being processed.

### Get Queue Stats
Run the following command from your host machine:

```bash
docker compose exec worker curl http://localhost:3001/stats
```

**JSON Response Example:**
- `map.active`: Number of comment chunks currently being analyzed by DeepSeek Chat.
- `map.waiting`: Number of chunks queued for analysis.
- `reduce.active`: Number of stories currently being synthesized by DeepSeek Reasoner.
- `reduce.waiting`: Number of stories waiting for their map jobs to complete.

---

## 2. Live Log Streaming (Pino)

The worker uses structured logging (Pino) with `pino-pretty` for human-readable output in the terminal.

### Follow Worker Logs
```bash
docker compose logs -f worker
```

**Key Lifecycle Events to Watch:**
- `[Worker] Mapping arguments from comments`: A map job has started for a specific story.
- `[Worker] Synthesizing final analysis`: All map jobs for a story finished; the final synthesis has begun.
- `[Worker] Reduce LLM synthesis complete`: The LLM has successfully generated the analysis.
- `[Worker] Reduce Job fully completed`: The story has been persisted to the database.

---

## 3. Distributed Tracing (Jaeger)

For deep inspection of individual story lifecycles, use the Jaeger UI. Every job is instrumented with OpenTelemetry and carries a unique `traceId`.

- **UI URL:** [http://localhost:16686](http://localhost:16686)
- **Service Name:** `hn-digest-worker`

**What you can see:**
- The exact duration of LLM calls (Map vs. Reduce).
- Database insertion latency.
- Embedding generation time.
- Trace breakdowns showing parent-child relationships between Map and Reduce jobs.

---

## 4. Metrics & Performance (Prometheus)

The system exports telemetry metrics that are scraped by Prometheus. This is ideal for tracking long-term trends in processing time and failure rates.

- **UI URL:** [http://localhost:9090](http://localhost:9090)
- **Common Queries:**
  - `job_duration_seconds`: Track how long different stages of the pipeline are taking.
  - `bullmq_jobs_completed_total`: Total number of stories processed.

---

## 5. Database Audit (PostgreSQL)

You can verify that stories are successfully reaching the database by querying the `analyses` table directly.

### Check Latest Analyzed Stories
```bash
docker compose exec db psql -U postgres -d hndigest -c "
  SELECT s.id, s.title, a.topic, a.created_at
  FROM stories s
  JOIN analyses a ON s.id = a.story_id
  ORDER BY a.created_at DESC
  LIMIT 10;
"
```

### Check Database Consistency
The app API includes a consistency check that identifies "orphaned" analyses:
```bash
curl http://localhost:3005/api/health/consistency
```

---

## 6. Service Health Gates

Check if all core components are reachable:

| Service | Endpoint | Port |
| :--- | :--- | :--- |
| **Worker API** | `GET /health` | `3001` |
| **App API (Liveness)** | `GET /api/health/live` | `3005` |
| **App API (Readiness)** | `GET /api/health/ready` | `3005` |
