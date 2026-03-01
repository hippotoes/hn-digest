import { test, expect } from '@playwright/test';

test('Authentication: Login and Logout flow', async ({ page }) => {
  await page.goto('http://localhost:3005');

  // 1. Initial State: Should see Login button
  const loginBtn = page.locator('#login-btn');
  await expect(loginBtn).toBeVisible();

  // 2. Perform Login
  await loginBtn.click();

  // 3. Verify Logged In State
  // After loginAction, it redirects back to "/"
  const userEmail = page.locator('#user-email');
  await expect(userEmail).toBeVisible();
  await expect(userEmail).toContainText('test@example.com');

  // 4. Perform Logout
  const logoutBtn = page.locator('#logout-btn');
  await expect(logoutBtn).toBeVisible();
  await logoutBtn.click();

  // 5. Verify Logged Out State
  await expect(page.locator('#login-btn')).toBeVisible();
});
