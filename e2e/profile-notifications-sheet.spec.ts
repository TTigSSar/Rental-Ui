import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';

/**
 * Regression: the Notifications sheet opened from /profile/settings must sit flush with the
 * viewport bottom and above the fixed bottom nav at mobile width. Two live-only bugs (unit tests
 * cannot see geometry): a transform on `.profile-page` trapped `position: fixed` (sheet clipped at
 * top:56), and the sheet stacked under the bottom nav. Mocked tier is enough: this pins layout, not
 * backend behaviour.
 */
test.describe('Notifications sheet geometry', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('is flush with the viewport bottom and not covered by the bottom nav', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('auth_token', 'e2e-jwt-token'));
    await mockApi(page, { me: e2eUser() });

    await page.goto('/profile/settings');
    await page.locator('[data-notifications-row]').click();

    const sheet = page.locator('.ns');
    await expect(sheet).toBeVisible();
    // Opening animation must have finished before measuring.
    await expect
      .poll(async () => {
        const b = await sheet.boundingBox();
        return b ? Math.round(b.y + b.height) : -1;
      })
      .toBe(700);

    const box = (await sheet.boundingBox())!;
    expect(box.y).toBeGreaterThan(0);

    const insideSheet = await page.evaluate(() => {
      const el = document.elementFromPoint(187, 700 - 8);
      return !!el?.closest('.ns');
    });
    expect(insideSheet).toBe(true);
  });
});
