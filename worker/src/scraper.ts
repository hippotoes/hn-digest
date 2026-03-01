import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CommentDTO {
  id: string;
  author: string;
  text: string;
  parentId: string | null;
  score: number;
}

export interface ScrapedStory {
  id: string;
  title: string;
  url: string;
  points: number;
  author: string;
  timestamp: Date;
  rawContent: string;
  comments: CommentDTO[];
}

async function fetchCommentTree(commentIds: number[]): Promise<CommentDTO[]> {
  const allComments: CommentDTO[] = [];

  async function fetchRecursive(ids: number[], parentId: string | null) {
    const promises = ids.map(async (id) => {
      try {
        const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const item = await res.json();
        if (!item || item.type !== 'comment' || item.deleted || item.dead) return;

        allComments.push({
          id: String(item.id),
          author: item.by || '[deleted]',
          text: item.text || '',
          parentId,
          score: item.score || 0
        });

        if (item.kids && item.kids.length > 0) {
          await fetchRecursive(item.kids, String(item.id));
        }
      } catch (e) {
        console.warn(`[Scraper] Error fetching comment ${id}:`, e);
      }
    });
    await Promise.all(promises);
  }

  await fetchRecursive(commentIds, null);
  return allComments;
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

      console.log(`[Scraper] Processing: ${item.title}`);

      // 1. Content Extraction
      let rawContent = '';
      try {
        const { stdout } = await execAsync(`trafilatura -u "${item.url}"`, { timeout: 15000 });
        rawContent = stdout.trim();
      } catch (err: any) {
        rawContent = '[Extraction Failed]';
      }

      // 2. Exhaustive Comment Fetching
      const comments = item.kids ? await fetchCommentTree(item.kids) : [];
      console.log(`[Scraper] Fetched ${comments.length} comments for story ${id}`);

      stories.push({
        id: String(item.id),
        title: item.title,
        url: item.url,
        points: item.score || 0,
        author: item.by,
        timestamp: new Date((item.time || 0) * 1000),
        rawContent: rawContent.substring(0, 15000),
        comments
      });
    } catch (e) {
      console.error(`[Scraper] Error fetching item ${id}`, e);
    }
  }

  return stories;
}
