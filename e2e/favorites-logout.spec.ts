import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eListing, e2eUser } from './support/fixtures';

/**
 * Regression (Trello Lu4YT3x1): the favourites store had no logout reset, so the
 * heart marks of the signed-out user stayed visible to the next (guest) visitor
 * until a full reload. The marks are derived from the favourites slice's
 * `favoriteIds`, and the bootstrap seeders only ever add ids.
 */
test.describe('Favourites and logout', () => {
  test('a signed-in user\'s heart marks do not survive a logout without reload', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    const seed = {
      me: e2eUser(),
      listings: [e2eListing({ isFavorite: true })] as unknown[],
    };
    await mockApi(page, seed);

    await page.goto('/listings');
    const heart = page.locator('.listing-card__fav-btn').first();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');

    // Sign out through the header menu: no reload, and no visit to a page that would
    // refetch /api/favorites (which would overwrite the ids and hide the bug). The real
    // API answers a guest with isFavorite=false.
    seed.listings = [e2eListing({ isFavorite: false })];
    await page.locator('.nh__user-trigger').hover();
    await page.locator('.nh__dd-item--signout').click();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();

    // Browse as a guest: the store must not remember the previous user's marks.
    await expect(page).toHaveURL(/\/listings/);
    await expect(page.locator('.listing-card__title').first()).toBeVisible();
    await expect(page.locator('.listing-card__fav-btn').first()).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
