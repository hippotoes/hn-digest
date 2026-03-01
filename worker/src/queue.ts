import { Queue, Worker, Job, FlowProducer } from 'bullmq';
import Redis from 'ioredis';
import { ScrapedStory, CommentDTO } from './scraper';
import { generateAnalysis, generateEmbedding, extractArguments } from './inference';
import { db } from './db';
import { stories, analyses, sentiments } from '@hn-digest/db';
import { sql } from 'drizzle-orm';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6381';
export const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

export const storyQueue = new Queue('story-queue', { connection });
export const flowProducer = new FlowProducer({ connection });

export async function processJob(job: Job) {
  if (job.name === 'refresh-manifest') {
    console.log('[Worker] Refreshing digest_manifest view...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY digest_manifest`);
    return;
  }

  // Reduction Stage
  if (job.name === 'synthesize-analysis') {
    const { story, signals } = job.data;
    console.log(`[Worker] Synthesizing final analysis for: ${story.title}`);

    // The "signals" come from the children Map jobs
    const childValues = await job.getChildrenValues();
    const allSignals = Object.values(childValues);

    const analysis = await generateAnalysis(story, allSignals.join('\n\n'));
    const summaryText = analysis.summary_paragraphs.join('\n\n');
    const embedding = await generateEmbedding(summaryText);

    // Persist
    await db.insert(stories).values({
      id: story.id,
      title: story.title,
      url: story.url,
      points: story.points,
      author: story.author,
      createdAt: new Date(story.timestamp),
    }).onConflictDoUpdate({ target: stories.id, set: { points: story.points } });

    const [insertedAnalysis] = await db.insert(analyses).values({
      storyId: story.id,
      topic: analysis.topic,
      summary: summaryText,
      rawJson: JSON.stringify(analysis),
      embedding,
    }).returning({ id: analyses.id });

    for (const cluster of analysis.sentiments) {
      await db.insert(sentiments).values({
        analysisId: insertedAnalysis.id,
        label: cluster.label,
        sentimentType: cluster.type,
        description: cluster.description,
        agreement: cluster.estimated_agreement
      });
    }
    return analysis;
  }

  // Mapping Stage
  if (job.name === 'extract-arguments') {
    const { comments } = job.data;
    return await extractArguments(comments);
  }
}

export const worker = new Worker('story-queue', processJob, {
  connection,
  concurrency: 1,
  limiter: { max: 10, duration: 60000 }
});
