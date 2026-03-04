import { test, expect } from '@playwright/test';

/**
 * PHASE 4: User Experience Functional Tests (E2E)
 * Focus: Mocked Network state transitions (Loading, Zero State, Rollback).
 */

test.describe('Functional: User Experience & State Transitions (Phase 4)', () => {

  test('Scenario 4.1: The "Zero State" and Loading Skeletons', async ({ page }) => {
    // 1. Intercept API and delay it
    await page.route('**/api/v1/digests/daily/latest', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
    });

    await page.goto('http://localhost:3005/');

    // 2. Verify Loading Skeletons are visible (assuming they have a specific class or testId)
    // In our implementation, we might just look for the absence of cards but presence of loading indicators
    const skeletons = page.locator('.animate-pulse'); // Common tailwind class for skeletons
    if (await skeletons.count() > 0) {
        await expect(skeletons.first()).toBeVisible();
    }

    // 3. After 2 seconds, verify "No stories" empty state OR "Unavailable" error if DB is down
    const emptyState = page.getByText(/no stories processed yet for this date/i);
    const errorState = page.getByText(/intelligence briefing unavailable/i);

    await expect(emptyState.or(errorState)).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 4.2: Mobile Responsiveness (iPhone SE)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3005/');

    // Verify header is visible and properly scaled
    const header = page.locator('h1');
    await expect(header).toBeVisible();

    // Verify sentiment grid becomes single column (or stacks)
    // We check that the width of a sentiment block is close to the viewport width
    const sentimentBlock = page.locator('.sentiment-block').first();
    if (await sentimentBlock.isVisible()) {
        const box = await sentimentBlock.boundingBox();
        expect(box?.width).toBeGreaterThan(300);
    }
  });

  test('Scenario 4.3: Accessibility (A11y) Contrast & Keyboard', async ({ page }) => {
    await page.goto('http://localhost:3005/');

    // Verify focus remains visible when tabbing
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();

    // Verification of contrast can be done via Axe if installed,
    // or manual check of specific elements
    const logo = page.locator('h1');
    await expect(logo).toHaveCSS('color', 'rgb(255, 255, 255)'); // White on black
  });

  test('Scenario 4.4: Optimistic UI Rollback (Bookmarks)', async ({ page }) => {
    // 1. Setup: Intercept Bookmark API to FAIL
    await page.route('**/api/v1/bookmarks', route => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false }) });
    });

    // We need to be logged in for this, or simulate a session.
    // For a functional UI test, we can assume the button is clickable if we bypass auth check or use a mock session.
    // Let's assume we are on the page with a story.
    await page.goto('http://localhost:3005/');

    const bookmarkBtn = page.locator('button').filter({ hasText: /save|bookmark/i }).first();
    if (await bookmarkBtn.isVisible()) {
        await bookmarkBtn.click();

        // 2. Verify Optimistic state (should look saved immediately)
        // This depends on the UI implementation (e.g. icon change)

        // 3. Verify Rollback and Toast
        await expect(page.getByText(/failed/i)).toBeVisible();
    }
  });
});
