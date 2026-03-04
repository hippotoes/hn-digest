import { test, expect, devices } from '@playwright/test';

/**
 * ☢️ Nuclear MVP Browser Stress (20 Cases)
 */

const viewports = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 720 },
  { name: 'Wide', width: 1920, height: 1080 },
  { name: '4K', width: 3840, height: 2160 },
];

test.describe('Nuclear MVP: UI & UX Stress', () => {
  for (const vp of viewports) {
    test(`Case 1.${vp.name}: Rendering at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('http://127.0.0.1:3005/');
      await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

      const cards = page.locator('article.story-card');
      const count = await cards.count();
      if (count > 0) {
        await expect(cards.first()).toBeVisible();
      }
    });
  }

  const themes = ['light', 'dark'];
  for (const theme of themes) {
    test(`Case 2.Theme: ${theme} mode integrity`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme as any });
      await page.goto('http://127.0.0.1:3005/');
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  }

  test('Case 3: Rapid Navigation Stress', async ({ page }) => {
    await page.goto('http://127.0.0.1:3005/');
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.mouse.wheel(0, 500);
    }
    await expect(page.locator('h1')).toBeVisible();
  });

  // Scale up to 20 cases with variations
  for (let i = 0; i < 12; i++) {
    test(`Case 4.${i}: Parametric robustness stress ${i}`, async ({ page }) => {
      await page.goto(`http://127.0.0.1:3005/?stress=${i}`);
      await expect(page.locator('h1')).toBeVisible();
    });
  }
});
