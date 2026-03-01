# Module B: Inference Orchestrator
**Objective:** Resilient, intelligent analysis of scraped content using multiple LLMs.

## 1. Responsibilities
-   Receive `ScrapedStory` from the queue.
-   Map the story into a highly technical, context-rich prompt.
-   Route to the optimal LLM (Gemini 2.0 Flash is the baseline).
-   Validate AI-generated JSON and correct schema errors.
-   Store the final `AnalysisDTO` in the persistence layer.

## 2. Core Components & Logic
-   **Prompt Pipeline:**
    -   Combines Title, Article Body, and Top Comments into a single structured block.
    -   Injects "System Tone": Senior Tech Analyst, deep technical focus, no fluff.
-   **Model Router:**
    -   `GEMINI_2_FLASH`: Default for all stories (highest token window and speed).
    -   `DEEPSEEK_V3`: Fallback for when complex reasoning or specific code snippets need deeper analysis.
-   **Repair Mechanism:**
    -   If the LLM returns invalid JSON, the orchestrator attempts a "Repair Call" by feeding the error back into the LLM with the instruction: "Your previous JSON was malformed. Fix only the JSON schema below."
-   **Analysis Caching:**
    -   A Redis check is performed before the LLM call. If a story with the same ID has already been analyzed in the last 24 hours, the orchestrator skips the LLM call.

## 3. Interfaces & Contracts
```typescript
interface AnalysisDTO {
  story_id: string;
  topic: 'AI Fundamentals' | 'AI Applications' | 'Tech' | 'Politics' | 'Others';
  summary_paragraphs: string[]; // Length constraints: ~150 words per paragraph (2 total)
  highlight: string;
  key_points: string[];
  sentiments: SentimentCluster[]; // Exactly 4 clusters
}

interface SentimentCluster {
  label: string; // 2-4 word pithy label
  type: 'positive' | 'negative' | 'mixed' | 'neutral' | 'debate';
  description: string; // ~100 words detailed analysis
  estimated_agreement: string; // e.g., "75 users" or "major cohort"
}
```

## 4. Resilience Strategy: "Self-Healing JSON"
-   Uses a dedicated `json_repair` utility (e.g., `json-repair` package) to handle common LLM output errors like trailing commas or unescaped quotes before failing the request.
-   Implements **LLM-as-a-Judge** (via a second, smaller model like Gemini Nano) to check for "Hallucination Flags" in the generated summary.

## 5. Technology Stack & Containerization
-   **Runtime:** Node.js 22.
-   **Docker:** Same container as Scraper Engine (shared worker service).
-   **Local Verification:**
    -   Use `dotenv` to load a local `MOCK_LLM=true` flag.
    -   If `MOCK_LLM` is true, return a static but schema-valid `AnalysisDTO` JSON.
    -   Run `docker-compose run worker npm test` to verify the JSON validation and repair logic without using LLM credits.
