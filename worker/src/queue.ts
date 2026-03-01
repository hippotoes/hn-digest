import { Queue, Worker, Job, FlowProducer } from 'bullmq';
import Redis from 'ioredis';
import { generateAnalysis, generateEmbedding, extractArguments } from './inference';
import { db } from './db';
import { stories, analyses, sentiments } from '@hn-digest/db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6381';
export const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

// --- Specialized Queues ---
export const mapQueue = new Queue('map-queue', { connection });
export const reduceQueue = new Queue('reduce-queue', { connection });
export const flowProducer = new FlowProducer({ connection });

const tracer = trace.getTracer('hn-digest-worker');

/**
 * SHARED PROCESSING LOGIC
 */
export async function processJob(job: Job) {
  const start = Date.now();
  const traceId = job.opts.jobId || crypto.randomUUID();

  return await tracer.startActiveSpan(job.name, async (span) => {
    span.setAttributes({
      'job.id': job.id || 'unknown',
      'job.name': job.name,
      'trace.id': traceId
    });

    if (job.name === 'refresh-manifest') {
      logger.info({ traceId }, '[Worker] Refreshing digest_manifest view');
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY digest_manifest`);
      span.end();
      return;
    }

    // REDUCE PHASE (DeepSeek Reasoner)
    if (job.name === 'synthesize-analysis') {
      const { story } = job.data;
      logger.info({ traceId, storyId: story.id, title: story.title }, '[Worker] Synthesizing final analysis');

      const childValues = await job.getChildrenValues();
      const allSignals = Object.values(childValues);

      const reduceStart = Date.now();
      try {
        const analysis = await generateAnalysis(story, allSignals.join('\n\n'));
        const reduceEnd = Date.now();
        logger.info({
          traceId,
          storyId: story.id,
          duration: (reduceEnd - reduceStart) / 1000
        }, '[Worker] Reduce LLM synthesis complete');

        const summaryText = analysis.summary_paragraphs.join('\n\n');

        let embedding: number[] | null = null;
        try {
          embedding = await tracer.startActiveSpan('generate-embedding', async (embSpan) => {
            const emb = await generateEmbedding(summaryText);
            embSpan.end();
            return emb;
          });
        } catch (embErr: any) {
          logger.warn({ traceId, storyId: story.id, error: embErr.message }, '[Worker] Embedding failed - Degrading gracefully');
        }

        // Persist
        await tracer.startActiveSpan('db-persistence', async (dbSpan) => {
          await db.insert(stories).values({
            id: story.id,
            title: story.title,
            url: story.url,
            points: story.points,
            author: story.author,
            createdAt: new Date(story.timestamp),
            rawContent: story.rawContent,
            rawCommentsJson: JSON.stringify(story.comments || [])
          }).onConflictDoUpdate({
            target: stories.id,
            set: { points: story.points, rawContent: story.rawContent, rawCommentsJson: JSON.stringify(story.comments || []) }
          });

          const [insertedAnalysis] = await db.insert(analyses).values({
            storyId: story.id,
            topic: analysis.topic,
            summary: summaryText,
            rawJson: JSON.stringify(analysis),
            embedding: embedding as any,
          }).returning({ id: analyses.id });

          await db.insert(sentiments).values({
            analysisId: insertedAnalysis.id,
            source: 'article',
            label: analysis.article_sentiment.label,
            sentimentType: analysis.article_sentiment.type,
            description: analysis.article_sentiment.description,
            agreement: 'N/A'
          });

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
          dbSpan.end();
        });

        const total = Date.now() - start;
        logger.info({ traceId, storyId: story.id, totalDuration: total / 1000 }, '[Worker] Reduce Job fully completed');
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return analysis;
      } catch (e: any) {
        logger.error({ traceId, storyId: story.id, error: e.message }, '[Worker] Reduce stage failed');
        span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
        span.end();
        throw e;
      }
    }

    // MAP PHASE (DeepSeek Chat)
    if (job.name === 'extract-arguments') {
      const { storyId } = job.data;
      logger.info({ traceId, storyId }, '[Worker] Mapping arguments from comments (Unthrottled DeepSeek)');
      const mapStart = Date.now();
      try {
        const result = await extractArguments(job.data.comments);
        const mapEnd = Date.now();
        logger.info({ traceId, storyId, duration: (mapEnd - mapStart) / 1000 }, '[Worker] Map stage completed');
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (e: any) {
        logger.error({ traceId, storyId, error: e.message }, '[Worker] Map stage failed');
        span.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
        span.end();
        throw e;
      }
    }

    span.end();
  });
}

/**
 * UNTHROTTLED WORKERS (DeepSeek-Centric)
 * Aligned with DeepSeek's server-side queuing policy.
 */
export const mapWorker = new Worker('map-queue', processJob, {
  connection,
  concurrency: 10, // Maximize parallel extraction
});

export const reduceWorker = new Worker('reduce-queue', processJob, {
  connection,
  concurrency: 5, // Balanced for heavy reasoning
});
