import { ScrapedStory } from './scraper';
import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Keep for embeddings if DeepSeek doesn't do vectors well

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
  sentiments: z.array(SentimentClusterSchema).min(1).max(6)
});

export type AnalysisDTO = z.infer<typeof AnalysisDTOSchema>;

export async function generateAnalysis(story: ScrapedStory): Promise<AnalysisDTO> {
  if (process.env.MOCK_LLM === 'true') {
    return {
      topic: 'Tech',
      summary_paragraphs: [
        `[MOCK SUMMARY 1] This is the first paragraph for ${story.title}. It discusses deep technical details.`,
        `[MOCK SUMMARY 2] This is the second paragraph. It explains architectural significance.`
      ],
      highlight: 'A great highlight here.',
      key_points: ['Point 1', 'Point 2'],
      sentiments: [
        { label: 'Positive', type: 'positive', description: 'People liked it.', estimated_agreement: 'high' },
        { label: 'Negative', type: 'negative', description: 'Some disliked it.', estimated_agreement: 'low' },
        { label: 'Debate', type: 'debate', description: 'Arguments about X.', estimated_agreement: 'medium' },
        { label: 'Neutral', type: 'neutral', description: 'Just facts.', estimated_agreement: 'unknown' }
      ]
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not set.');
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: apiKey
  });

  console.log(`[Inference] Summarizing with DeepSeek: ${story.title}`);

  const systemMessage = `
    You are a Staff Engineer writing a daily tech briefing.
    Analyze the following article and provide a structured JSON response.
    You MUST return ONLY valid JSON matching this schema, with no markdown formatting:
    {
      "topic": "AI Fundamentals|AI Applications|Tech|Politics|Others",
      "summary_paragraphs": ["paragraph 1 (~150 words)", "paragraph 2 (~150 words)"],
      "highlight": "memorable stat or quote",
      "key_points": ["point 1", "point 2"],
      "sentiments": [
        {
          "label": "2-4 word label",
          "type": "positive|negative|mixed|neutral|debate",
          "description": "~100 words detailed analysis",
          "estimated_agreement": "e.g., '75 users' or 'major cohort'"
        }
      ]
    }
  `;

  const userMessage = `
    TITLE: ${story.title}
    URL: ${story.url}
    CONTENT:
    ${story.rawContent.substring(0, 15000)}
  `;

  let responseText = '';
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      model: "deepseek-reasoner",
      response_format: { type: 'json_object' } // Enforce JSON
    });

    responseText = completion.choices[0].message.content?.trim() || '{}';
    if (responseText.startsWith('\`\`\`json')) {
      responseText = responseText.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    }
    const repairedJson = jsonrepair(responseText);
    const parsed = JSON.parse(repairedJson);
    return AnalysisDTOSchema.parse(parsed);
  } catch (err: any) {
    console.warn(`[Inference] Validation failed for ${story.id}, attempting repair...`, err.message);
    try {
      const repairPrompt = `
        Your previous JSON response was malformed or didn't match the schema.
        Fix it. ONLY return valid JSON.

        Error: ${err.message}

        Original Response:
        ${responseText}
      `;
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: repairPrompt }
        ],
        model: "deepseek-reasoner",
        response_format: { type: 'json_object' }
      });

      let repairedResponse = completion.choices[0].message.content?.trim() || '{}';
      if (repairedResponse.startsWith('\`\`\`json')) {
        repairedResponse = repairedResponse.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
      }
      const repairedJson = jsonrepair(repairedResponse);
      const parsed = JSON.parse(repairedJson);
      return AnalysisDTOSchema.parse(parsed);
    } catch (repairErr: any) {
      console.error(`[Inference] Repair failed for ${story.id}:`, repairErr.message);
      throw new Error(`Failed to generate valid analysis for ${story.id}`);
    }
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (process.env.MOCK_LLM === 'true') {
    // Return a mock vector of 768 dimensions
    return Array(768).fill(0.1);
  }

  // Deepseek doesn't have a reliable embedding endpoint yet, so we stick to Gemini for Vectors
  // or we could use OpenAI if available. Sticking to Gemini for now as per original arch.
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set for embeddings.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // Correct model name from discovery: models/gemini-embedding-001
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" }, { apiVersion: 'v1beta' });

  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err: any) {
    console.error('[Inference] Embedding failed:', err.message);
    throw err;
  }
}
