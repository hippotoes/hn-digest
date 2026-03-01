import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { db } from '@/db';
import { stories, analyses } from '@hn-digest/db';
import { eq, ilike, or, sql, desc } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

const app = new Hono().basePath('/api/v1');

app.get('/digests/daily/latest', async (c) => {
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

app.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q) {
    return c.json({ success: false, error: 'Missing query parameter q' }, 400);
  }

  try {
    let embedding: number[] = [];
    if (process.env.MOCK_LLM === 'true') {
      embedding = Array(768).fill(0.1);
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

    // Hybrid Search: Combine text match (ILIKE) with Vector Similarity
    const vectorQuery = sql`${analyses.embedding} <=> ${JSON.stringify(embedding)}`;

    const results = await db
      .select({
        id: stories.id,
        title: stories.title,
        url: stories.url,
        points: stories.points,
        summary: analyses.summary,
        similarity: sql`1 - (${vectorQuery})` // Optional: convert distance to similarity score
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

export const GET = handle(app);
