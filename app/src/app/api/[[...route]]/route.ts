import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { db } from '@/db';
import { stories, analyses, sentiments, bookmarks } from '@hn-digest/db';
import { eq, desc, sql, and, or, ilike } from 'drizzle-orm';
import { logger } from '@/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '@/config';

export const app = new Hono().basePath('/api');

// --- Observability Middleware ---
app.use('*', async (c, next) => {
  const traceId = crypto.randomUUID();
  c.header('x-trace-id', traceId);
  const start = Date.now();

  logger.info({
    traceId,
    method: c.req.method,
    url: c.req.url
  }, 'Incoming request');

  await next();

  const duration = Date.now() - start;
  logger.info({
    traceId,
    status: c.res.status,
    duration: `${duration}ms`
  }, 'Request completed');
});

// --- Health Gates ---
app.get('/health/live', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/health/ready', async (c) => {
  try {
    // Check DB
    await db.execute(sql`SELECT 1`);
    return c.json({ status: 'ok', db: 'connected' });
  } catch (e: any) {
    logger.error({ error: e.message }, 'Readiness check failed');
    return c.json({ status: 'error', db: 'disconnected' }, 503);
  }
});

app.get('/health/consistency', async (c) => {
  try {
    const orphanedAnalysesResult = await db.execute(sql`SELECT count(*) FROM analyses WHERE story_id NOT IN (SELECT id FROM stories)`);
    const count = orphanedAnalysesResult[0]?.count || 0;
    return c.json({
      status: 'ok',
      orphaned_analyses: count
    });
  } catch (e: any) {
    logger.error({ error: e.message }, 'Consistency check failed');
    return c.json({ status: 'error' }, 500);
  }
});

// --- V1 API ---

app.get('/v1/digests/manifest', async (c) => {
  try {
    const result = await db.execute(sql`SELECT digest_date FROM digest_manifest ORDER BY digest_date DESC`);
    const dates = result.map((r: any) => r.digest_date);
    return c.json({ success: true, data: dates });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch manifest');
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

app.get('/v1/digests/daily/latest', async (c) => {
  try {
    const latestDateResult = await db.execute(sql`SELECT MAX(digest_date) as latest FROM digest_manifest`);
    const latestDate = latestDateResult[0]?.latest;

    if (!latestDate) return c.json({ success: true, data: [] });

    const digestItems = await db
      .select({
        id: stories.id,
        title: stories.title,
        url: stories.url,
        points: stories.points,
        author: stories.author,
        topic: analyses.topic,
        summary: analyses.summary,
        rawJson: analyses.rawJson,
        createdAt: analyses.createdAt,
      })
      .from(stories)
      .innerJoin(analyses, eq(stories.id, analyses.storyId))
      .where(sql`date_trunc('day', ${analyses.createdAt})::date = ${latestDate}`)
      .orderBy(desc(stories.points));

    return c.json({ success: true, count: digestItems.length, data: digestItems });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch latest digest');
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

// --- Bookmark Management ---

app.post('/v1/bookmarks', async (c) => {
  const { storyId, userId } = await c.req.json();
  if (!storyId || !userId) return c.json({ success: false, error: 'Missing parameters' }, 400);

  try {
    const existing = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.storyId, storyId)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(bookmarks)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(bookmarks.id, existing[0].id));
    } else {
      await db.insert(bookmarks).values({
        userId,
        storyId,
        isActive: true
      });
    }
    return c.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Bookmark failed');
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

app.delete('/v1/bookmarks/:storyId', async (c) => {
  const storyId = c.req.param('storyId');
  const userId = c.req.query('userId'); // In production, get from session/token
  if (!storyId || !userId) return c.json({ success: false, error: 'Missing parameters' }, 400);

  try {
    await db.update(bookmarks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.storyId, storyId)));
    return c.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Remove bookmark failed');
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

app.get('/v1/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ success: false, error: 'Missing query parameter q' }, 400);

  try {
    let embedding: number[];

    if (config.env.MOCK_LLM) {
      embedding = new Array(768).fill(0.1);
    } else {
      const apiKey = config.env.GEMINI_API_KEY || '';
      if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

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
      .where(or(ilike(stories.title, `%${q}%`), ilike(analyses.summary, `%${q}%`)))
      .orderBy(vectorQuery)
      .limit(5);

    return c.json({ success: true, data: results });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Search error');
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
