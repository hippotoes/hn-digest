import { execSync } from 'child_process';
import { db } from './src/db';
import { stories, analyses } from '@hn-digest/db';

async function testMVP() {
  console.log('Running test:mvp verification script...');

  // Clean DB for fresh test
  await db.delete(analyses);
  await db.delete(stories);

  // Set Mock LLM to avoid spending tokens during automated testing
  process.env.MOCK_LLM = 'true';

  // Run the pipeline
  try {
    execSync('npx tsx src/index.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Pipeline execution failed:', error);
    process.exit(1);
  }

  // Verify DB state
  const allStories = await db.select().from(stories);
  const allAnalyses = await db.select().from(analyses);

  if (allStories.length === 0) {
    console.error('❌ DB Verification Failed: No stories inserted.');
    process.exit(1);
  }

  if (allAnalyses.length === 0) {
    console.error('❌ DB Verification Failed: No analyses inserted.');
    process.exit(1);
  }

  if (allStories.length !== allAnalyses.length) {
    console.error('❌ DB Verification Failed: Stories and analyses count mismatch.');
    process.exit(1);
  }

  console.log(`✅ DB Verification Passed! Found ${allStories.length} stories and ${allAnalyses.length} analyses.`);
  console.log('✅ Automated MVP Pipeline Verification: SUCCESS');
  process.exit(0);
}

testMVP().catch(console.error);
