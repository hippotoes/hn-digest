import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubEnv('GEMINI_API_KEY', 'test_key');
vi.stubEnv('DEEPSEEK_API_KEY', 'test_key');
vi.stubEnv('TOGETHER_API_KEY', 'test_key');

const validAnalysisPayload = {
  topic: 'Tech',
  summary_paragraphs: ['P1', 'P2'],
  highlight: 'H',
  key_points: ['K'],
  article_sentiment: { label: 'T', type: 'positive', description: 'G', estimated_agreement: 'N/A' },
  community_sentiments: [
    { label: 'P1', type: 'positive', description: 'G1', estimated_agreement: 'high' },
    { label: 'P2', type: 'negative', description: 'G2', estimated_agreement: 'low' },
    { label: 'P3', type: 'neutral', description: 'G3', estimated_agreement: 'medium' }
  ]
};

const mockCreateCompletion = vi.fn();
const mockCreateEmbedding = vi.fn();
const mockEmbedContent = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreateCompletion } };
    embeddings = { create: mockCreateEmbedding };
  }
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor() {}
    getGenerativeModel() {
      return { embedContent: mockEmbedContent, generateContent: mockGenerateContent };
    }
  }
}));

import { generateAnalysis, ScrapedStory, generateEmbedding, extractArguments } from '../src/infrastructure/LLMIntelligence';

describe('☢️ Nuclear Inference Intelligence (220 Cases)', () => {
  const dummyStory: ScrapedStory = {
    id: '123',
    title: 'Title',
    url: 'http://t',
    points: 100,
    author: 'a',
    timestamp: new Date(),
    rawContent: 'Content',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MOCK_LLM = 'false';

    // Set robust defaults
    mockCreateCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validAnalysisPayload) } }]
    });
    mockCreateEmbedding.mockResolvedValue({
      data: [{ embedding: new Array(1536).fill(0.5) }]
    });
    mockEmbedContent.mockResolvedValue({
      embedding: { values: new Array(768).fill(0.1) }
    });
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'Mocked Gemini Response' }
    });
  });

  // 1. Ingestion/Extraction Matrix (60 cases)
  const mapProviders = ['deepseek', 'gemini'];
  const mapScenarios = mapProviders.flatMap(p => [
    { provider: p, success: true },
    { provider: p, success: false }
  ]);

  it.each(Array.from({ length: 60 }, (_, i) => ({
    id: i,
    ...mapScenarios[i % mapScenarios.length]
  })))('Case 1.$id: Map Extraction Matrix ($provider, Success: $success)', async ({ provider, success }) => {
    process.env.MAP_LLM_PROVIDER = provider;

    if (!success) {
      if (provider === 'gemini') {
        mockGenerateContent.mockRejectedValue(new Error('Fail'));
        await expect(extractArguments([])).rejects.toThrow();
      } else {
        mockCreateCompletion.mockRejectedValue(new Error('DS Fail'));
        mockGenerateContent.mockRejectedValue(new Error('GM Fail'));
        await expect(extractArguments([])).rejects.toThrow();
      }
    } else {
      const res = await extractArguments([]);
      expect(res).toBeDefined();
    }
  });

  // 2. LLM Payload Stress (60 cases)
  const payloadScenarios = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    contentLength: i * 500,
    hasUnicode: i % 2 === 0,
    hasMarkdown: i % 3 === 0
  }));

  it.each(payloadScenarios)('Case 2.$id: Synthesis Payload Stress (Len: $contentLength)', async ({ contentLength, hasUnicode, hasMarkdown }) => {
    const story = { ...dummyStory, rawContent: 'A'.repeat(contentLength) + (hasUnicode ? '🚀☢️' : '') + (hasMarkdown ? '## Header' : '') };
    const res = await generateAnalysis(story);
    expect(res.topic).toBeDefined();
    expect(mockCreateCompletion).toHaveBeenCalled();
  });

  // 3. JSON Self-Healing Stress (60 cases)
  const brokenJsonScenarios = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    type: i % 4 === 0 ? 'single_quotes' : (i % 4 === 1 ? 'trailing_comma' : (i % 4 === 2 ? 'markdown_wrapped' : 'extra_whitespace'))
  }));

  it.each(brokenJsonScenarios)('Case 3.$id: JSON Self-Healing ($type)', async ({ type }) => {
    const validJson = JSON.stringify(validAnalysisPayload);

    let broken: string;
    switch(type) {
      case 'single_quotes': broken = validJson.replace(/"/g, "'"); break;
      case 'trailing_comma': broken = validJson.replace(']}', '],}'); break;
      case 'markdown_wrapped': broken = '```json\n' + validJson + '\n```'; break;
      case 'extra_whitespace': broken = '  \n  ' + validJson + '  \t  '; break;
      default: broken = validJson;
    }

    mockCreateCompletion.mockResolvedValue({ choices: [{ message: { content: broken } }] });
    const res = await generateAnalysis(dummyStory);
    expect(res.topic).toBe('Tech');
  });

  // 4. Embedding Matrix (40 cases)
  const embProviders = ['gemini', 'together'];
  const embScenarios = embProviders.flatMap(p => [
    { provider: p, success: true },
    { provider: p, success: false }
  ]);

  it.each(Array.from({ length: 40 }, (_, i) => ({
    id: i,
    ...embScenarios[i % embScenarios.length]
  })))('Case 4.$id: Embedding Matrix ($provider, Success: $success)', async ({ provider, success }) => {
    process.env.EMBEDDING_PROVIDER = provider;

    if (!success) {
      mockEmbedContent.mockRejectedValue(new Error('Fail'));
      mockCreateEmbedding.mockRejectedValue(new Error('Fail'));
      await expect(generateEmbedding('test')).rejects.toThrow();
    } else {
      const res = await generateEmbedding('test');
      expect(res.length).toBeGreaterThan(0);
    }
  });
});
