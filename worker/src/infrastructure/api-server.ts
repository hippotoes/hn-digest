import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { logger } from './logger';
import { AnalysisOrchestrator } from '../application/AnalysisOrchestrator';
import { HNStoryProvider } from './HNStoryProvider';
import { MultiLLMIntelligenceProvider } from './MultiLLMIntelligenceProvider';
import { DrizzleAnalysisRepository } from './DrizzleAnalysisRepository';
import { connection, mapWorker, reduceWorker, flowProducer, reduceQueue, mapQueue } from './BullMQQueue';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

const app = new Hono();

const storyProvider = new HNStoryProvider();
const intelligenceProvider = new MultiLLMIntelligenceProvider();
const analysisRepository = new DrizzleAnalysisRepository();

const orchestrator = new AnalysisOrchestrator(
  storyProvider,
  intelligenceProvider,
  analysisRepository,
  {
    addFlow: (flow) => flowProducer.add(flow),
    addStandardJob: (name, data, opts) => reduceQueue.add(name, data, opts),
  }
);

app.get('/health', (c) => c.json({ status: 'ok', service: 'hn-worker' }));

app.post('/pipeline/run', async (c) => {
  const limit = parseInt(c.req.query('limit') || String(config.scraper.maxStoryLimit));
  logger.info({ limit }, '[API] Manual pipeline trigger');

  // Fire and forget
  orchestrator.runPipeline(limit).catch(err => {
    logger.error({ error: err.message }, '[API] Pipeline background run failed');
  });

  return c.json({ message: 'Pipeline started', limit });
});

app.get('/stats', async (c) => {
  const [mapActive, mapWaiting, reduceActive, reduceWaiting] = await Promise.all([
    mapQueue.getActiveCount(),
    mapQueue.getWaitingCount(),
    reduceQueue.getActiveCount(),
    reduceQueue.getWaitingCount()
  ]);

  return c.json({
    queues: {
      map: { active: mapActive, waiting: mapWaiting },
      reduce: { active: reduceActive, waiting: reduceWaiting }
    }
  });
});

/**
 * AD-HOC MODEL DISCOVERY
 */
app.get('/discovery/models', async (c) => {
  const provider = c.req.query('provider') || 'gemini';

  if (provider === 'gemini') {
    if (config.env.MOCK_LLM) {
      return c.json({ models: ['gemini-1.5-flash', 'gemini-1.5-pro'] });
    }
    const apiKey = config.env.GEMINI_API_KEY || '';
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY not set' }, 400);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Note: The SDK doesn't have a direct 'listModels', usually requires a fetch to the REST API
      // We'll return the known ones for now or use the fetch-based discovery logic if needed.
      return c.json({
        message: 'Use discovery scripts for full listing',
        suggested: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
      });
    } catch (e: any) {
      return c.json({ error: e.message }, 500);
    }
  }

  return c.json({ error: 'Provider discovery not implemented in API' }, 400);
});

if (config.env.NODE_ENV !== 'test') {
  const port = 3001;
  logger.info({ port }, '[API] Worker Management Server starting');
  serve({ fetch: app.fetch, port });
}

export default app;
