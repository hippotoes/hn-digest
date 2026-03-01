import { db } from './db';
import { stories } from '@hn-digest/db';
import { flowProducer } from './queue';

async function reprocess() {
  const allStories = await db.select().from(stories);
  console.log(`🚀 Reprocessing ${allStories.length} stories with V2 Intelligence...`);

  for (const story of allStories) {
    if (!story.rawContent || !story.rawCommentsJson) {
      console.warn(`⚠️ Skipping ${story.title}: No source data found.`);
      continue;
    }

    const comments = JSON.parse(story.rawCommentsJson);
    console.log(`📦 Orchestrating: ${story.title} (${comments.length} comments)`);

    // Split comments into chunks of 50 for the Map phase
    const chunks = [];
    for (let i = 0; i < comments.length; i += 50) {
      chunks.push(comments.slice(i, i + 50));
    }

    await flowProducer.add({
      name: 'synthesize-analysis',
      queueName: 'story-queue',
      data: {
        story: {
          id: story.id,
          title: story.title,
          url: story.url,
          points: story.points,
          author: story.author,
          timestamp: story.createdAt,
          rawContent: story.rawContent
        }
      },
      children: chunks.length > 0 ? chunks.map((chunk, idx) => ({
        name: 'extract-arguments',
        queueName: 'story-queue',
        data: { comments: chunk },
        opts: { jobId: `map-reprocess-${story.id}-${idx}-${Date.now()}` }
      })) : [{
        name: 'extract-arguments',
        queueName: 'story-queue',
        data: { comments: [] }, // Handle stories with no comments
        opts: { jobId: `map-reprocess-${story.id}-none-${Date.now()}` }
      }],
      opts: { jobId: `reduce-reprocess-${story.id}-${Date.now()}` }
    });
  }
  console.log('🎉 All stories re-enqueued for Map-Reduce analysis!');
}

reprocess().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
