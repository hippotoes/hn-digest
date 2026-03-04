import { test, expect } from '@playwright/test';

/**
 * ☢️ Nuclear Bookmarks Functional Stress (40 Cases)
 */

test.describe('Nuclear Bookmarks: State & Isolation Stress', () => {
  const loginUrl = 'http://127.0.0.1:3005/auth';
  const homeUrl = 'http://127.0.0.1:3005/';
  const savedUrl = 'http://127.0.0.1:3005/?view=saved';

  async function registerAndLogin(page: any, i: number) {
    const email = `nuclear-user-${i}-${Date.now()}@stress.com`;
    const pass = 'password123';
    await page.goto(loginUrl);
    await page.fill('input[placeholder="New Email"]', email);
    await page.fill('input[placeholder="New Password (8+ chars)"]', pass);
    await page.click('#signup-submit-btn');
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder="Password"]', pass);
    await page.click('#login-submit-btn');
    await page.waitForURL(u => u.pathname === '/', { timeout: 15000 });

    const userEmail = page.locator('#user-email');
    await expect(userEmail).toBeVisible({ timeout: 10000 });
    return email;
  }

  // 1. Multi-User Isolation (15 cases)
  for (let i = 0; i < 15; i++) {
    test(`Case 1.${i}: Multi-User Isolation Stress ${i}`, async ({ page }) => {
      await registerAndLogin(page, i);
      await page.goto(savedUrl);
      await expect(page.locator('article.story-card')).toHaveCount(0);
    });
  }

  // 2. Reliable Bookmark Flow
  test('Case 2: Reliable Bookmark/Unbookmark Cycle', async ({ page }) => {
    await registerAndLogin(page, 999);
    await page.goto(homeUrl);

    // Bookmark
    const bookmarkBtn = page.locator('button[title="Bookmark"]').first();
    await bookmarkBtn.click();
    // Wait for the UI to actually reflect the change (STABLE)
    await expect(page.locator('button[title="Un-bookmark"]').first()).toBeVisible({ timeout: 10000 });
    // Additional wait to ensure revalidatePath finished
    await page.waitForTimeout(1000);

    // Verify
    await page.goto(savedUrl);
    await expect(page.locator('article.story-card')).toHaveCount(1, { timeout: 15000 });

    // Unbookmark
    await page.locator('button[title="Un-bookmark"]').first().click();
    await expect(page.locator('button[title="Bookmark"]').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify Empty
    await page.goto(savedUrl);
    await expect(page.locator('article.story-card')).toHaveCount(0, { timeout: 15000 });
  });

  // 3. Guest Resilience (10 cases)
  for (let i = 0; i < 10; i++) {
    test(`Case 4.${i}: Guest Attempt ${i}`, async ({ page }) => {
      await page.goto(homeUrl);
      const btn = page.locator('button[title="Bookmark"]');
      await expect(btn).toHaveCount(0);
    });
  }

  // 4. Permutation Stress (14 cases)
  for (let i = 0; i < 14; i++) {
    test(`Case 5.${i}: Layout permutation stress ${i}`, async ({ page }) => {
      await page.goto(homeUrl);
      await page.setViewportSize({ width: 300 + i * 100, height: 800 });
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
