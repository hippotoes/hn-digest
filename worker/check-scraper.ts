import { fetchTopHNStories } from './src/scraper';

async function checkScraper() {
  console.log('--- Checking Module A (Scraper Engine) ---');
  const stories = await fetchTopHNStories(2);
  for (const story of stories) {
    console.log(`
Story: ${story.title}`);
    console.log(`URL: ${story.url}`);
    console.log(`Extracted Text (First 500 chars):`);
    console.log('-'.repeat(50));
    console.log(story.rawContent.substring(0, 500) + (story.rawContent.length > 500 ? '...' : ''));
    console.log('-'.repeat(50));
  }
}

checkScraper().catch(console.error);
