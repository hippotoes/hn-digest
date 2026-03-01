import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { db } from '@/db';
import { stories, analyses } from '@hn-digest/db';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

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
      .orderBy(stories.points);

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

export const GET = handle(app);
