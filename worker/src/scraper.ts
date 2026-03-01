import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ScrapedStory {
  id: string;
  title: string;
  url: string;
  points: number;
  author: string;
  timestamp: Date;
  rawContent: string;
}

export async function fetchTopHNStories(limit: number = 10): Promise<ScrapedStory[]> {
  console.log(`[Scraper] Fetching top ${limit} stories from HN...`);

  const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const storyIds: number[] = await topStoriesRes.json();
  const topIds = storyIds.slice(0, limit);

  const stories: ScrapedStory[] = [];

  for (const id of topIds) {
    try {
      const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      const item = await itemRes.json();

      if (!item || item.type !== 'story' || !item.url) continue;

      let rawContent = '';
      try {
        console.log(`[Scraper] Extracting content for: ${item.title}`);
        const { stdout } = await execAsync(`trafilatura -u "${item.url}"`, { timeout: 15000 });
        rawContent = stdout.trim();
      } catch (err: any) {
        console.warn(`[Scraper] Trafilatura failed for ${item.url}:`, err.message);
        rawContent = '[Extraction Failed - Paywall or Timeout]';
      }

      stories.push({
        id: String(item.id),
        title: item.title,
        url: item.url,
        points: item.score || 0,
        author: item.by,
        timestamp: new Date((item.time || 0) * 1000),
        rawContent: rawContent.substring(0, 15000) // Keep reasonable limits
      });
    } catch (e) {
      console.error(`[Scraper] Error fetching item ${id}`, e);
    }
  }

  return stories;
}
