import { StoryProvider, IntelligenceProvider, AnalysisRepository } from '../domain/ports';
import { logger } from '../infrastructure/logger';

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

  async runPipeline(limit: number = 10) {
    logger.info({ limit }, '[Orchestrator] Starting Analysis Pipeline');

    const skipIds = await this.analysisRepository.getExistingStoryIds();
    const scrapedStories = (await this.storyProvider.fetchTopStories(limit, skipIds)) || [];

    if (scrapedStories.length === 0) {
      logger.info('[Orchestrator] No new stories to process.');
      return;
    }

    for (const story of scrapedStories) {
      const commentChunks = this.chunkArray(story.comments, 50);

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
    }

    await this.queue.addStandardJob('refresh-manifest', {}, { jobId: 'refresh-manifest', delay: 300000 });
    logger.info('[Orchestrator] All stories orchestrated in parallel.');
  }
}
