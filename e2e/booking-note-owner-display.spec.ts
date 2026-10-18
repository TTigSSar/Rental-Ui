import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eBookingDetail, e2eUser } from './support/fixtures';

/**
 * Regression for the renter's booking note (ADR-013): the backend stored it and the UI mapped it
 * (`BookingRequest.note`, `BookingDetail.note`) but no template rendered it, so the owner never
 * saw it. Component specs cover the templates in isolation; this walks the real routes so a
 * regression in wiring (route, mapping, normalisation) is also caught.
 */

const NOTE = 'Please bring the box, it is for my daughter\'s birthday';

function bookingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-e2e-1',
    listingId: 'listing-e2e-1',
    listingTitle: 'E2E Wooden Train Set',
    renterId: 'renter-e2e-1',
    renterFirstName: 'Renata',
    renterLastName: 'Renter',
    renterEmail: 'renata@example.com',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    totalPrice: 10,
    status: 'Pending',
    createdAt: '2026-08-01T10:00:00.000Z',
    note: null,
    ...overrides,
  };
}

test.describe('Renter booking note is shown (ADR-013)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('owner sees the note once on the request card, and nothing for a request without one', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eUser(),
      bookingRequests: [
        bookingRequest({ id: 'req-with-note', note: NOTE }),
        bookingRequest({ id: 'req-no-note', note: null, renterFirstName: 'Nolan' }),
      ],
    });

    await page.goto('/bookings/requests');

    await expect(page.getByText(NOTE)).toHaveCount(1);
    await expect(page.getByText(NOTE)).toBeVisible();
    await expect(page.locator('blockquote.brc__note')).toHaveCount(1);
    await expect(page.locator('blockquote.brc__note')).toContainText('Note from renter');
  });

  test('owner sees "Note from renter" on a Pending booking details page', async ({ page }) => {
    await mockApi(page, {
      me: e2eUser(),
      bookingDetail: e2eBookingDetail({ role: 'owner', status: 'Pending', note: NOTE }),
    });

    await page.goto('/bookings/booking-e2e-1');

    const card = page.locator('.booking-details__note');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Note from renter');
    await expect(card).toContainText(NOTE);
  });

  test('renter sees "Your note" on the booking details page', async ({ page }) => {
    await mockApi(page, {
      me: e2eUser(),
      bookingDetail: e2eBookingDetail({ role: 'renter', status: 'Pending', note: NOTE }),
    });

    await page.goto('/bookings/booking-e2e-1');

    const card = page.locator('.booking-details__note');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Your note');
    await expect(card).toContainText(NOTE);
    await expect(card).not.toContainText('Note from renter');
  });
});
