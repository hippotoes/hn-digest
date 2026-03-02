import { IntelligenceProvider } from '../domain/ports';
import { Story, Analysis, Comment } from '../domain/models';
import { extractArguments, generateAnalysis, generateEmbedding } from './LLMIntelligence';

export class MultiLLMIntelligenceProvider implements IntelligenceProvider {
  async extractArguments(comments: Comment[]): Promise<string> {
    return extractArguments(comments);
  }

  async generateAnalysis(story: Story, combinedSignals?: string): Promise<Analysis> {
    const dto = await generateAnalysis(story, combinedSignals);
    return {
      topic: dto.topic as any,
      summary_paragraphs: dto.summary_paragraphs,
      highlight: dto.highlight,
      key_points: dto.key_points,
      article_sentiment: dto.article_sentiment as any,
      community_sentiments: dto.community_sentiments as any,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return generateEmbedding(text);
  }
}
