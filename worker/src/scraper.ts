import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { NodeHtmlMarkdown } from 'node-html-markdown';

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      const jitter = Math.random() * 1000;
      await delay(1000 + jitter);
    }
  }
}

async function fetchRawTextWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await delay(1000);
    }
  }
  return '';
}

async function fetchCommentTree(commentIds: number[]): Promise<CommentDTO[]> {
  const allComments: CommentDTO[] = [];

  async function fetchRecursive(ids: number[], parentId: string | null) {
    for (const id of ids) {
      try {
        await delay(250); // Increased delay for HN respect
        const item = await fetchWithRetry(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);

        if (!item || item.type !== 'comment' || item.deleted || item.dead) continue;

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
      } catch (e: any) {
        logger.warn({ commentId: id, error: e.message }, '[Scraper] Error fetching comment');
      }
    }
  }

  await fetchRecursive(commentIds, null);
  return allComments;
}

export async function fetchTopHNStories(limit: number = 10, skipIds: string[] = []): Promise<ScrapedStory[]> {
  logger.info({ limit, skippedCount: skipIds.length }, '[Scraper] Fetching top stories from HN (Resilient Mode)');

  const storyIds: number[] = await fetchWithRetry('https://hacker-news.firebaseio.com/v0/topstories.json');
  const skipSet = new Set(skipIds);
  const candidateIds = storyIds.filter(id => !skipSet.has(String(id))).slice(0, limit);

  const stories: ScrapedStory[] = [];

  for (const id of candidateIds) {
    try {
      await delay(1000); // 1s delay between stories
      const item = await fetchWithRetry(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);

      if (!item || item.type !== 'story' || !item.url) continue;

      logger.info({ storyId: id, title: item.title }, '[Scraper] Processing story');

      // 1. Content Extraction with Fallback
      let rawContent = '';
      try {
        const { stdout } = await execAsync(`trafilatura -u "${item.url}"`, { timeout: 15000 });
        rawContent = stdout.trim();
      } catch (err: any) {
        logger.warn({ storyId: id, error: err.message }, '[Scraper] Trafilatura failed, using Markdown fallback');
        try {
          const html = await fetchRawTextWithRetry(item.url);
          rawContent = NodeHtmlMarkdown.translate(html).substring(0, 15000);
        } catch (fallbackErr: any) {
          logger.error({ storyId: id, error: fallbackErr.message }, '[Scraper] All extraction methods failed');
          rawContent = '[Extraction Failed]';
        }
      }

      // 2. Exhaustive Comment Fetching
      const comments = item.kids ? await fetchCommentTree(item.kids) : [];
      logger.info({ storyId: id, commentCount: comments.length }, '[Scraper] Fetched comments');

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
    } catch (e: any) {
      logger.error({ storyId: id, error: e.message }, '[Scraper] Error fetching story');
    }
  }

  return stories;
}
