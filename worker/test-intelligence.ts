import { storyQueue, worker, connection } from './src/queue';
import { db } from './src/db';
import { stories, analyses, sentiments } from '@hn-digest/db';
import { ScrapedStory } from './src/scraper';

import { QueueEvents } from 'bullmq';

async function testIntelligence() {
  console.log('Running test:intelligence verification script...');

  // Clean DB for fresh test
  await db.delete(sentiments);
  await db.delete(analyses);
  await db.delete(stories);

  // Test against REAL APIs. Make sure .env.local has keys.
  process.env.MOCK_LLM = 'false';

  const mockStory: ScrapedStory = {
    id: '99999',
    title: 'Test Intelligence Story',
    url: 'https://test.com',
    points: 100,
    author: 'tester',
    timestamp: new Date(),
    rawContent: 'Test content here.'
  };

  const queueEvents = new QueueEvents('story-queue', { connection });

  // Run the pipeline
  try {
    const job = await storyQueue.add('analyze-story', mockStory);
    console.log('Job added to queue, waiting for processing...');

    // Wait for the job to complete
    await job.waitUntilFinished(queueEvents);
  } catch (error) {
    console.error('❌ Pipeline execution failed:', error);
    await queueEvents.close();
    process.exit(1);
  }

  await queueEvents.close();

  // Verify DB state
  const allStories = await db.select().from(stories);
  const allAnalyses = await db.select().from(analyses);
  const allSentiments = await db.select().from(sentiments);

  if (allStories.length === 0) {
    console.error('❌ DB Verification Failed: No stories inserted.');
    process.exit(1);
  }

  if (allAnalyses.length === 0) {
    console.error('❌ DB Verification Failed: No analyses inserted.');
    process.exit(1);
  }

  // Expect exactly 4 sentiment clusters based on mock response
  if (allSentiments.length !== 4) {
    console.error(`❌ DB Verification Failed: Expected 4 sentiments, got ${allSentiments.length}.`);
    process.exit(1);
  }

  console.log(`✅ DB Verification Passed! Found ${allStories.length} stories, ${allAnalyses.length} analyses, and ${allSentiments.length} sentiments.`);
  console.log('✅ Automated Intelligence Pipeline Verification: SUCCESS');

  // Cleanup
  await worker.close();
  await connection.quit();
  process.exit(0);
}

testIntelligence().catch((err) => {
  console.error(err);
  process.exit(1);
});
