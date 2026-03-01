import sdk from './tracing';
sdk.start();

import { fetchTopHNStories } from './scraper';
import { reduceQueue, flowProducer, mapWorker, reduceWorker, connection } from './queue';
import { logger } from './logger';
import { db } from './db';
import { analyses } from '@hn-digest/db';
import './notifier';

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function runScraperAndEnqueue() {
  logger.info('[Worker] Starting Stage 7 Pipeline (Unthrottled Incremental Map-Reduce)');

  const existingAnalyses = await db.select({ storyId: analyses.storyId }).from(analyses);
  const skipIds = existingAnalyses.map(a => a.storyId).filter((id): id is string => !!id);

  const scrapedStories = await fetchTopHNStories(10, skipIds);

  if (scrapedStories.length === 0) {
    logger.info('[Worker] No new stories to process. Efficiency: 100%');
    return;
  }

  logger.info({ count: scrapedStories.length }, '[Worker] Scraped new stories. Orchestrating flows (Full Parallel Mode)');

  for (const story of scrapedStories) {
    const commentChunks = chunkArray(story.comments, 50);

    await flowProducer.add({
      name: 'synthesize-analysis',
      queueName: 'reduce-queue',
      data: { story },
      children: commentChunks.map((chunk, idx) => ({
        name: 'extract-arguments',
        queueName: 'map-queue',
        data: { storyId: story.id, chunkIndex: idx, comments: chunk },
        opts: {
          jobId: `map-${story.id}-${idx}-${Date.now()}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 }
        }
      })),
      opts: {
        jobId: `reduce-${story.id}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 }
      }
    });
    // DELAY REMOVED: Full parallel orchestration
  }

  await reduceQueue.add('refresh-manifest', {}, { jobId: 'refresh-manifest', delay: 300000 });
  logger.info('[Worker] All stories orchestrated in parallel!');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--enqueue')) {
    runScraperAndEnqueue().then(() => {
      setTimeout(() => {
        mapWorker.close();
        reduceWorker.close();
        connection.quit();
        process.exit(0);
      }, 5000);
    }).catch(err => {
      logger.error({ error: err.message }, '[Worker] Enqueue failed');
      process.exit(1);
    });
  } else {
    logger.info('[Worker] Multi-Queue Worker started. Listening for Map and Reduce jobs');
  }
}
