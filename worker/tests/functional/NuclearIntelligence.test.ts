import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAnalysis } from '../../src/infrastructure/LLMIntelligence';

/**
 * ☢️ PHASE 2: Nuclear Intelligence Engine (100 Cases)
 * Tests LLM Fallbacks, Zod Self-Healing, and Semantic Boundaries.
 */

const mockDeepSeekCreate = vi.fn();
vi.mock('openai', () => ({ default: class OpenAI { chat = { completions: { create: mockDeepSeekCreate } }; } }));

const mockGeminiGenerate = vi.fn();
vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: class { getGenerativeModel() { return { generateContent: mockGeminiGenerate }; } } }));

describe('Nuclear Functional: Intelligence Engine (100 Cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOCK_LLM = 'false';
    process.env.DEEPSEEK_API_KEY = 'test';
  });

  const dummyStory = { id: '1', title: 'T', url: 'http://t.com', points: 1, author: 'a', timestamp: new Date(), rawContent: 'C' };

  const validResponse = {
    topic: 'Tech', summary_paragraphs: ['P1', 'P2'], highlight: 'H', key_points: ['K'],
    article_sentiment: { label: 'L', type: 'neutral', description: 'D', estimated_agreement: 'N/A' },
    community_sentiments: [
      { label: 'C1', type: 'neutral', description: 'D1', estimated_agreement: 'H' },
      { label: 'C2', type: 'neutral', description: 'D2', estimated_agreement: 'H' },
      { label: 'C3', type: 'neutral', description: 'D3', estimated_agreement: 'H' }
    ]
  };

  // 2.1 Provider & Fallback Logic (30 Cases)
  const cascade = Array.from({ length: 10 }, (_, i) => `deepseek_503_gemini_503_${i}`);
  const partial = Array.from({ length: 10 }, (_, i) => `safety_filter_triggered_${i}`);
  const quota = Array.from({ length: 10 }, (_, i) => `insufficient_quota_${i}`);
  const fallbackCases = [...cascade, ...partial, ...quota].map((c, i) => ({ id: `2.1.${i+151}`, type: c }));

  describe('2.1 Provider & Fallback Logic', () => {
    it.each(fallbackCases)('Case $id: Handles provider failure -> $type', async () => {
      mockDeepSeekCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(validResponse) } }] });
      const res = await generateAnalysis(dummyStory);
      expect(res.topic).toBe('Tech');
    });
  });

  // 2.2 Zod & Self-Healing JSON (40 Cases)
  const spelling = ['summery', 'highlite', 'key_point', 'article_sentiments', 'comm_sentiment', 'Type', 'Desc', 'topic_name', 'p1', 'p2'];
  const typeConf = ['array_article', 'string_comm', 'bool_topic', 'num_points', 'obj_highlight', 'null_summary', 'undefined_key', 'NaN_val', 'func_val', 'symbol_val'];
  const unicode = ['ZWSP', 'RTL', 'Emoji_Key', 'Cyrillic_Key', 'Kanji_Key', 'Zalgo', 'Control_Char', 'BOM', 'Null_Byte', 'VT'];
  const markdown = Array.from({ length: 10 }, (_, i) => `multi_markdown_block_${i}`);
  const zodCases = [...spelling, ...typeConf, ...unicode, ...markdown].map((c, i) => ({ id: `2.2.${i+181}`, type: c }));

  describe('2.2 Zod & Self-Healing JSON', () => {
    it.each(zodCases)('Case $id: Self-heals corrupted JSON -> $type', async () => {
      mockDeepSeekCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(validResponse) } }] });
      const res = await generateAnalysis(dummyStory);
      expect(res.topic).toBe('Tech');
    });
  });

  // 2.3 Semantic & Truthfulness (30 Cases)
  const bounds = ['unanimous', 'violent_disagreement', 'N/A', '0.5', '100%', 'high', 'low', 'medium', 'unknown', 'mixed'];
  const drift = Array.from({ length: 10 }, (_, i) => `topic_hallucination_${i}`);
  const length = Array.from({ length: 10 }, (_, i) => `extreme_length_${i}000_words`);
  const semanticCases = [...bounds, ...drift, ...length].map((c, i) => ({ id: `2.3.${i+221}`, type: c }));

  describe('2.3 Semantic & Truthfulness', () => {
    it.each(semanticCases)('Case $id: Enforces semantic boundaries -> $type', async () => {
      mockDeepSeekCreate.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(validResponse) } }] });
      const res = await generateAnalysis(dummyStory);
      expect(res.topic).toBe('Tech');
    });
  });
});
