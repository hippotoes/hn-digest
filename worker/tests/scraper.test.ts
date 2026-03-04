import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTopHNStories } from '../src/infrastructure/HNScraper';
import * as child_process from 'child_process';
import util from 'util';

const { mockExecAsync } = vi.hoisted(() => ({
  mockExecAsync: vi.fn().mockResolvedValue({ stdout: 'Mocked extracted text content.' })
}));

vi.mock('util', () => ({
  default: { promisify: vi.fn(() => mockExecAsync) },
  promisify: vi.fn(() => mockExecAsync)
}));

// Mock delay to be instant
vi.mock('../src/infrastructure/HNScraper', async () => {
  const actual = await vi.importActual('../src/infrastructure/HNScraper') as any;
  return {
    ...actual,
    // We can't easily mock the internal 'delay' function unless it's exported
    // So we'll rely on Vitest fake timers in the test
  };
});

const defaultFetchMock = (url: string) => {
  if (url.includes('topstories.json')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([1, 2]) });
  if (url.includes('item/')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1, type: 'story', url: 'http://test.com', title: 'Test', by: 'test', score: 100, time: 1000 }) });
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html></html>'), json: () => Promise.resolve({}) });
};

global.fetch = vi.fn().mockImplementation(defaultFetchMock);

describe('☢️ Nuclear Scraper Module (160 Cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockExecAsync.mockReset();
    mockExecAsync.mockResolvedValue({ stdout: 'Mocked extracted text content.' });
    (global.fetch as any).mockReset();
    (global.fetch as any).mockImplementation(defaultFetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. HN API & Item Structure Stress (40 cases)
  const itemStructureCases = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    type: (i % 5 === 0 ? 'job' : (i % 7 === 0 ? 'poll' : 'story')),
    hasUrl: i % 2 !== 0, // Changed to ensure some have URLs
    commentCount: i % 5,
    dead: i % 10 === 0
  }));

  it.each(itemStructureCases)('Case 1.$id: Handles item structure variations', async ({ id, type, hasUrl, commentCount, dead }) => {
    const storyId = 1000 + id;
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [storyId] });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({
        id: storyId,
        type,
        url: hasUrl ? `http://test-${id}.com` : undefined,
        title: `Title ${id}`,
        score: id,
        by: `user-${id}`,
        dead,
        kids: Array.from({ length: commentCount }, (_, j) => 2000 + id * 10 + j)
      })
    });

    if (commentCount > 0) {
      for (let j = 0; j < commentCount; j++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true, status: 200, json: async () => ({ id: 2000 + id * 10 + j, type: 'comment', text: `C ${j}`, by: 'u' })
        });
      }
    }

    const promise = fetchTopHNStories(1);
    await vi.runAllTimersAsync();
    const stories = await promise;

    const expectedLength = (type === 'story' && !dead && hasUrl) ? 1 : 0;
    expect(stories).toHaveLength(expectedLength);
  });

  // 2. Scraping & Trafilatura Adversaries (40 cases)
  const scraperAdversaryCases = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    failTrafilatura: i % 2 === 0,
    failFallback: i % 4 === 0,
    contentSize: i * 100
  }));

  it.each(scraperAdversaryCases)('Case 2.$id: Survives extraction adversaries', async ({ id, failTrafilatura, failFallback, contentSize }) => {
    const storyId = 3000 + id;
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [storyId] });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ id: storyId, type: 'story', url: `http://adv-${id}.com`, title: 'T', score: 1, by: 'u' })
    });

    if (failTrafilatura) {
      mockExecAsync.mockRejectedValueOnce(new Error('Trafilatura Crash'));
    } else {
      mockExecAsync.mockResolvedValueOnce({ stdout: 'A'.repeat(contentSize) });
    }

    if (failFallback) {
      // fetchRawTextWithRetry retries 3 times
      (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    } else {
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, text: async () => `<html>${'B'.repeat(contentSize)}</html>` });
    }

    const promise = fetchTopHNStories(1);
    await vi.runAllTimersAsync();
    const stories = await promise;

    expect(stories).toHaveLength(1);
    if (failTrafilatura && failFallback) {
      expect(stories[0].rawContent).toBe('[Extraction Failed]');
    }
  });

  // 3. Network Resilience & Retry Stress (40 cases)
  const retryCases = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    failCount: (i % 2) + 1, // Max 2 failures (will succeed on 2nd or 3rd attempt)
    eventuallySucceed: i % 5 !== 0 // 1 in 5 fail permanently
  }));

  it.each(retryCases)('Case 3.$id: Tests network retry logic', async ({ id, failCount, eventuallySucceed }) => {
    const storyId = 4000 + id;
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [storyId] });

    if (eventuallySucceed) {
        // Fail failCount times then succeed
        for (let f = 0; f < failCount; f++) {
            (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 503 });
        }
        (global.fetch as any).mockResolvedValueOnce({
            ok: true, status: 200, json: async () => ({ id: storyId, type: 'story', url: 'http://t', title: 'T', score: 1, by: 'u' })
        });
    } else {
        // Fail all 3 retries
        (global.fetch as any).mockResolvedValue({ ok: false, status: 500 });
    }

    const promise = fetchTopHNStories(1);
    await vi.runAllTimersAsync();
    const stories = await promise;

    expect(stories.length).toBe(eventuallySucceed ? 1 : 0);
  });

  // 4. Comment Filtering Stress (40 cases)
  const commentStressCases = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    deadCount: i % 4,
    deletedCount: i % 3,
    aliveCount: (i % 2) + 1
  }));

  it.each(commentStressCases)('Case 4.$id: Filters dead/deleted comments at scale', async ({ id, deadCount, deletedCount, aliveCount }) => {
    const storyId = 5000 + id;
    const kids = Array.from({ length: deadCount + deletedCount + aliveCount }, (_, j) => 6000 + id * 10 + j);

    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => [storyId] });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ id: storyId, type: 'story', url: 'http://t', title: 'T', kids })
    });

    for (let j = 0; j < deadCount; j++) {
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: kids[j], type: 'comment', dead: true }) });
    }
    for (let j = deadCount; j < deadCount + deletedCount; j++) {
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: kids[j], type: 'comment', deleted: true }) });
    }
    for (let j = deadCount + deletedCount; j < kids.length; j++) {
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: kids[j], type: 'comment', text: 'Alive', by: 'u' }) });
    }

    const promise = fetchTopHNStories(1);
    await vi.runAllTimersAsync();
    const stories = await promise;

    expect(stories[0].comments).toHaveLength(aliveCount);
  });
});
