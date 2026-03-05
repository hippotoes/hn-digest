import { db } from './src/infrastructure/db';
import { stories, analyses, sentiments } from '@hn-digest/db';
import { v4 as uuidv4 } from 'uuid';

async function seedData() {
  console.log('Seeding test data for Playwright...');

  try {
    // 1. Clean DB
    await db.delete(sentiments);
    await db.delete(analyses);
    await db.delete(stories);

    // 2. Insert test stories
    const testStories = [
      { id: '1', title: 'Nuclear Test Story 1', url: 'http://test1.com', author: 'tester', points: 100, timestamp: new Date() },
      { id: '2', title: 'Nuclear Test Story 2', url: 'http://test2.com', author: 'tester', points: 200, timestamp: new Date() },
    ];

    for (const s of testStories) {
      await db.insert(stories).values(s);

      const analysisId = uuidv4();
      await db.insert(analyses).values({
        id: analysisId,
        storyId: s.id,
        topic: 'Tech',
        summary: 'A test summary for ' + s.title,
        rawJson: JSON.stringify({ summary_paragraphs: ['Para 1', 'Para 2'] }),
      });

      await db.insert(sentiments).values({
        id: uuidv4(),
        analysisId,
        label: 'Test Tone',
        sentimentType: 'positive',
        description: 'Testing',
        source: 'article'
      });
    }

    console.log('✅ Seeding complete.');
    process.exit(0);
  } catch (e) {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  }
}

seedData();
