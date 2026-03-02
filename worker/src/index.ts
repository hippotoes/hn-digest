import sdk from './infrastructure/tracing';
sdk.start();

import { logger } from './infrastructure/logger';
import { connection, mapWorker, reduceWorker, flowProducer, reduceQueue } from './infrastructure/BullMQQueue';
import { AnalysisOrchestrator, QueueOrchestrator } from './application/AnalysisOrchestrator';
import { HNStoryProvider } from './infrastructure/HNStoryProvider';
import { MultiLLMIntelligenceProvider } from './infrastructure/MultiLLMIntelligenceProvider';
import { DrizzleAnalysisRepository } from './infrastructure/DrizzleAnalysisRepository';
import './infrastructure/notifier';

const storyProvider = new HNStoryProvider();
const intelligenceProvider = new MultiLLMIntelligenceProvider();
const analysisRepository = new DrizzleAnalysisRepository();

const queueAdapter: QueueOrchestrator = {
  addFlow: (flow) => flowProducer.add(flow),
  addStandardJob: (name, data, opts) => reduceQueue.add(name, data, opts),
};

export const orchestrator = new AnalysisOrchestrator(
  storyProvider,
  intelligenceProvider,
  analysisRepository,
  queueAdapter
);

export async function runScraperAndEnqueue() {
  await orchestrator.runPipeline(10);
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
