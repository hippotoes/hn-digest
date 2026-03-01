import { test, expect } from '@playwright/test';

test('Authentication: Register, Login and Logout flow', async ({ page }) => {
  await page.goto('http://127.0.0.1:3005/auth');

  // 1. Perform Signup
  const email = `test-${Date.now()}@example.com`;

  await page.fill('input[placeholder="New Email"]', email);
  await page.fill('input[placeholder="New Password (8+ chars)"]', 'password123');
  await page.click('#signup-submit-btn');

  // 2. Verify Signup Success
  const successMsg = page.locator('#auth-message');
  await expect(successMsg).toBeVisible({ timeout: 15000 });
  await expect(successMsg).toContainText('Signup successful');

  // 3. Perform Login
  await page.fill('input[placeholder="Email"]', email);
  await page.fill('input[placeholder="Password"]', 'password123');
  await page.click('#login-submit-btn');

  // 4. Verify Logged In State
  await page.waitForURL('http://127.0.0.1:3005/');
  const userEmail = page.locator('#user-email');
  await expect(userEmail).toBeVisible({ timeout: 15000 });
  await expect(userEmail).toContainText(email);

  // 5. Perform Logout
  const logoutBtn = page.locator('#logout-btn');
  await expect(logoutBtn).toBeVisible();
  await logoutBtn.click();

  // 6. Verify Logged Out State
  await expect(page.locator('#login-link')).toBeVisible();
});
