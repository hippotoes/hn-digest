import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { db } from './db';
import { stories, analyses, bookmarks, preferences } from '@hn-digest/db';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = new Hono();

app.get('/api/v1/ping', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

app.get('/api/v1/digests/daily/latest', async (c) => {
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

app.get('/api/v1/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ success: false, error: 'Missing query parameter q' }, 400);

  try {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' }, { apiVersion: 'v1beta' });
    const result = await model.embedContent(q);
    const embedding = result.embedding.values;

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
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ success: false, error: 'Internal Server Error' }, 500);
  }
});

console.log('🚀 Standalone Hono API server starting on port 3000...');
serve({ fetch: app.fetch, port: 3000 });
