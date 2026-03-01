import { test, expect } from '@playwright/test';

test('MVP: displays daily digest stories @mvp', async ({ page }) => {
  await page.goto('/');

  // Check the header
  await expect(page.locator('h1')).toContainText(/Hacker News Digest/i);

  // Check that at least one story card is rendered
  const storyCards = page.locator('article.story-card');

  // Since our previous worker step populated the DB with 10 stories,
  // we expect to see at least 1 story card on the screen.
  await expect(storyCards.count()).resolves.toBeGreaterThanOrEqual(1);

  // Check that the summary text is present inside the first card
  const firstCard = storyCards.first();
  await expect(firstCard.locator('h2')).toBeVisible();

  const summaryText = firstCard.locator('p');
  await expect(summaryText).toBeVisible();
  const textContent = await summaryText.textContent();
  expect(textContent?.length).toBeGreaterThan(10); // Ensure the summary isn't empty
});
