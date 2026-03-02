import { Story, Analysis, Comment } from './models';

export interface StoryProvider {
  fetchTopStories(limit: number, skipIds: string[]): Promise<Story[]>;
}

export interface IntelligenceProvider {
  extractArguments(comments: Comment[]): Promise<string>;
  generateAnalysis(story: Story, combinedSignals?: string): Promise<Analysis>;
  generateEmbedding(text: string): Promise<number[]>;
}

export interface AnalysisRepository {
  saveAnalysis(story: Story, analysis: Analysis, embedding: number[]): Promise<void>;
  getExistingStoryIds(): Promise<string[]>;
}
