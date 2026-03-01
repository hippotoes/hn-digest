import { test, expect } from '@playwright/test';

test('Bookmarks: Toggle and Filter flow', async ({ page }) => {
  // 1. Setup: Register and Login
  await page.goto('http://127.0.0.1:3005/auth');
  const email = `test-bookmarks-${Date.now()}@example.com`;
  await page.fill('input[placeholder="New Email"]', email);
  await page.fill('input[placeholder="New Password (8+ chars)"]', 'password123');
  await page.click('#signup-submit-btn');
  await page.waitForURL('http://127.0.0.1:3005/auth?*'); // Wait for redirect to auth page with success message

  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('#login-submit-btn');
  await page.waitForURL('http://127.0.0.1:3005/');

  // 2. Initial State: No Bookmarks
  await page.goto('http://127.0.0.1:3005/?view=saved');
  await expect(page.locator('text=No entries found.')).toBeVisible();

  // 3. Bookmark a story
  await page.goto('http://127.0.0.1:3005/');
  const firstStory = page.locator('article.story-card').first();
  const storyTitle = await firstStory.locator('h2').textContent();
  const bookmarkBtn = firstStory.locator('button[title="Bookmark"]');

  await bookmarkBtn.click();
  // Optimistic UI check: Icon should change to Un-bookmark immediately
  const unbookmarkBtn = firstStory.locator('button[title="Un-bookmark"]');
  await expect(unbookmarkBtn).toBeVisible({ timeout: 10000 });

  // 4. Verify in Saved View
  await page.goto('http://127.0.0.1:3005/?view=saved');
  await expect(page.locator('article.story-card').count()).resolves.toBeGreaterThanOrEqual(1);
  await expect(page.locator('h2').first()).toContainText(storyTitle || '');

  // 5. Un-bookmark
  await unbookmarkBtn.click();
  const reboundBookmarkBtn = page.locator('button[title="Bookmark"]');
  await expect(reboundBookmarkBtn).toBeVisible();

  // 6. Verify empty again
  await expect(page.locator('text=No entries found.')).toBeVisible();
});
