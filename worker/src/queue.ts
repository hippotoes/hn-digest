import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ScrapedStory } from './scraper';
import { generateAnalysis, generateEmbedding } from './inference';
import { db } from './db';
import { stories, analyses, sentiments } from '@hn-digest/db';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6381';
export const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

export const storyQueue = new Queue<ScrapedStory, any, string>('story-queue', { connection });

export async function processJob(job: Job<ScrapedStory>) {
  const story = job.data;
  console.log(`[Worker] Processing job for story: ${story.title}`);

  try {
    // 1. Analyze
    const analysis = await generateAnalysis(story);

    // 2. Generate Embedding from summary
    const summaryText = analysis.summary_paragraphs.join('\\n\\n');
    const embedding = await generateEmbedding(summaryText);

    // 3. Persist to DB
    await db.insert(stories).values({
      id: story.id,
      title: story.title,
      url: story.url,
      points: story.points,
      author: story.author,
      createdAt: new Date(story.timestamp),
    }).onConflictDoUpdate({
      target: stories.id,
      set: { points: story.points }, // Update points if already exists
    });

    const [insertedAnalysis] = await db.insert(analyses).values({
      storyId: story.id,
      topic: analysis.topic,
      summary: summaryText,
      rawJson: JSON.stringify(analysis),
      embedding,
    }).returning({ id: analyses.id });

    // Insert Sentiments
    for (const cluster of analysis.sentiments) {
      await db.insert(sentiments).values({
        analysisId: insertedAnalysis.id,
        label: cluster.label,
        sentimentType: cluster.type,
        description: cluster.description,
        agreement: cluster.estimated_agreement
      });
    }

    console.log(`[Worker] Successfully processed and saved story: ${story.title}`);
  } catch (err: any) {
    console.error(`[Worker] Failed to process story ${story.id}:`, err.message);
    throw err;
  }
}

export const worker = new Worker<ScrapedStory>('story-queue', processJob, {
  connection,
  concurrency: 1, // Process one at a time
  limiter: {
    max: 10,       // Max 10 jobs
    duration: 60000 // per 60 seconds (1 minute)
  }
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});
