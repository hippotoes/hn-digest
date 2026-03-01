import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(apiKey);
  const models = await genAI.listModels();
  for (const model of models.models) {
    console.log(`Model: ${model.name} (Methods: ${model.supportedGenerationMethods})`);
  }
}

listModels().catch(console.error);
