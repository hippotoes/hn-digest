import { db } from './db';
import { stories } from '@hn-digest/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function fetchCommentTree(commentIds: number[]): Promise<any[]> {
  const allComments: any[] = [];
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
      } catch (e) {}
    });
    await Promise.all(promises);
  }
  await fetchRecursive(commentIds, null);
  return allComments;
}

async function backfill() {
  const allStories = await db.select().from(stories);
  console.log(`🚀 Starting deep backfill for ${allStories.length} stories...`);

  for (const story of allStories) {
    console.log(`📦 Backfilling: ${story.title}`);

    // 1. Fetch Article Content
    let rawContent = '[Extraction Failed]';
    if (story.url) {
      try {
        const { stdout } = await execAsync(`trafilatura -u "${story.url}"`, { timeout: 15000 });
        rawContent = stdout.trim();
      } catch (err) {}
    }

    // 2. Fetch Deep Comment Tree
    let comments: any[] = [];
    try {
      const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${story.id}.json`);
      const item = await res.json();
      if (item.kids) {
        comments = await fetchCommentTree(item.kids);
      }
    } catch (e) {}

    // 3. Persist
    await db.update(stories)
      .set({
        rawContent,
        rawCommentsJson: JSON.stringify(comments)
      })
      .where(sql`id = ${story.id}`);

    console.log(`✅ Persisted ${comments.length} comments for ${story.id}`);
  }
  console.log('🎉 Backfill complete!');
}

import { sql } from 'drizzle-orm';
backfill().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
