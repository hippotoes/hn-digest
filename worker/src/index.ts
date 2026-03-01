import { fetchTopHNStories, ScrapedStory, CommentDTO } from './scraper';
import { storyQueue, flowProducer, worker, connection } from './queue';
import './notifier';

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function runScraperAndEnqueue() {
  console.log('🚀 Starting Stage 7 Pipeline (Map-Reduce Sentiment)...');

  const scrapedStories = await fetchTopHNStories(10);
  console.log(`✅ Scraped ${scrapedStories.length} stories. Orchestrating Map-Reduce flows...`);

  for (const story of scrapedStories) {
    const commentChunks = chunkArray(story.comments, 50);

    // Create a BullMQ Flow: Synthesis (Parent) depends on multiple Extractions (Children)
    await flowProducer.add({
      name: 'synthesize-analysis',
      queueName: 'story-queue',
      data: { story },
      children: commentChunks.map((chunk, idx) => ({
        name: 'extract-arguments',
        queueName: 'story-queue',
        data: { storyId: story.id, chunkIndex: idx, comments: chunk },
        opts: { jobId: `map-${story.id}-${idx}` }
      })),
      opts: { jobId: `reduce-${story.id}` }
    });
  }

  await storyQueue.add('refresh-manifest', {}, { jobId: 'refresh-manifest', delay: 300000 }); // Refresh in 5 mins
  console.log('🎉 All stories orchestrated!');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--enqueue')) {
    runScraperAndEnqueue().then(() => {
      setTimeout(() => {
        worker.close();
        connection.quit();
        process.exit(0);
      }, 5000);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else {
    console.log('👷 Worker started. Listening for Map-Reduce flow...');
  }
}
