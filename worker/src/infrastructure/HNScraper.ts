import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { config } from '../config';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

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

async function fetchWithRetry(url: string, retries = config.scraper.retries): Promise<any> {
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
      await delay(config.scraper.storyDelayMs + jitter);
    }
  }
}

async function fetchRawTextWithRetry(url: string, retries = config.scraper.retries): Promise<string> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await delay(config.scraper.storyDelayMs);
    }
  }
  throw lastErr;
}

async function fetchCommentTree(commentIds: number[]): Promise<CommentDTO[]> {
  const allComments: CommentDTO[] = [];
  const MAX_COMMENTS = 200; // Safety cap to prevent memory issues

  async function fetchLevel(ids: number[], parentId: string | null) {
    if (allComments.length >= MAX_COMMENTS) return;

    // Fetch siblings in parallel
    await Promise.all(ids.slice(0, 50).map(async (id) => {
      if (allComments.length >= MAX_COMMENTS) return;

      try {
        const item = await fetchWithRetry(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);

        if (!item || item.type !== 'comment' || item.deleted || item.dead) return;

        allComments.push({
          id: String(item.id),
          author: item.by || '[deleted]',
          text: item.text || '',
          parentId,
          score: item.score || 0
        });

        if (item.kids && item.kids.length > 0) {
          await fetchLevel(item.kids, String(item.id));
        }
      } catch (e: any) {
        logger.warn({ commentId: id, error: e.message }, '[Scraper] Error fetching comment');
      }
    }));
  }

  await fetchLevel(commentIds, null);
  return allComments;
}

export async function fetchTopHNStories(limit: number = config.scraper.maxStoryLimit, skipIds: string[] = []): Promise<ScrapedStory[]> {
  logger.info({ limit, skippedCount: skipIds.length }, '[Scraper] Fetching top stories from HN (Resilient Mode)');

  const storyIds: number[] = await fetchWithRetry('https://hacker-news.firebaseio.com/v0/topstories.json');
  const skipSet = new Set(skipIds);
  const candidateIds = storyIds.filter(id => !skipSet.has(String(id))).slice(0, limit);

  // Process stories in parallel with a concurrency limit of 3
  const stories: ScrapedStory[] = [];
  const CONCURRENCY = 3;

  for (let i = 0; i < candidateIds.length; i += CONCURRENCY) {
    const chunk = candidateIds.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (id) => {
      try {
        const item = await fetchWithRetry(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);

        if (!item || item.type !== 'story' || !item.url) return;

        const storyUrl = String(item.url)
          .replace(/\\n/g, '')
          .replace(/\\r/g, '')
          .trim()
          .replace(/[\s\r\n]/g, '');

        logger.info({ storyId: id, title: item.title, url: storyUrl }, '[Scraper] Processing story');

        // 1. Content Extraction with Fallback
        let rawContent = '';
        try {
          const { stdout } = await execFileAsync('trafilatura', ['-u', storyUrl], {
            timeout: config.scraper.trafilaturaTimeoutMs,
          }).catch(err => {
            if (err.stdout && err.stdout.trim().length > 100) {
              return { stdout: err.stdout };
            }
            throw err;
          });
          rawContent = stdout.trim();

          if (rawContent.length < 50) {
             throw new Error('Trafilatura returned empty or too short content');
          }
        } catch (err: any) {
          const cleanErrMsg = err.message ? err.message.trim() : 'Unknown error';
          logger.warn({ storyId: id, error: cleanErrMsg }, '[Scraper] Trafilatura failed, using Markdown fallback');
          try {
            const html = await fetchRawTextWithRetry(storyUrl);
            rawContent = NodeHtmlMarkdown.translate(html).substring(0, config.scraper.maxContentLength);
          } catch (fallbackErr: any) {
            rawContent = '[Extraction Failed]';
          }
        }

        // 2. Exhaustive Comment Fetching (now parallelized internally)
        const comments = item.kids ? await fetchCommentTree(item.kids) : [];
        logger.info({ storyId: id, commentCount: comments.length }, '[Scraper] Fetched comments');

        stories.push({
          id: String(item.id),
          title: item.title,
          url: item.url,
          points: item.score || 0,
          author: item.by,
          timestamp: new Date((item.time || 0) * 1000),
          rawContent: rawContent.substring(0, config.scraper.maxContentLength),
          comments
        });
      } catch (e: any) {
        logger.error({ storyId: id, error: e.message }, '[Scraper] Error fetching story');
      }
    }));
  }

  return stories;
}
