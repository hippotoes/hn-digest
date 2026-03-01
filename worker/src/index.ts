import { fetchTopHNStories } from './scraper';
import { generateSummary } from './inference';
import { db } from './db';
import { stories, analyses } from '@hn-digest/db';

async function runPipeline() {
  console.log('🚀 Starting MVP Pipeline...');

  // 1. Scrape top 10 stories
  const scrapedStories = await fetchTopHNStories(10);
  console.log(`✅ Scraped ${scrapedStories.length} stories.`);

  for (const story of scrapedStories) {
    try {
      // 2. Generate Summary
      const summary = await generateSummary(story);
      console.log(`✅ Summarized: ${story.title.substring(0, 30)}...`);

      // 3. Persist to DB
      await db.insert(stories).values({
        id: story.id,
        title: story.title,
        url: story.url,
        points: story.points,
        author: story.author,
        createdAt: story.timestamp,
      }).onConflictDoUpdate({
        target: stories.id,
        set: { points: story.points }, // Update points if already exists
      });

      await db.insert(analyses).values({
        storyId: story.id,
        topic: 'Others', // MVP default
        summary: summary,
        rawJson: JSON.stringify({ summary }),
      });

      console.log(`💾 Saved to DB: ${story.title.substring(0, 30)}...`);
    } catch (err: any) {
      console.error(`❌ Pipeline failed for ${story.id}:`, err.message);
    }
  }

  console.log('🎉 MVP Pipeline Completed!');
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  runPipeline();
}
