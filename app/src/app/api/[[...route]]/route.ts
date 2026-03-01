import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { db } from '@/db';
import { stories, analyses, sentiments, bookmarks } from '@hn-digest/db';
import { eq, desc, sql } from 'drizzle-orm';
import { logger } from '@/logger';

const app = new Hono().basePath('/api');

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
    const orphanedAnalyses = await db.execute(sql`SELECT count(*) FROM analyses WHERE story_id NOT IN (SELECT id FROM stories)`);
    return c.json({
      status: 'ok',
      orphaned_analyses: orphanedAnalyses[0].count
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

    const analysisIds = digestItems.map(i => i.id); // Note: this logic might need adjustment if using multiple analyses per story
    // But for latest, we return the items.

    return c.json({ success: true, data: digestItems });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to fetch latest digest');
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
