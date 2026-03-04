import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAnalysis, extractArguments } from '../../src/infrastructure/LLMIntelligence';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * PHASE 2: Intelligence Engine Functional Tests
 * Focus: Provider Fallbacks, Self-Healing JSON, Resilience.
 */

// Mock the SDKs
const mockDeepSeekCreate = vi.fn();
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mockDeepSeekCreate } };
  }
}));

const mockGeminiGenerate = vi.fn();
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGeminiGenerate };
    }
  }
}));

describe('Functional: Intelligence Engine (Phase 2)', () => {
  const dummyStory = {
    id: '1', title: 'T', url: 'http://t.com', points: 1, author: 'a', timestamp: new Date(), rawContent: 'C'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOCK_LLM = 'false';
    process.env.DEEPSEEK_API_KEY = 'ds-key';
    process.env.GEMINI_API_KEY = 'g-key';
  });

  describe('Scenario 2.1: The Fallback Cascade (DeepSeek -> Gemini)', () => {
    it('should fallback to Gemini when DeepSeek fails with rate limit', async () => {
      mockDeepSeekCreate.mockRejectedValueOnce(new Error('Rate Limit Exceeded'));
      mockGeminiGenerate.mockResolvedValueOnce({
        response: { text: () => 'Signal from Gemini' }
      });
      const result = await extractArguments([]);
      expect(result).toBe('Signal from Gemini');
    });

    it('should throw error when BOTH providers fail', async () => {
      mockDeepSeekCreate.mockRejectedValueOnce(new Error('DeepSeek Outage'));
      mockGeminiGenerate.mockRejectedValueOnce(new Error('Gemini Outage'));
      await expect(extractArguments([])).rejects.toThrow('Gemini Outage');
    });
  });

  describe('Scenario 2.2: Extreme JSON Repair', () => {
    it('should handle LLM response wrapped in multiple markdown blocks', async () => {
      mockDeepSeekCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: "Thought: analysis below\n```json\n{\n\"topic\": \"Tech\",\n\"summary_paragraphs\": [\"P1\", \"P2\"],\n\"highlight\": \"H\",\n\"key_points\": [\"K\"],\n\"article_sentiment\": { \"label\": \"L\", \"type\": \"neutral\", \"description\": \"D\", \"estimated_agreement\": \"N/A\" },\n\"community_sentiments\": [\n{ \"label\": \"C1\", \"type\": \"neutral\", \"description\": \"D1\", \"estimated_agreement\": \"H\" },\n{ \"label\": \"C2\", \"type\": \"neutral\", \"description\": \"D2\", \"estimated_agreement\": \"H\" },\n{ \"label\": \"C3\", \"type\": \"neutral\", \"description\": \"D3\", \"estimated_agreement\": \"H\" }\n]\n}\n```"
          }
        }]
      });
      const result = await generateAnalysis(dummyStory);
      expect(result.topic).toBe('Tech');
    });

    it('should handle missing closing braces using jsonrepair', async () => {
      mockDeepSeekCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: "{\"topic\": \"AI Fundamentals\", \"summary_paragraphs\": [\"P1\", \"P2\"], \"highlight\": \"H\", \"key_points\": [\"K\"], \"article_sentiment\": {\"label\":\"L\",\"type\":\"positive\",\"description\":\"D\",\"estimated_agreement\":\"N/A\"}, \"community_sentiments\": [{\"label\":\"C1\",\"type\":\"positive\",\"description\":\"D1\",\"estimated_agreement\":\"H\"},{\"label\":\"C2\",\"type\":\"positive\",\"description\":\"D2\",\"estimated_agreement\":\"H\"},{\"label\":\"C3\",\"type\":\"positive\",\"description\":\"D3\",\"estimated_agreement\":\"H\"}]" // Truncated
          }
        }]
      });
      const result = await generateAnalysis(dummyStory);
      expect(result.topic).toBe('AI Fundamentals');
    });
  });

  describe('Scenario 2.3: Topic Canonicalization Under Load', () => {
    it('should preprocess hallucinated topics into enum values', async () => {
      // LLM returns a topic NOT in our enum (assuming our enum is stable)
      mockDeepSeekCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              topic: "Wildly Hallucinated Topic Name",
              summary_paragraphs: ["P1", "P2"],
              highlight: "H",
              key_points: ["K"],
              article_sentiment: { label: "L", type: "neutral", description: "D", estimated_agreement: "N/A" },
              community_sentiments: [
                { label: "C1", type: "neutral", description: "D1", estimated_agreement: "H" },
                { label: "C2", type: "neutral", description: "D2", estimated_agreement: "H" },
                { label: "C3", type: "neutral", description: "D3", estimated_agreement: "H" }
              ]
            })
          }
        }]
      });

      const result = await generateAnalysis(dummyStory);

      // Verified: Preprocess maps unknown to 'Others'
      expect(result.topic).toBe('Others');
    });
  });
});
