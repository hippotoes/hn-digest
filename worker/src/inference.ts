import { ScrapedStory, CommentDTO } from './scraper';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
  article_sentiment: SentimentClusterSchema, // Single sentiment for the article
  community_sentiments: z.array(SentimentClusterSchema).min(3).max(4) // 3-4 clusters for comments
});

export type AnalysisDTO = z.infer<typeof AnalysisDTOSchema>;

export async function extractArguments(comments: CommentDTO[]): Promise<string> {
  if (process.env.MOCK_LLM === 'true') return "[MOCK SIGNAL] Key technical concerns about memory safety and performance.";

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const commentText = comments.map(c => `[${c.author}]: ${c.text}`).join('\n\n');
  const prompt = `
    Extract the core technical arguments and community sentiments from this batch of Hacker News comments.
    Focus on engineering trade-offs, architecture, and developer sentiment.
    Keep it concise.

    COMMENTS:
    ${commentText.substring(0, 30000)}
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err: any) {
    return "[Extraction Failed]";
  }
}

export async function generateAnalysis(story: ScrapedStory, combinedSignals?: string): Promise<AnalysisDTO> {
  if (process.env.MOCK_LLM === 'true') {
    return {
      topic: 'Tech',
      summary_paragraphs: [
        `[MOCK SUMMARY 1] This is the first paragraph for ${story.title}. It discusses deep technical details.`,
        `[MOCK SUMMARY 2] This is the second paragraph. It explains architectural significance.`
      ],
      highlight: 'A great highlight here.',
      key_points: ['Point 1', 'Point 2'],
      article_sentiment: { label: 'Article Tone', type: 'positive', description: 'Technical and optimistic.', estimated_agreement: 'N/A' },
      community_sentiments: [
        { label: 'Positive', type: 'positive', description: 'People liked it.', estimated_agreement: 'high' },
        { label: 'Negative', type: 'negative', description: 'Some disliked it.', estimated_agreement: 'low' },
        { label: 'Debate', type: 'debate', description: 'Arguments about X.', estimated_agreement: 'medium' }
      ]
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set.');

  const openai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });

  const systemMessage = `
    You are a Staff Engineer writing a daily tech briefing.
    Analyze the provided article content and community signals (from HN comments) to provide a structured JSON response.

    You MUST return ONLY valid JSON matching this schema:
    {
      "topic": "AI Fundamentals|AI Applications|Tech|Politics|Others",
      "summary_paragraphs": ["paragraph 1 (~150 words)", "paragraph 2 (~150 words)"],
      "highlight": "memorable stat or quote",
      "key_points": ["point 1", "point 2"],
      "article_sentiment": {
        "label": "2-4 word label for the article tone",
        "type": "positive|negative|mixed|neutral|debate",
        "description": "~100 words analyzing the author's tone and stance",
        "estimated_agreement": "N/A"
      },
      "community_sentiments": [
        {
          "label": "2-4 word label",
          "type": "positive|negative|mixed|neutral|debate",
          "description": "~100 words detailed analysis of this cohort's opinion",
          "estimated_agreement": "rough count of users in this cohort"
        }
      ] // EXACTLY 3-4 items based on the community signals
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

  let responseText = '';
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      model: "deepseek-reasoner",
      response_format: { type: 'json_object' }
    });

    responseText = completion.choices[0].message.content?.trim() || '{}';
    const repairedJson = jsonrepair(responseText);
    const parsed = JSON.parse(repairedJson);
    return AnalysisDTOSchema.parse(parsed);
  } catch (err: any) {
    console.warn(`[Inference] Validation failed for ${story.id}, attempting repair...`, err.message);
    // ... repair logic remains similar, updating to new schema ...
    const result = await openai.chat.completions.create({
      messages: [{ role: "system", content: systemMessage }, { role: "user", content: `Fix this JSON schema: ${responseText}. Error: ${err.message}` }],
      model: "deepseek-reasoner",
      response_format: { type: 'json_object' }
    });
    const parsed = JSON.parse(jsonrepair(result.choices[0].message.content || '{}'));
    return AnalysisDTOSchema.parse(parsed);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (process.env.MOCK_LLM === 'true') return Array(3072).fill(0.1);
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set for embeddings.');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" }, { apiVersion: 'v1beta' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
