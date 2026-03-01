import { ScrapedStory, CommentDTO } from './scraper';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';

export const SentimentClusterSchema = z.object({
  label: z.string(),
  type: z.enum(['positive', 'negative', 'mixed', 'neutral', 'debate']),
  description: z.string(),
  estimated_agreement: z.string()
});

export const AnalysisDTOSchema = z.object({
  topic: z.enum(['AI Fundamentals', 'AI Applications', 'Tech', 'Politics', 'Others']),
  summary_paragraphs: z.array(z.string()).min(2),
  highlight: z.string(),
  key_points: z.array(z.string()),
  article_sentiment: SentimentClusterSchema,
  community_sentiments: z.array(SentimentClusterSchema).min(3).max(4)
});

export type AnalysisDTO = z.infer<typeof AnalysisDTOSchema>;

export async function extractArguments(comments: CommentDTO[]): Promise<string> {
  if (process.env.MOCK_LLM === 'true') return "[MOCK SIGNAL] Key technical concerns.";

  const provider = process.env.MAP_LLM_PROVIDER || 'deepseek';
  const commentText = comments.map(c => `[${c.author}]: ${c.text}`).join('\n\n');

  const prompt = `
    Extract the core technical arguments and community sentiments from this batch of Hacker News comments.
    Focus on engineering trade-offs, architecture, and developer sentiment.
    Keep it concise.

    COMMENTS:
    ${commentText.substring(0, 30000)}
  `;

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.');
    const openai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a senior systems engineer. Extract technical signals from comments." },
          { role: "user", content: prompt }
        ],
        model: "deepseek-chat",
      });
      return completion.choices[0].message.content?.trim() || '[Extraction Failed]';
    } catch (err: any) {
      logger.warn({ error: err.message }, '[Inference] DeepSeek-Chat Map failed, falling back to Gemini');
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err: any) {
    logger.error({ error: err.message }, '[Inference] Gemini Map fallback failed');
    throw err;
  }
}

export async function generateAnalysis(story: ScrapedStory, combinedSignals?: string): Promise<AnalysisDTO> {
  if (process.env.MOCK_LLM === 'true') {
    return {
      topic: 'Tech',
      summary_paragraphs: ["Mock P1", "Mock P2"],
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

  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.');

  const openai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });

  logger.info({ storyId: story.id, title: story.title }, '[Inference] DeepSeek synthesis started');

  const systemMessage = `
    You are a Staff Engineer writing a daily tech briefing.
    Analyze the provided article content and community signals to provide a structured JSON response.

    CRITICAL SCHEMA RULE:
    Every sentiment must be a full OBJECT, not a string.

    EXAMPLE STRUCTURE:
    {
      "topic": "AI Fundamentals",
      "summary_paragraphs": ["...", "..."],
      "highlight": "...",
      "key_points": ["..."],
      "article_sentiment": { "label": "...", "type": "positive", "description": "...", "estimated_agreement": "N/A" },
      "community_sentiments": [
        { "label": "...", "type": "negative", "description": "...", "estimated_agreement": "..." },
        ... 3 more
      ]
    }
  `;

  const userMessage = `
    TITLE: ${story.title}
    URL: ${story.url}
    ARTICLE CONTENT:
    ${story.rawContent.substring(0, 15000)}

    COMMUNITY SIGNALS (FROM HN COMMENTS):
    ${combinedSignals || "No comments available."}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      model: "deepseek-reasoner",
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content?.trim() || '{}';
    const parsed = JSON.parse(jsonrepair(responseText));
    return AnalysisDTOSchema.parse(parsed);
  } catch (err: any) {
    logger.error({ storyId: story.id, error: err.message }, '[Inference] DeepSeek synthesis failed');
    throw err;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (process.env.MOCK_LLM === 'true') return Array(3072).fill(0.1);
  const provider = process.env.EMBEDDING_PROVIDER || 'gemini';

  if (provider === 'together') {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) throw new Error('TOGETHER_API_KEY is missing');
    const together = new OpenAI({ apiKey, baseURL: 'https://api.together.xyz/v1' });
    try {
      const response = await together.embeddings.create({
        model: "togethercomputer/m2-bert-80M-32k-retrieval",
        input: text,
      });
      return response.data[0].embedding;
    } catch (err: any) {
      logger.error({ error: err.message }, '[Inference] Together AI embedding failed');
      throw err;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set for embeddings.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" }, { apiVersion: 'v1beta' });
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err: any) {
    logger.error({ error: err.message }, '[Inference] Gemini embedding failed');
    throw err;
  }
}
