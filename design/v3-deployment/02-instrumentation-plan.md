# Mission 3: Instrumentation Plan

## 1. Trace Lifecycle Instrumentation

### Stage A: Scraper & Enqueue
*   **Log:** `scrape_initiated` (StoryID, URL)
*   **Log:** `content_extracted` (CharsCount, ExtractionMethod)
*   **Log:** `queue_flow_created` (FlowID, ChildrenCount)

### Stage B: Map Phase (Gemini)
*   **Log:** `map_job_started` (JobID, StoryID, ChunkIndex)
*   **Log:** `gemini_request` (TokensIn, TokensOut, Duration)
*   **Log:** `map_job_completed` (SignalsExtractedCount)

### Stage C: Reduce Phase (DeepSeek)
*   **Log:** `reduce_job_started` (StoryID, SignalsMergedCount)
*   **Log:** `deepseek_thinking_start` (StoryID)
*   **Log:** `deepseek_thinking_end` (Duration)
*   **Log:** `json_repair_triggered` (ErrorCode, RepairAttemptCount)
*   **Log:** `analysis_finalized` (Topic, SummaryLength)

### Stage D: Persistence & API
*   **Log:** `db_insert_performance` (Table, Duration)
*   **Log:** `materialized_view_refresh` (Duration)
*   **Log:** `api_request` (Endpoint, StatusCode, UserID)

## 2. Structured Metadata (Pino Implementation)
Every log entry MUST include these standard fields:
```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error",
  "traceId": "uuid",
  "storyId": "hn_id",
  "component": "worker|scraper|api",
  "msg": "High-level description",
  "context": { ... specific details ... }
}
```

## 3. Error Classification
*   **Recoverable:** `LLM_VALIDATION_ERROR`, `NETWORK_TIMEOUT` (Auto-retry).
*   **Critical:** `DATABASE_CONNECTION_LOST`, `LLM_QUOTA_EXCEEDED` (Instant Alert).
*   **Quality:** `EXTRACTION_FAILED`, `SUMMARY_TOO_SHORT` (Flag for manual review).
