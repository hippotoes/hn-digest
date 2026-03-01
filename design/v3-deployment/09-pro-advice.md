# Mission 3: Staff Engineer Pro Advice & Technical Roadmap

## 1. Resilience & Reliability

### A. The "Durable Synthesis" Pattern
**Problem:** Expensive DeepSeek reasoning cycles (~90s) were being lost if the subsequent embedding call failed.
**Pro Advice:** Always persist the primary intelligence (the analysis) before attempting secondary indexing (embeddings). Wrap the embedding logic in a `try-catch` to allow "Graceful Degradation." A story without a search vector is better than no story at all.

### B. "Bucket Brigade" vs. "Server-Side Queuing"
**Problem:** Initial 429 errors from Gemini during parallel bursts.
**Pro Advice:** For providers with strict client-side RPM limits (like Gemini Free Tier), use a throttled queue. For providers that handle queuing server-side (like DeepSeek), maximize concurrency to reduce total backlog duration.

### C. Self-Healing JSON & Prompt Hardening
**Problem:** Model drift under load (e.g., DeepSeek returning strings instead of objects).
**Pro Advice:** Use "Positive Constraints" in system prompts. Instead of just saying "return JSON," provide a minimal example and explicitly state "OBJECT not string."

## 2. Scraping Ethics & Performance

### A. Respectful Crawling
**Pro Advice:** When scraping community platforms like HN, implement "Human Jitter." A 250ms-500ms delay between fetches, combined with a modern User-Agent, prevents IP flagging and shows respect to the source infrastructure.

### B. Incremental Intelligence
**Pro Advice:** Never scrape what you already have. Perform an ID-check against the database before initiating the scraper. This saves bandwidth, reduces latency, and lowers LLM costs.

## 3. Future Hardening: The Topic Canonicalizer
**Problem:** LLMs often ignore strict enums in favor of descriptive topics (e.g., "AI in Education" instead of "AI Applications").
**Pro Advice:** Implement a `TopicCanonicalizer`. Use Zod's `.preprocess()` to map creative LLM strings to your fixed enum buckets using keyword matching. This prevents validation failures while preserving the model's descriptive power.

## 4. Observability SOTA
**Pro Advice:** Don't just log errors; log "Trace Waterfalls." By linking spans across workers, you can visually identify if a bottleneck is caused by the model's "thinking time" or your own code's execution.
