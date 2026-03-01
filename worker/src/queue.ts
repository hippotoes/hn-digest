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
  const start = Date.now();

  if (job.name === 'refresh-manifest') {
    console.log('[Worker] Refreshing digest_manifest view...');
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY digest_manifest`);
    return;
  }

  // Reduction Stage
  if (job.name === 'synthesize-analysis') {
    const { story } = job.data;
    console.log(`[Profiler] [Reduce Start] Story: ${story.title}`);

    const childValues = await job.getChildrenValues();
    const allSignals = Object.values(childValues);

    const reduceStart = Date.now();
    const analysis = await generateAnalysis(story, allSignals.join('\n\n'));
    const reduceEnd = Date.now();
    console.log(`[Profiler] [Reduce LLM Done] ${story.title} took ${((reduceEnd - reduceStart) / 1000).toFixed(2)}s`);

    const summaryText = analysis.summary_paragraphs.join('\n\n');
    const embedding = await generateEmbedding(summaryText);

    // Persist Story
    await db.insert(stories).values({
      id: story.id,
      title: story.title,
      url: story.url,
      points: story.points,
      author: story.author,
      createdAt: new Date(story.timestamp),
    }).onConflictDoUpdate({ target: stories.id, set: { points: story.points } });

    // Persist Analysis
    const [insertedAnalysis] = await db.insert(analyses).values({
      storyId: story.id,
      topic: analysis.topic,
      summary: summaryText,
      rawJson: JSON.stringify(analysis),
      embedding,
    }).returning({ id: analyses.id });

    // Persist Article Sentiment
    await db.insert(sentiments).values({
      analysisId: insertedAnalysis.id,
      source: 'article',
      label: analysis.article_sentiment.label,
      sentimentType: analysis.article_sentiment.type,
      description: analysis.article_sentiment.description,
      agreement: 'N/A'
    });

    // Persist Community Sentiments
    for (const cluster of analysis.community_sentiments) {
      await db.insert(sentiments).values({
        analysisId: insertedAnalysis.id,
        source: 'community',
        label: cluster.label,
        sentimentType: cluster.type,
        description: cluster.description,
        agreement: cluster.estimated_agreement
      });
    }

    const total = Date.now() - start;
    console.log(`[Profiler] [Reduce Total Done] ${story.title} total job time: ${(total / 1000).toFixed(2)}s`);
    return analysis;
  }

  // Mapping Stage
  if (job.name === 'extract-arguments') {
    const { storyId } = job.data;
    console.log(`[Profiler] [Map Start] Story ID: ${storyId}`);
    const mapStart = Date.now();
    const result = await extractArguments(job.data.comments);
    const mapEnd = Date.now();
    console.log(`[Profiler] [Map Done] Story ID: ${storyId} took ${((mapEnd - mapStart) / 1000).toFixed(2)}s`);
    return result;
  }
}

/**
 * SOTA WORKER CONFIGURATION
 * Aligned with DeepSeek "No Constraints" Rate Limit Policy:
 * https://api-docs.deepseek.com/quick_start/rate_limit
 *
 * - Concurrency 3: Balanced for local resource limits during builds.
 * - Limiter 50/min: Prevents artificial throttling.
 */
export const worker = new Worker('story-queue', processJob, {
  connection,
  concurrency: 3,
  limiter: { max: 50, duration: 60000 }
});
