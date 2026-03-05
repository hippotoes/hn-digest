import { StoryProvider, IntelligenceProvider, AnalysisRepository } from '../domain/ports';
import { logger } from '../infrastructure/logger';
import { config } from '../config';

export interface QueueOrchestrator {
  addFlow(flow: any): Promise<any>;
  addStandardJob(name: string, data: any, opts?: any): Promise<any>;
}

export class AnalysisOrchestrator {
  constructor(
    private storyProvider: StoryProvider,
    private intelligenceProvider: IntelligenceProvider,
    private analysisRepository: AnalysisRepository,
    private queue: QueueOrchestrator
  ) {}

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async runPipeline(limit: number = config.scraper.maxStoryLimit) {
    logger.info({ limit }, '[Orchestrator] Starting Analysis Pipeline');

    const skipIds = await this.analysisRepository.getExistingStoryIds();
    const scrapedStories = (await this.storyProvider.fetchTopStories(limit, skipIds)) || [];

    if (scrapedStories.length === 0) {
      logger.info('[Orchestrator] No new stories to process.');
      return;
    }

    for (const story of scrapedStories) {
      const commentChunks = this.chunkArray(story.comments, config.jobs.commentChunkSize);

      await this.queue.addFlow({
        name: 'synthesize-analysis',
        queueName: 'reduce-queue',
        data: { story },
        children: commentChunks.map((chunk, idx) => ({
          name: 'extract-arguments',
          queueName: 'map-queue',
          data: { storyId: story.id, chunkIndex: idx, comments: chunk },
          opts: {
            jobId: `map-${story.id}-${idx}-${Date.now()}`,
            attempts: config.jobs.mapAttempts,
            backoff: { type: 'exponential', delay: config.jobs.mapBackoffMs }
          }
        })),
        opts: {
          jobId: `reduce-${story.id}-${Date.now()}`,
          attempts: config.jobs.reduceAttempts,
          backoff: { type: 'exponential', delay: config.jobs.reduceBackoffMs }
        }
      });
    }

    await this.queue.addStandardJob('refresh-manifest', {}, { jobId: 'refresh-manifest', delay: config.jobs.refreshManifestDelayMs });
    logger.info('[Orchestrator] All stories orchestrated in parallel.');
  }
}
