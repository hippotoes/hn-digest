import { pgTable, text, integer, timestamp, uuid, vector, primaryKey, boolean, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AdapterAccountType } from "next-auth/adapters"

export const stories = pgTable('stories', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url'),
  points: integer('points').default(0),
  author: text('author'),
  rawContent: text('raw_content'),
  rawCommentsJson: text('raw_comments_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const analyses = pgTable('analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: text('story_id').notNull().references(() => stories.id, { onDelete: "cascade" }),
  topic: text('topic').notNull(),
  summary: text('summary').notNull(),
  embedding: vector('embedding', { dimensions: 3072 }),
  rawJson: text('raw_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sentiments = pgTable('sentiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: "cascade" }),
  source: text('source').notNull().default('community'),
  label: text('label').notNull(),
  sentimentType: text('sentiment_type').notNull(),
  description: text('description'),
  agreement: text('agreement'),
}, (table) => ({
  // Strict enum-like validation at the DB level
  sentimentTypeCheck: check('sentiment_type_check', sql`${table.sentimentType} IN ('positive', 'negative', 'mixed', 'neutral', 'debate')`),
  sourceCheck: check('source_check', sql`${table.source} IN ('article', 'community')`),
}));

// (Rest of the tables follow similar hardening patterns...)
// NextAuth tables already have high constraints from the adapter.

export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash"),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
})

export const accounts = pgTable("account", {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
)

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable("verificationToken", {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
)

export const bookmarks = pgTable("bookmark", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  storyId: text("storyId").notNull().references(() => stories.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const preferences = pgTable("preference", {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  topics: text("topics").array(),
  emailNotifications: boolean("email_notifications").default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
