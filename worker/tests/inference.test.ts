import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set the API key BEFORE importing the module that uses it at the root level
vi.stubEnv('GEMINI_API_KEY', 'test_key');

import { generateSummary, ScrapedStory } from '../src/inference';

// Mock the Gemini SDK
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () => 'Mocked highly technical summary from Gemini API.',
  }
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent
        };
      }
    }
  };
});

describe('Inference Module', () => {
  const dummyStory: ScrapedStory = {
    id: '123',
    title: 'A New Tech Breakthrough',
    url: 'https://tech.com',
    points: 100,
    author: 'author',
    timestamp: new Date(),
    rawContent: 'A lot of technical boilerplate text here.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a mock summary if MOCK_LLM is true', async () => {
    process.env.MOCK_LLM = 'true';
    const summary = await generateSummary(dummyStory);
    expect(summary).toContain('[MOCK SUMMARY]');
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should call Gemini API if MOCK_LLM is false', async () => {
    process.env.MOCK_LLM = 'false';
    const summary = await generateSummary(dummyStory);
    expect(summary).toBe('Mocked highly technical summary from Gemini API.');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    // Ensure the prompt string included the title and content
    const promptArg = mockGenerateContent.mock.calls[0][0];
    expect(promptArg).toContain('A New Tech Breakthrough');
    expect(promptArg).toContain('A lot of technical boilerplate text here.');
  });
});
