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
  embedding: vector('embedding', { dimensions: 3072 }), // Matching gemini-embedding-001 actual output
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
