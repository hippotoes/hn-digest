import { GoogleGenerativeAI } from '@google/generative-ai';
import { ScrapedStory } from './scraper';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function generateSummary(story: ScrapedStory): Promise<string> {
  if (process.env.MOCK_LLM === 'true') {
    return `[MOCK SUMMARY] This is an automated mock summary for the story: ${story.title}. It discusses deep technical details that were successfully extracted.`;
  }

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  console.log(`[Inference] Summarizing: ${story.title}`);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const prompt = `
    You are a Staff Engineer writing a daily tech briefing.
    Write a single, highly technical paragraph (~100 words) summarizing the following article.
    Focus on the architectural or engineering significance.

    TITLE: ${story.title}
    URL: ${story.url}
    CONTENT:
    ${story.rawContent}
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err: any) {
    console.error(`[Inference] Error summarizing ${story.id}:`, err.message);
    return '[Summarization Failed]';
  }
}
