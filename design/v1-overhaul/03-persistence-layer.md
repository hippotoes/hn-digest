# Module C: Persistence Layer
**Objective:** High-availability, searchable data storage for stories and analysis.

## 1. Responsibilities
-   Store story metadata (HN metadata).
-   Persist AI-generated analysis and clusters.
-   Enable full-text and semantic search across history.
-   Manage data retention and archival.

## 2. Core Components & Logic
-   **Database Manager:**
    -   Handles multi-table transactions for Atomic story/analysis insertion.
    -   Implements Upsert logic to update story points if a story is re-scraped.
-   **Vector Index Manager:**
    -   Calls OpenAI `text-embedding-3-small` or Gemini `text-embedding-004` after a successful analysis.
    -   Stores 1536-dimensional vectors in a `VECTOR(1536)` column.
-   **Archive Handler:**
    -   A nightly cron task that moves `raw_json` and scraped content to S3 (Supabase Storage or AWS S3).
    -   Maintains a "Summary-Only" local table for fast daily retrieval.

## 3. Database Schema (Drizzle-Style)
```typescript
// db/schema.ts
import { pgTable, text, integer, timestamp, uuid, vector } from 'drizzle-orm/pg-core';

export const stories = pgTable('stories', {
  id: text('id').primaryKey(), // HN ObjectID
  title: text('title').notNull(),
  url: text('url'),
  points: integer('points'),
  author: text('author'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const analyses = pgTable('analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: text('story_id').references(() => stories.id),
  topic: text('topic'),
  summary: text('summary'),
  embedding: vector('embedding', { dimensions: 768 }), // Gemini text-embedding-004 standard
  rawJson: text('raw_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sentiments = pgTable('sentiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  analysisId: uuid('analysis_id').references(() => analyses.id),
  label: text('label'),
  sentimentType: text('sentiment_type'),
  description: text('description'),
  agreement: text('agreement'),
});
```

## 4. Archival & Cleanup Strategy
-   **Partitioning:** Consider partitioning the `analyses` table by month if story volume exceeds 10k/month.
-   **Data TTL:** Raw scraped text (not analysis) is deleted from the primary DB after 7 days (kept in S3).

## 5. Technology Stack & Containerization
-   **DB Container:** `ankane/pgvector:16` (Postgres 16 with pgvector pre-installed).
-   **Local Verification:**
    -   `docker-compose up db` starts the local Postgres on port 5432.
    -   Run `npx drizzle-kit push:pg` to sync schema with the local container.
    -   Run `npx drizzle-kit studio` locally to visualize story and analysis records.
