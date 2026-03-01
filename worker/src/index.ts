import { fetchTopHNStories } from './scraper';
import { storyQueue, worker, connection } from './queue';
import './notifier'; // Start notification worker

export async function runScraperAndEnqueue() {
  console.log('🚀 Starting Stage 2 Pipeline (Scraper -> Queue)...');

  // 1. Scrape top 10 stories
  const scrapedStories = await fetchTopHNStories(10);
  console.log(`✅ Scraped ${scrapedStories.length} stories. Queuing them for analysis...`);

  for (const story of scrapedStories) {
    await storyQueue.add('analyze-story', story, {
      jobId: `story-${story.id}`, // Prevent duplicate jobs
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  console.log('🎉 All stories queued! Worker will process them in the background.');
}

// Check if running as a standalone script
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--enqueue')) {
    runScraperAndEnqueue().then(() => {
      // Allow it to exit gracefully
      setTimeout(() => {
        worker.close();
        connection.quit();
        process.exit(0);
      }, 2000);
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    console.log('👷 Worker started. Listening for jobs...');
  }
}
