import { AnalysisRepository } from '../domain/ports';
import { Story, Analysis } from '../domain/models';
import { db } from './db';
import { stories, analyses, sentiments } from '@hn-digest/db';
import { eq } from 'drizzle-orm';

export class DrizzleAnalysisRepository implements AnalysisRepository {
  async getExistingStoryIds(): Promise<string[]> {
    const results = await db.select({ id: stories.id }).from(stories);
    return results.map(r => r.id);
  }

  async saveAnalysis(story: Story, analysis: Analysis, embedding: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Insert/Update Story
      await tx.insert(stories).values({
        id: story.id,
        title: story.title,
        url: story.url,
        points: story.points,
        author: story.author,
        rawContent: story.rawContent,
        createdAt: story.timestamp,
      }).onConflictDoUpdate({
        target: stories.id,
        set: {
          points: story.points,
          title: story.title,
        }
      });

      // 2. Insert Analysis
      const [analysisResult] = await tx.insert(analyses).values({
        storyId: story.id,
        topic: analysis.topic,
        summary: analysis.summary_paragraphs.join('\n\n'),
        embedding: embedding,
        rawJson: JSON.stringify(analysis),
      }).returning({ id: analyses.id });

      // 3. Insert Sentiments
      const sentimentValues = [
        {
          analysisId: analysisResult.id,
          source: 'article',
          label: analysis.article_sentiment.label,
          sentimentType: analysis.article_sentiment.type,
          description: analysis.article_sentiment.description,
          agreement: analysis.article_sentiment.estimated_agreement,
        },
        ...analysis.community_sentiments.map(s => ({
          analysisId: analysisResult.id,
          source: 'community',
          label: s.label,
          sentimentType: s.type,
          description: s.description,
          agreement: s.estimated_agreement,
        }))
      ];

      await tx.insert(sentiments).values(sentimentValues);
    });
  }
}
