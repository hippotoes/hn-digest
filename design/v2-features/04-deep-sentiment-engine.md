# Stage 7: Exhaustive Sentiment Engine Implementation
**Objective:** Scrape ALL comments for a story and generate a 4-cluster sentiment analysis (~100 words each).

## 1. Challenges: "The Token Limit Problem"
High-engagement HN stories can have 500+ comments (100k+ tokens). This exceeds standard LLM prompts or becomes cost-inefficient.

## 2. Technical Strategy: Map-Reduce Summarization
*   **Step 1: Scrape All:** Use the Algolia Item API recursively to fetch the entire comment tree.
*   **Step 2: Map (Chunking):** Group comments into batches of 50.
*   **Step 3: Reduce (Intermediate):** Use Gemini 2.0 Flash to extract "Key Arguments" and "Sentiment Signals" from each batch.
*   **Step 4: Final Synthesis (DeepSeek):** Pass the *summarized signals* from Step 3 to DeepSeek Reasoner to produce the final 4 clusters (~100 words each).

## 3. Implementation Workflow
1.  **Scraper Engine:** Update `scraper.ts` to recursively fetch children IDs from HN.
2.  **Worker Pipeline:**
    *   Add a new `process-comments` BullMQ task.
    *   Implement the chunking and recursive reduction logic.
3.  **Prompt Update:** Refine the "Sentiment Synthesis" prompt to enforce the 4-cluster requirement with 100-word descriptions.

## 4. Verification
-   **Auto-Test:** Assert that the scraper returns the correct total count of comments for a known test story (e.g., a story with 100+ comments).
-   **HITL:** Read the final sentiment clusters. Do they capture niche technical arguments that were buried deep in the comment threads?
