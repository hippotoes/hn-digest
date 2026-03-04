import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDrizzle } = vi.hoisted(() => ({
  mockDrizzle: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/db', () => ({ db: mockDrizzle }));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() {}
    getGenerativeModel() {
      return {
        embedContent: vi.fn().mockResolvedValue({
          embedding: { values: new Array(768).fill(0.1) }
        })
      };
    }
  }
}));

import { app } from '../../src/app/api/[[...route]]/route';

describe('☢️ Nuclear Vector Search Functional (80 Cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOCK_LLM = 'false';
    process.env.GEMINI_API_KEY = 'test-key';
  });

  // 1. Similarity & Count Matrix (40 cases)
  const scenarios = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    count: i % 11, // 0 to 10
    baseSimilarity: 1.0 - (i * 0.02)
  }));

  it.each(scenarios)('Case 1.$id: Handles $count results with $baseSimilarity base similarity', async ({ count, baseSimilarity }) => {
    mockDrizzle.limit.mockResolvedValueOnce(Array.from({ length: count }, (_, j) => ({
      id: `story-${j}`,
      title: `Story ${j}`,
      similarity: baseSimilarity - (j * 0.01)
    })));

    const res = await app.request('/api/v1/search?q=stress-test');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveLength(count);
  });

  // 2. Hostile Query Stress (40 cases)
  const hostileQueries = [
    ' ', 'null', 'undefined', 'NaN', '0', '1',
    ...Array.from({ length: 34 }, (_, i) => `Query ${i} ${String.fromCharCode(i + 33)} 🚀☢️`)
  ];

  it.each(hostileQueries.map((q, i) => ({ id: i, q })))('Case 2.$id: Hostile Query Resilience [$q]', async ({ q }) => {
    mockDrizzle.limit.mockResolvedValueOnce([]);
    const res = await app.request(`/api/v1/search?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
  });
});
