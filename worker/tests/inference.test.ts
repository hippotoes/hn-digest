import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set the API keys BEFORE importing the module that uses it at the root level
vi.stubEnv('GEMINI_API_KEY', 'test_key');
vi.stubEnv('DEEPSEEK_API_KEY', 'test_key');

import { generateAnalysis, ScrapedStory, generateEmbedding } from '../src/inference';

// Mock OpenAI
const mockCreateCompletion = vi.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          topic: 'Tech',
          summary_paragraphs: ['Mocked highly technical summary from DeepSeek API.', 'Paragraph 2'],
          highlight: 'A great highlight.',
          key_points: ['Point 1', 'Point 2'],
          sentiments: [
            { label: 'Positive', type: 'positive', description: 'Good.', estimated_agreement: '10' },
            { label: 'Negative', type: 'negative', description: 'Bad.', estimated_agreement: '5' },
            { label: 'Debate', type: 'debate', description: 'Hmm.', estimated_agreement: '15' },
            { label: 'Neutral', type: 'neutral', description: 'Okay.', estimated_agreement: '20' }
          ]
        })
      }
    }
  ]
});

vi.mock('openai', () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: mockCreateCompletion
        }
      }
    }
  };
});

// Mock the Gemini SDK for embeddings
const mockEmbedContent = vi.fn().mockResolvedValue({
  embedding: {
    values: [0.1, 0.2, 0.3]
  }
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor() {}
      getGenerativeModel() {
        return {
          embedContent: mockEmbedContent
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
    const analysis = await generateAnalysis(dummyStory);
    expect(analysis.summary_paragraphs[0]).toContain('[MOCK SUMMARY');
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it('should call DeepSeek API if MOCK_LLM is false', async () => {
    process.env.MOCK_LLM = 'false';
    const analysis = await generateAnalysis(dummyStory);
    expect(analysis.summary_paragraphs[0]).toBe('Mocked highly technical summary from DeepSeek API.');
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);

    // Ensure the prompt string included the title and content
    const systemArg = mockCreateCompletion.mock.calls[0][0].messages[0].content;
    const userArg = mockCreateCompletion.mock.calls[0][0].messages[1].content;

    expect(userArg).toContain('A New Tech Breakthrough');
    expect(userArg).toContain('A lot of technical boilerplate text here.');
  });

  it('should mock embedding if MOCK_LLM is true', async () => {
    process.env.MOCK_LLM = 'true';
    const emb = await generateEmbedding('test text');
    expect(emb.length).toBe(768);
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it('should call Gemini API for embeddings if MOCK_LLM is false', async () => {
    process.env.MOCK_LLM = 'false';
    const emb = await generateEmbedding('test text');
    expect(emb).toEqual([0.1, 0.2, 0.3]);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
  });
});
