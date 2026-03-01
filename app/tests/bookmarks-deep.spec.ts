import { test, expect } from '@playwright/test';

test('Bookmarks: Deep flow verification @bookmarks', async ({ page }) => {
  // 1. Register & Login
  await page.goto('http://127.0.0.1:3005/auth');
  const email = `deep-test-${Date.now()}@example.com`;
  await page.fill('input[placeholder="New Email"]', email);
  await page.fill('input[placeholder="New Password (8+ chars)"]', 'password123');
  await page.click('#signup-submit-btn');
  await page.waitForURL('**/auth?message=*');

  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('#login-submit-btn');
  await page.waitForURL('http://127.0.0.1:3005/');

  // 2. Bookmark first story
  const firstStory = page.locator('article.story-card').first();
  const storyId = await firstStory.getAttribute('data-story-id');
  const storyTitle = await firstStory.locator('h2').textContent();

  // Click bookmark
  await firstStory.locator('button[title="Bookmark"]').click();
  // Verify icon changes to Un-bookmark (Optimistic UI)
  await expect(firstStory.locator('button[title="Un-bookmark"]')).toBeVisible();

  // 3. Navigate to Saved view
  await page.click('text=Bookmarks');
  await page.waitForURL('**/?view=saved');

  // Verify story is present
  const savedStory = page.locator(`article[data-story-id="${storyId}"]`);
  await expect(savedStory).toBeVisible();
  await expect(savedStory.locator('h2')).toContainText(storyTitle || '');

  // 4. Un-bookmark from Saved view
  await savedStory.locator('button[title="Un-bookmark"]').click();

  // Verify it disappears from Saved view
  await expect(savedStory).not.toBeVisible();
  await expect(page.locator('text=Your personal library is empty.')).toBeVisible();

  // 5. Navigate back to Latest and re-bookmark
  await page.click('text=Latest');
  await page.waitForURL('http://127.0.0.1:3005/');
  await firstStory.locator('button[title="Bookmark"]').click();

  // 6. Hard reload and check persistence
  await page.reload();
  await expect(firstStory.locator('button[title="Un-bookmark"]')).toBeVisible();
});
