import { pgTable, text, integer, timestamp, uuid, vector, primaryKey, boolean } from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from "next-auth/adapters"

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

// --- NextAuth Tables ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  passwordHash: text("password_hash"), // Added for Stage 4
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
})

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
)

// --- User Features ---

export const bookmarks = pgTable("bookmark", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  storyId: text("storyId")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true), // Added for Stage 5
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const preferences = pgTable("preference", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }).unique(),
  topics: text("topics").array(), // Array of strings for interested topics
  emailNotifications: boolean("email_notifications").default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
})
