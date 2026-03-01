import { describe, it, expect, vi } from 'vitest';

// We mock the DB layer so we can unit test the Hono route in isolation.
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([
                {
                  id: '67890',
                  title: 'Search Result HN Story',
                  url: 'https://example.com/search',
                  points: 99,
                  summary: 'A summary about rust memory safety.',
                  similarity: 0.9,
                }
              ])
            }))
          }))
        }))
      }))
    }))
  }
}));

// Mock generative-ai
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel() {
        return {
          embedContent: vi.fn().mockResolvedValue({
            embedding: { values: [0.1, 0.2, 0.3] }
          })
        };
      }
    }
  };
});

// Import the app *after* the mock is defined
import { GET } from '../src/app/api/[[...route]]/route';

describe('GET /api/v1/search', () => {
  it('should return a 400 error if query parameter q is missing', async () => {
    const req = new Request('http://localhost:3000/api/v1/search', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('should return a list of search results when q is provided', async () => {
    // We set MOCK_LLM to avoid real API calls for embeddings
    process.env.MOCK_LLM = 'true';

    const req = new Request('http://localhost:3000/api/v1/search?q=rust', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data[0].title).toBe('Search Result HN Story');
    expect(data.data[0].similarity).toBe(0.9);
  });
});
