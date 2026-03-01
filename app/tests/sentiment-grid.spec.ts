import { test, expect } from '@playwright/test';

test('UI: Verify single copy per story and strict sentiment structure @ui', async ({ page }) => {
  await page.goto('http://127.0.0.1:3005/');

  // 1. Check for duplicates
  const titles = await page.locator('h2').allTextContents();
  const uniqueTitles = new Set(titles);
  expect(titles.length, `Duplicate stories detected: ${titles}`).toBe(uniqueTitles.size);

  // 2. Verify Sentiment Grid for stories that have data
  const storyCards = await page.locator('article.story-card').all();

  for (const card of storyCards) {
    const title = await card.locator('h2').textContent();
    console.log(`Checking story: ${title}`);

    // Check Article Tone Card (Must exist)
    const articleTone = card.locator('text=Article Tone');
    await expect(articleTone, `Missing Article Tone for: ${title}`).toBeVisible({ timeout: 10000 });

    // We expect exactly 1 Article Tone + at least some Community Sentiments if title is one of the new ones
    // Check Community Reaction Grid (Scoped to the card)
    const communityHeader = card.locator('text=Community Reaction');
    const communityBlocks = card.locator('.sentiment-block');

    const count = await communityBlocks.count();
    if (count > 0) {
      await expect(communityHeader, `Missing Community Reaction header for: ${title}`).toBeVisible();
      expect(count, `Insufficient community sentiments for: ${title}`).toBeGreaterThanOrEqual(2);
    }
  }
});
