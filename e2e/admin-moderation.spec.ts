import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eAdmin, e2ePendingListing } from './support/fixtures';

/**
 * Critical journey: an admin clears the moderation queue. A seeded token lets the
 * boot-time /auth/me call hydrate the admin role so adminGuard admits the route.
 */
test.describe('Admin moderation', () => {
  test.beforeEach(async ({ page }) => {
    // Seed a token before the app boots so initAuth$ hydrates the session.
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('approves a pending listing and removes it from the queue', async ({ page }) => {
    await mockApi(page, {
      me: e2eAdmin(),
      pendingListings: [e2ePendingListing({ title: 'E2E Toy Kitchen' })],
    });

    await page.goto('/admin/listings/pending');

    await expect(page.getByText('E2E Toy Kitchen')).toBeVisible();

    await page.getByTestId('approve-listing').click();

    // On approve success the reducer drops the listing from the queue.
    await expect(page.getByText('E2E Toy Kitchen')).toHaveCount(0);
  });
});
