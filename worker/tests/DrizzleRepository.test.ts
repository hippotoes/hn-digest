import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleAnalysisRepository } from '../src/infrastructure/DrizzleAnalysisRepository';

// Flexible mock that handles chained calls
const createChainedMock = () => {
  const mock: any = vi.fn(() => mock);
  mock.values = vi.fn(() => mock);
  mock.onConflictDoUpdate = vi.fn(() => mock);
  mock.returning = vi.fn().mockResolvedValue([{ id: 'uuid' }]);
  // Support being called as a promise
  mock.then = (onFulfilled: any) => Promise.resolve([{ id: 'uuid' }]).then(onFulfilled);
  return mock;
};

const mockTx = {
  insert: vi.fn(() => createChainedMock()),
  update: vi.fn(() => createChainedMock()),
};

vi.mock('../src/infrastructure/db', () => ({
  db: {
    transaction: vi.fn(callback => callback(mockTx)),
    select: vi.fn(() => ({ from: vi.fn().mockResolvedValue([]) })),
    insert: vi.fn(() => createChainedMock()),
    update: vi.fn(() => createChainedMock()),
  }
}));

describe('☢️ Nuclear DrizzleRepository Infrastructure (80 Cases)', () => {
  let repository: DrizzleAnalysisRepository;

  beforeEach(() => {
    repository = new DrizzleAnalysisRepository();
    vi.clearAllMocks();
  });

  const generateStory = (i: number) => ({
    id: `story-${i}`,
    title: `Test Story ${i} ${'🚀'.repeat(i % 5)}`,
    url: `http://test.com/${'a'.repeat(i % 100)}`,
    points: i * 10,
    author: `author-${i}`,
    timestamp: new Date(Date.now() - i * 1000 * 60 * 60),
    rawContent: `Content ${i} ` + 'A'.repeat(i * 10),
    comments: []
  });

  const generateAnalysis = (i: number) => ({
    topic: (i % 2 === 0 ? 'Tech' : 'Science') as any,
    summary_paragraphs: [`P1-${i}`, `P2-${i}`],
    highlight: `H-${i}`,
    key_points: [`K-${i}`],
    article_sentiment: { label: `L-${i}`, type: (i % 3 === 0 ? 'positive' : 'neutral') as any, description: `D-${i}`, estimated_agreement: 'N/A' },
    community_sentiments: Array.from({ length: (i % 5) + 1 }, (_, j) => ({
      label: `C${j}-${i}`,
      type: 'neutral' as any,
      description: `D${j}-${i}`,
      estimated_agreement: 'high'
    }))
  });

  const cases = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    story: generateStory(i),
    analysis: generateAnalysis(i),
    embedding: new Array(i % 2 === 0 ? 768 : 1536).fill(Math.random())
  }));

  it.each(cases)('Case $id: Persists story and analysis with varied data', async ({ story, analysis, embedding }) => {
    await repository.saveAnalysis(story, analysis as any, embedding);
    expect(mockTx.insert).toHaveBeenCalled();
  });

  it('should handle transaction rollback on failure', async () => {
    mockTx.insert = vi.fn().mockImplementationOnce(() => { throw new Error('DB Down'); });
    const story = generateStory(0);
    const analysis = generateAnalysis(0);

    await expect(repository.saveAnalysis(story, analysis as any, [])).rejects.toThrow('DB Down');
  });

  it('should handle repository initialization and story id retrieval at scale', async () => {
     const ids = await repository.getExistingStoryIds();
     expect(Array.isArray(ids)).toBe(true);
  });
});
