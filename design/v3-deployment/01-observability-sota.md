# Mission 3: Observability SOTA (State of the Art)

## 1. Philosophical Shift: From Logs to Traces
In a distributed Map-Reduce architecture like `hn-digest`, traditional text logs are insufficient. We must adopt **Structured Observability** to debug across the Scraper, BullMQ, and LLM boundaries.

### Core Standards
*   **OpenTelemetry (OTel):** The industry standard for vendor-neutral instrumentation. We will use OTel to trace a story's journey from the moment it is scraped until it appears on the dashboard.
*   **Structured Logging (JSON):** Moving away from human-readable text to machine-parseable JSON using **Pino**. This allows for high-speed indexing and complex filtering.

## 2. The Observability Stack
*   **Logging:** **BetterStack (Logtail)** or **Axiom**. These provide SQL-like querying over JSON logs and instant alerting.
*   **Tracing:** **Honeycomb** or **Jaeger**. Used to visualize the parallel Map jobs and the final Reduce synthesis.
*   **Metrics:** **Prometheus** + **Grafana**. Monitoring queue depth (BullMQ), CPU/RAM usage of the worker, and LLM API response times.

## 3. Distributed Tracing Pattern
We will implement a **Trace Context Propagation** strategy:
1.  **Origin:** Scraper generates a `TraceID`.
2.  **Propagation:** `TraceID` is embedded in the BullMQ job metadata.
3.  **Inheritance:** The Map jobs (Gemini) and the Reduce job (DeepSeek) inherit this ID.
4.  **Completion:** The UI can query the logs using this `TraceID` to show the "Health" of a specific digest generation.

## 4. Key Metrics to Monitor
*   **LLM Latency:** Specific tracking for DeepSeek's "thinking" phase.
*   **Success Rate:** Percentage of stories that fail during Trafilatura extraction or JSON repair.
*   **Queue Throughput:** How many jobs/sec the worker cluster is processing.
*   **Database Lock Contention:** Monitoring the Materialized View refresh duration.
