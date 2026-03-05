import { ScrapedStory, CommentDTO } from './scraper';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';
import { config } from '../config';

export const SentimentClusterSchema = z.object({
  label: z.string(),
  type: z.enum(['positive', 'negative', 'mixed', 'neutral', 'debate', 'analytical', 'skeptical', 'critical', 'informative']),
  description: z.string(),
  estimated_agreement: z.string()
});

export const AnalysisDTOSchema = z.object({
  topic: z.preprocess((val) => {
    const validTopics = ['AI Fundamentals', 'AI Applications', 'Tech', 'Politics', 'Others'];
    if (typeof val === 'string' && validTopics.includes(val)) return val;
    return 'Others';
  }, z.enum(['AI Fundamentals', 'AI Applications', 'Tech', 'Politics', 'Others'])),
  summary_paragraphs: z.array(z.string()).min(2),
  highlight: z.string(),
  key_points: z.array(z.string()),
  article_sentiment: SentimentClusterSchema,
  community_sentiments: z.array(SentimentClusterSchema).min(3).max(4)
});

export type AnalysisDTO = z.infer<typeof AnalysisDTOSchema>;

export async function extractArguments(comments: CommentDTO[]): Promise<string> {
  if (config.env.MOCK_LLM) return "[MOCK SIGNAL] Key technical concerns.";

  const commentText = comments.map(c => `[${c.author}]: ${c.text}`).join('\n\n');

  if (config.env.TRANSPARENT_MAP) {
    logger.info('[Inference] Using Transparent Map (returning original text)');
    return commentText.substring(0, 30000);
  }

  const provider = config.env.MAP_LLM_PROVIDER;
  const prompt = `
    Extract the core technical arguments and community sentiments from this batch of Hacker News comments.
    Focus on engineering trade-offs, architecture, and developer sentiment.
    Keep it concise.

    COMMENTS:
    ${commentText.substring(0, 30000)}
  `;

  if (provider === 'deepseek') {
    const apiKey = config.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.');
    const openai = new OpenAI({ baseURL: config.ai.deepseekBaseUrl, apiKey });

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a senior systems engineer. Extract technical signals from comments." },
          { role: "user", content: prompt }
        ],
        model: config.ai.deepseekModel,
      });
      return completion.choices[0].message.content?.trim() || '[Extraction Failed]';
    } catch (err: any) {
      logger.warn({ error: err.message }, '[Inference] DeepSeek-Chat Map failed, falling back to Gemini');
    }
  }

  const apiKey = config.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: config.ai.geminiModel });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err: any) {
    logger.error({ error: err.message }, '[Inference] Gemini Map fallback failed');
    throw err;
  }
}

export async function generateAnalysis(story: ScrapedStory, combinedSignals?: string): Promise<AnalysisDTO> {
  if (config.env.MOCK_LLM) {
    return {
      topic: 'Tech',
      summary_paragraphs: ["[MOCK SUMMARY] P1", "Mock P2"],
      highlight: 'Mock highlight',
      key_points: ['Point 1'],
      article_sentiment: { label: 'Tone', type: 'positive', description: 'Good', estimated_agreement: 'N/A' },
      community_sentiments: [
        { label: 'P1', type: 'positive', description: 'D1', estimated_agreement: 'high' },
        { label: 'P2', type: 'positive', description: 'D2', estimated_agreement: 'high' },
        { label: 'P3', type: 'positive', description: 'D3', estimated_agreement: 'high' }
      ]
    };
  }

  const apiKey = config.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.');

  const openai = new OpenAI({ baseURL: config.ai.deepseekBaseUrl, apiKey });

  logger.info({ storyId: story.id, title: story.title }, '[Inference] DeepSeek synthesis started');

  const systemMessage = `
    You are a Staff Engineer writing a daily tech briefing.
    Analyze the provided article content and community signals to provide a structured JSON response.

    CRITICAL SCHEMA RULES:
    1. Every sentiment must be a full OBJECT, not a string.
    2. "summary_paragraphs" MUST be an array of at least 2 strings.
    3. "community_sentiments" MUST be an array of 3 to 4 objects.
    4. "type" MUST be one of: "positive", "negative", "mixed", "neutral", "debate", "analytical", "skeptical", "critical", "informative".

    EXAMPLE STRUCTURE:
    {
      "topic": "AI Fundamentals",
      "summary_paragraphs": ["A deep dive into transformer architecture...", "Implications for scaling laws..."],
      "highlight": "The breakthrough in attention mechanism is pivotal.",
      "key_points": ["Memory efficiency improved by 40%", "Latency reduced for long contexts"],
      "article_sentiment": { "label": "Technical Optimism", "type": "positive", "description": "The article highlights significant engineering gains.", "estimated_agreement": "N/A" },
      "community_sentiments": [
        { "label": "Deployment Skepticism", "type": "negative", "description": "Users worry about VRAM requirements.", "estimated_agreement": "High" },
        { "label": "Performance Praise", "type": "positive", "description": "Early benchmarks are impressive.", "estimated_agreement": "Medium" },
        { "label": "Open Source Debate", "type": "debate", "description": "Discussion on weights accessibility.", "estimated_agreement": "Low" }
      ]
    }
  `;

  const userMessage = `
    TITLE: ${story.title}
    URL: ${story.url}
    ARTICLE CONTENT:
    ${story.rawContent.substring(0, config.scraper.maxContentLength)}

    COMMUNITY SIGNALS (FROM HN COMMENTS):
    ${combinedSignals || "No comments available."}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      model: config.ai.deepseekModel,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content?.trim() || '{}';

    // Robust extraction: find content between ```json and ``` or take the whole string
    let jsonToParse = responseText;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonToParse = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonrepair(jsonToParse));
    return AnalysisDTOSchema.parse(parsed);
  } catch (err: any) {
    logger.error({ storyId: story.id, error: err.message }, '[Inference] DeepSeek synthesis failed');
    throw err;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (config.env.MOCK_LLM) return Array(768).fill(0.1);
  const provider = config.env.EMBEDDING_PROVIDER;

  if (provider === 'together') {
    const apiKey = config.env.TOGETHER_API_KEY;
    if (!apiKey) throw new Error('TOGETHER_API_KEY is missing');
    const together = new OpenAI({ apiKey, baseURL: config.ai.togetherBaseUrl });
    try {
      const response = await together.embeddings.create({
        model: config.ai.togetherEmbeddingModel,
        input: text,
      });
      return response.data[0].embedding;
    } catch (err: any) {
      logger.error({ error: err.message }, '[Inference] Together AI embedding failed');
      throw err;
    }
  }

  const apiKey = config.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set for embeddings.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: config.ai.embeddingModel }, { apiVersion: 'v1beta' });
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err: any) {
    logger.error({ error: err.message }, '[Inference] Gemini embedding failed');
    throw err;
  }
}
