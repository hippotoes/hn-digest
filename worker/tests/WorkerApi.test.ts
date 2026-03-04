import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub environment BEFORE any imports
vi.stubEnv('GEMINI_API_KEY', 'test_key');
vi.stubEnv('MOCK_LLM', 'true');

// Mock DB - More robust chaining
const mockDrizzle = {
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock('../src/infrastructure/db', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ count: 0 }]),
    select: vi.fn(() => mockDrizzle)
  }
}));

// Mock GenAI - Crucial for app.request
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() {}
    getGenerativeModel() {
      return {
        embedContent: vi.fn().mockResolvedValue({ embedding: { values: new Array(768).fill(0.1) } })
      };
    }
  }
}));

import { app } from '../src/infrastructure/api-server';

describe('Worker Hono API Surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health & Ping', () => {
    it.each([
      ['/health/live', 200],
      ['/health/ready', 200],
      ['/api/v1/ping', 200]
    ])('endpoint %s should return %i', async (path, status) => {
      const res = await app.request(path);
      expect(res.status).toBe(status);
    });

    it('should return 503 if DB is down on readiness check', async () => {
       const { db } = await import('../src/infrastructure/db');
       vi.mocked(db.execute).mockRejectedValueOnce(new Error('Down'));
       const res = await app.request('/health/ready');
       expect(res.status).toBe(503);
    });
  });

  describe('Search API Parametric Validation', () => {
    const searchScenarios = [
      { q: '', expectedStatus: 400, name: 'Empty query' },
      { q: 'a'.repeat(100), expectedStatus: 200, name: 'Normal query' },
      { q: "'; DROP TABLE users; --", expectedStatus: 200, name: 'SQL Injection attempt' },
      { q: '<script>alert(1)</script>', expectedStatus: 200, name: 'XSS attempt' },
    ];

    it.each(searchScenarios)('search with $name should return $expectedStatus', async ({ q, expectedStatus }) => {
       const res = await app.request(`/api/v1/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
       expect(res.status).toBe(expectedStatus);
    });
  });

  describe('Search API Resilience & AI Integration', () => {
    it('should use Gemini for embeddings if MOCK_LLM is false', async () => {
      vi.stubEnv('MOCK_LLM', 'false');
      vi.stubEnv('GEMINI_API_KEY', 'real_key');
      const res = await app.request('/api/v1/search?q=test');
      expect(res.status).toBe(200);
      vi.stubEnv('MOCK_LLM', 'true'); // reset
    });

    it('should throw 500 if GEMINI_API_KEY is missing when MOCK_LLM is false', async () => {
      vi.stubEnv('MOCK_LLM', 'false');
      vi.stubEnv('GEMINI_API_KEY', '');
      const res = await app.request('/api/v1/search?q=test');
      expect(res.status).toBe(500);
      vi.stubEnv('MOCK_LLM', 'true'); // reset
      vi.stubEnv('GEMINI_API_KEY', 'test_key'); // reset
    });

    it('should return 500 on database failure during search', async () => {
      const { db } = await import('../src/infrastructure/db');
      vi.mocked(db.select).mockImplementationOnce(() => { throw new Error('DB Search Fail'); });
      const res = await app.request('/api/v1/search?q=rust');
      expect(res.status).toBe(500);
    });
  });

  describe('Digest API Resilience', () => {
    it('should return 500 on database failure', async () => {
      const { db } = await import('../src/infrastructure/db');
      vi.mocked(db.select).mockImplementationOnce(() => { throw new Error('DB Fail'); });
      const res = await app.request('/api/v1/digests/daily/latest');
      expect(res.status).toBe(500);
    });

    it('should return 200 even with empty data', async () => {
      const res = await app.request('/api/v1/digests/daily/latest');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toBeDefined();
    });
  });
});
