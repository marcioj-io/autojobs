import { test, expect } from '@playwright/test';

test.describe('Manual review workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.locator('h2:has-text("Manual Review")')).toBeVisible();
  });

  test('approves a pending review item and updates status', async ({ page }) => {
    const approveButton = page.locator('button:has-text("Aprovar")').first();
    await expect(approveButton).toBeEnabled();
    await approveButton.click();

    await expect(page.locator('text=APPROVED')).toHaveCount(1, { timeout: 10000 });
  });

  test('rejects a pending review item and updates status', async ({ page }) => {
    const rejectButton = page.locator('button:has-text("Rejeitar"):not([disabled])').first();
    await expect(rejectButton).toBeEnabled();
    await rejectButton.click();

    await expect(page.locator('text=REJECTED')).toHaveCount(1, { timeout: 10000 });
  });
});
