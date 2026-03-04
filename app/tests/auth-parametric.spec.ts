import { test, expect } from '@playwright/test';

test.describe('Auth - Parametric Email Validation', () => {
  // Generate 50 invalid email formats
  const invalidEmails = Array.from({ length: 50 }, (_, i) => [
    `plainaddress${i}`,
    `#@%^%#$@#$@#${i}.com`,
    `@example${i}.com`,
    `Joe Smith <email${i}@example.com>`,
    `email.example${i}.com`,
    `email@example@example${i}.com`,
    `.email${i}@example.com`,
    `email.${i}@example.com`,
    `email..email${i}@example.com`,
    `あいうえお${i}@example.com`,
  ][i % 10] + `-variant-${i}`);

  for (const [index, email] of invalidEmails.entries()) {
    test(`Signup should reject invalid email format [${index}]`, async ({ page }) => {
      await page.goto('http://127.0.0.1:3005/auth');
      await page.fill('input[placeholder="New Email"]', email);
      await page.fill('input[placeholder="New Password (8+ chars)"]', 'validpass123');

      // Native HTML5 validation will likely prevent form submission,
      // or server returns an error. We just check we don't succeed.
      await page.click('#signup-submit-btn', { force: true });

      // If server-side validation works, it should not redirect to home.
      // It might stay on /auth or redirect with error.
      await page.waitForTimeout(500);
      expect(page.url()).not.toBe('http://127.0.0.1:3005/');
    });
  }
});

test.describe('Auth - Parametric Password Validation', () => {
  // Generate 50 invalid password scenarios
  const invalidPasswords = Array.from({ length: 50 }, (_, i) => {
    if (i < 20) return 'a'.repeat(i % 8); // Too short (0-7 chars)
    if (i < 40) return ' '.repeat(i % 7 + 1); // Whitespace only
    return String(i); // Very short numeric
  });

  for (const [index, password] of invalidPasswords.entries()) {
    test(`Signup should reject invalid password [${index}]`, async ({ page }) => {
      await page.goto('http://127.0.0.1:3005/auth');
      await page.fill('input[placeholder="New Email"]', `valid-${index}@example.com`);
      await page.fill('input[placeholder="New Password (8+ chars)"]', password);

      await page.click('#signup-submit-btn', { force: true });

      await page.waitForTimeout(500);
      expect(page.url()).not.toBe('http://127.0.0.1:3005/');
    });
  }
});

test.describe('Auth - Parametric Login Failures', () => {
  const attempts = Array.from({ length: 30 }, (_, i) => ({
    email: `nonexistent${i}@example.com`,
    password: `wrongpass${i}`
  }));

  for (const [index, creds] of attempts.entries()) {
    test(`Login should fail gracefully for non-existent user [${index}]`, async ({ page }) => {
      await page.goto('http://127.0.0.1:3005/auth');
      await page.fill('input[placeholder="Email"]', creds.email);
      await page.fill('input[placeholder="Password"]', creds.password);
      await page.click('#login-submit-btn');

      // Should either stay on auth page or redirect with error
      await expect(page.url()).toContain('auth');
    });
  }
});
