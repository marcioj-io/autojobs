import { test, expect } from '@playwright/test';

test.describe('Runtime control flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/runtime');
    await expect(page.locator('text=State:')).toBeVisible();
  });

  test('applies cooldown and resumes runtime', async ({ page }) => {
    await page.click('button:has-text("Cooldown")');
    await expect(page.locator('text=State: COOLDOWN')).toHaveCount(1, { timeout: 10000 });

    await page.click('button:has-text("Resume")');
    await expect(page.locator('text=State: SCRAPING')).toHaveCount(1, { timeout: 10000 });
  });

  test('performs emergency stop and blocks runtime', async ({ page }) => {
    await page.click('button:has-text("Emergency Stop")');
    await expect(page.locator('text=State: BLOCKED')).toBeVisible();
  });
});
