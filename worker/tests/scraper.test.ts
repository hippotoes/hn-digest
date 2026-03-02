import { describe, it, expect, vi } from 'vitest';
import { fetchTopHNStories } from '../src/infrastructure/HNScraper';
import * as child_process from 'child_process';
import util from 'util';

// Mock fetch globally
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('topstories.json')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([1, 2]) });
  if (url.includes('item/')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1, type: 'story', url: 'http://test.com', title: 'Test', by: 'test', score: 100, time: 1000 }) });
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html></html>'), json: () => Promise.resolve({}) });
});

// Mock child_process exec via util.promisify
vi.mock('util', () => ({
  default: {
    promisify: vi.fn(() => vi.fn().mockResolvedValue({ stdout: 'Mocked extracted text content.' }))
  },
  promisify: vi.fn(() => vi.fn().mockResolvedValue({ stdout: 'Mocked extracted text content.' }))
}));

describe('Scraper Module', () => {
  it('should fetch stories from HN API and extract content', async () => {
    // Mock the HN /topstories API call
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [111, 222], // Return 2 mock IDs
    });

    // Mock the HN /item API calls
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 111, type: 'story', url: 'https://site.com/1', title: 'Story 1', score: 10, by: 'user1', time: 1000000 }),
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 222, type: 'story', url: 'https://site.com/2', title: 'Story 2', score: 20, by: 'user2', time: 2000000 }),
    });

    const stories = await fetchTopHNStories(2);

    expect(stories).toHaveLength(2);
    expect(stories[0].title).toBe('Story 1');
    expect(stories[0].rawContent).toBe('Mocked extracted text content.');

    // Check points and author
    expect(stories[1].points).toBe(20);
    expect(stories[1].author).toBe('user2');
  });
});
