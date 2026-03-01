import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

// We mock the DB layer so we can unit test the Hono route in isolation.
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: '12345',
              title: 'Mock HN Story',
              url: 'https://example.com',
              points: 42,
              author: 'mockuser',
              summary: 'A highly technical summary.',
              topic: 'Tech',
            }
          ])
        }))
      }))
    }))
  }
}));

// Import the app *after* the mock is defined
import { GET } from '../src/app/api/[[...route]]/route';

describe('GET /api/v1/digests/daily/latest', () => {
  it('should return a list of parsed stories as JSON', async () => {
    // Create a mock Request matching Next.js App Router expectations
    const req = new Request('http://localhost:3000/api/v1/digests/daily/latest', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(1);
    expect(data.data[0].title).toBe('Mock HN Story');
    expect(data.data[0].summary).toContain('technical');
  });
});
