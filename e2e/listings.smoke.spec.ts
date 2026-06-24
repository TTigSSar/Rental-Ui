import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eListing, e2eUser } from './support/fixtures';

/**
 * Critical journey: browse listings and favorite one.
 * The favorite toggle is optimistic, so the heart must flip immediately even
 * though the persistence request is mocked.
 */
test.describe('Browse and favorite', () => {
  test('renders a seeded listing on the listings page', async ({ page }) => {
    await mockApi(page, { listings: [e2eListing()] });

    await page.goto('/listings');

    await expect(page.locator('.listing-card__title')).toContainText(
      'E2E Wooden Train Set',
    );
  });

  test('optimistically toggles the favorite heart', async ({ page }) => {
    // Favoriting requires an authenticated user; seed a token so /auth/me hydrates.
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    await mockApi(page, { me: e2eUser(), listings: [e2eListing({ isFavorite: false })] });
    await page.goto('/listings');

    const favButton = page.locator('.listing-card__fav-btn').first();
    await expect(favButton).toHaveAttribute('aria-pressed', 'false');

    await favButton.click();

    // Optimistic update flips aria-pressed without waiting on the (mocked) request.
    await expect(favButton).toHaveAttribute('aria-pressed', 'true');
  });
});
