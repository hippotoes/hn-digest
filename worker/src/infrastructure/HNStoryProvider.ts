import { StoryProvider } from '../domain/ports';
import { Story, Comment } from '../domain/models';
import { fetchTopHNStories } from './HNScraper';

export class HNStoryProvider implements StoryProvider {
  async fetchTopStories(limit: number, skipIds: string[]): Promise<Story[]> {
    const scraped = await fetchTopHNStories(limit, skipIds);
    return scraped.map(s => ({
      ...s,
      comments: s.comments.map(c => ({
        ...c,
        parentId: c.parentId || null,
      }))
    }));
  }
}
