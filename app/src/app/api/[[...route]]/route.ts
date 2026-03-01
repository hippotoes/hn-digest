import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { db } from '@/db';
import { stories, analyses, bookmarks, preferences } from '@hn-digest/db';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Queue } from 'bullmq';

export const runtime = 'nodejs';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const notificationQueue = new Queue('notification-queue', {
  connection: {
    host: 'redis',
    port: 6379,
  }
});
const app = new Hono().basePath('/api');

app.get('/ping', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/v1/digests/daily/latest', async (c) => {
  try {
    const digestItems = await db
      .select({
        id: stories.id,
        title: stories.title,
        url: stories.url,
        points: stories.points,
        author: stories.author,
        summary: analyses.summary,
        topic: analyses.topic,
      })
      .from(stories)
      .innerJoin(analyses, eq(stories.id, analyses.storyId))
      .orderBy(desc(stories.points));

    return c.json({
      success: true,
      count: digestItems.length,
      data: digestItems,
    });
  } catch (error) {
    console.error('Failed to fetch digest:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

app.get('/v1/search', async (c) => {
  const q = c.req.query('q');
  if (!q) {
    return c.json({ success: false, error: 'Missing query parameter q' }, 400);
  }

  try {
    let embedding: number[] = [];
    if (process.env.MOCK_LLM === 'true') {
      embedding = Array(3072).fill(0.1);
    } else {
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set.');
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' }, { apiVersion: 'v1beta' });
      const result = await model.embedContent(q);
      embedding = result.embedding.values;
    }

    const vectorQuery = sql`${analyses.embedding} <=> ${JSON.stringify(embedding)}`;

    const results = await db
      .select({
        id: stories.id,
        title: stories.title,
        url: stories.url,
        points: stories.points,
        summary: analyses.summary,
        similarity: sql`1 - (${vectorQuery})`
      })
      .from(stories)
      .innerJoin(analyses, eq(stories.id, analyses.storyId))
      .where(
        or(
          ilike(stories.title, `%${q}%`),
          ilike(analyses.summary, `%${q}%`)
        )
      )
      .orderBy(vectorQuery)
      .limit(10);

    return c.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Search error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// --- User Features ---

// Bookmarks
app.post('/v1/bookmarks', async (c) => {
  const { storyId } = await c.req.json();
  const userId = c.req.header('x-user-id') || 'test-user-id';

  try {
    await db.insert(bookmarks).values({ userId, storyId });
    return c.json({ success: true, message: 'Bookmarked' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to bookmark' }, 500);
  }
});

app.get('/v1/bookmarks', async (c) => {
  const userId = c.req.header('x-user-id') || 'test-user-id';
  const userBookmarks = await db
    .select({ story: stories })
    .from(bookmarks)
    .innerJoin(stories, eq(bookmarks.storyId, stories.id))
    .where(eq(bookmarks.userId, userId));

  return c.json({ success: true, data: userBookmarks });
});

// Preferences & Notifications
app.post('/v1/preferences', async (c) => {
  const { topics, emailNotifications } = await c.req.json();
  const userId = c.req.header('x-user-id') || 'test-user-id';

  try {
    await db.insert(preferences).values({
      userId,
      topics,
      emailNotifications
    }).onConflictDoUpdate({
      target: preferences.userId,
      set: { topics, emailNotifications, updatedAt: new Date() }
    });

    if (emailNotifications) {
      await notificationQueue.add('send-welcome-alert', { userId, topics });
    }

    return c.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    console.error(error);
    return c.json({ success: false, error: 'Failed to update preferences' }, 500);
  }
});

export const GET = handle(app);
export const POST = handle(app);
