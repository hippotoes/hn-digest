# Mechanism Deep-Dive: HN Digest Core Flows

## 1. Map-Reduce Inference Flow (Resilient Pipeline)
This flow coordinates the asynchronous processing of HN stories into technical briefings.

```mermaid
sequenceDiagram
    participant O as AnalysisOrchestrator
    participant S as HNScraper
    participant Q as BullMQ (Redis)
    participant I as LLMIntelligence
    participant DB as Drizzle (PostgreSQL)

    O->>S: fetchTopStories(limit)
    S-->>O: List<Story>

    loop for each Story
        O->>Q: Enqueue Map Jobs (Chunks of 50 comments)
    end

    Note over Q,I: Map Phase: Parallel Signal Extraction
    Q->>I: extractArguments(comments) [DeepSeek-R1]
    I-->>Q: Technical Signal String

    Note over Q,I: Reduce Phase: Analysis Synthesis
    Q->>I: generateAnalysis(story, signals) [DeepSeek-R1]
    I-->>Q: AnalysisDTO
    Q->>I: generateEmbedding(summary) [Gemini 2.0]
    I-->>Q: vector[768]

    Q->>DB: saveAnalysis(Story, Analysis, Vector)
```

### Key Implementation Details:
- **Map Phase**: Uses `deepseek-reasoner` for high-fidelity extraction from comment chunks.
- **Reduce Phase**: Synthesis of final report using `deepseek-reasoner`.
- **Embeddings**: Standardized on 768-dimension vectors using `gemini-embedding-001`.
- **JSON Repair**: The `LLMIntelligence` module uses `json-repair` to handle trailing commas or malformed structure before Zod validation.

## 2. Data Persistence Mechanism
We use Drizzle ORM transactions to ensure "all-or-nothing" consistency for analysis results.

```mermaid
flowchart TD
    Start[Save Analysis] --> TX[Start DB Transaction]
    TX --> Story[Upsert Story metadata]
    Story --> Analysis[Insert Analysis record]
    Analysis --> Sentiments[Bulk-insert sentiment clusters]
    Sentiments --> Commit[Commit Transaction]
    Commit --> Finish[Release Worker]
```

## 3. Scraper Extraction Logic (Fallback Loop)
The scraper ensures 100% extraction even behind paywalls or complex JS sites.

1. **Trafilatura CLI (Python)**: Primary extraction (high metadata quality).
2. **Cheerio/Markdown Fallback**: Secondary extraction if Trafilatura fails.
3. **HN Context**: If both fail, we fallback to the summary provided in the HN top comments.
