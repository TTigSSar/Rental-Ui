import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  e2eCreateBookingResponse,
  e2eListingDetails,
  e2eMyBooking,
  e2eUser,
} from './support/fixtures';

/**
 * Contact-privacy regression: DoRent used to reveal the owner's real phone
 * number to the renter once a booking reached Approved — an earlier revision
 * of this suite pinned that *reveal timing* (never before Approved, even
 * though the padlock copy said so). That rule is now gone entirely: the
 * phone number was deleted from the API surface these pages read
 * (`ListingOwnerResponse.PhoneNumber`, `BookingDetailResponse
 * .CounterpartyPhoneNumber`) and is never sent to a renter or owner at any
 * booking status. Chat is the replacement contact channel — structurally
 * booking-scoped (`POST /api/chat/conversations/from-booking/{bookingId}` is
 * the only creation path) — so a renter simply asks the owner for a number
 * once a rental request exists, rather than the platform handing it over
 * automatically.
 *
 * This suite now pins THAT: the phone number is absent at every booking
 * status — including Pending, Approved, Active and Completed — across the
 * listing details page, the booking (request) page, and the just-submitted
 * confirmation screen, AND the new chat notice that replaced the four old
 * padlock notices is actually rendered in its place. The one deliberate
 * survivor of the old reveal gate is the pickup address, which is unaffected
 * by this suite (see `real/booking-lifecycle.spec.ts` for that positive
 * assertion) and the admin console, which is the one place the phone number
 * is still allowed to appear (see `admin-users.spec.ts`'s admin-visibility
 * pin).
 */
test.describe('Contact privacy — the owner phone number is never exposed to renter or owner', () => {
  const OWNER_PHONE = '+374 55 000111';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('absent on details (pre-booking), the booking page, and the confirmation screen — chat notice shown instead', async ({
    page,
  }) => {
    const listingDetails = e2eListingDetails({
      owner: {
        id: 'owner-e2e-1',
        firstName: 'Olive',
        lastName: 'Owner',
        // The wire shape carries no `phoneNumber` field at all any more (see
        // `fixtures.ts`'s `e2eListingDetails` doc comment) — this fixture
        // deliberately smuggles one in anyway, exactly as a rogue/legacy
        // backend response might, so this test still proves something even
        // though the typed contract itself no longer allows it: even a
        // present, non-null phone number in the raw payload must never be
        // rendered by the UI.
        phoneNumber: OWNER_PHONE,
      },
    });

    await mockApi(page, {
      me: e2eUser(),
      listingDetails,
      createBooking: { body: e2eCreateBookingResponse({ status: 'Pending' }) },
    });

    // 1. Details page, no booking on file yet — chat notice on the owner card.
    await page.goto('/listings/listing-e2e-1');
    await expect(page.locator('body')).not.toContainText(OWNER_PHONE);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('.detail-page__chat-notice')).toHaveText(
      'You can message the owner in chat once your rental request is sent.',
    );

    // 2. Booking page, before submitting — chat notice on the request card.
    await page.goto('/listings/listing-e2e-1/book');
    await expect(page.locator('body')).not.toContainText(OWNER_PHONE);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('.booking-page__request-chat-notice').first()).toContainText(
      'Send the request to open a chat with Olive — agree pickup and contact details there.',
    );

    // 3. Confirmation, immediately after submitting (server returns Pending).
    await page.getByRole('button', { name: '1 week', exact: true }).click();
    await page.getByRole('button', { name: 'Send booking request' }).click();
    await expect(
      page.getByRole('heading', { name: 'Request sent to Olive!' }),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText(OWNER_PHONE);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
    await expect(page.locator('.booking-page__confirm-contact')).toContainText(
      'Your request has been sent — chat with Olive to agree pickup and contact details.',
    );
  });

  for (const status of ['Pending', 'Approved', 'Active', 'Completed'] as const) {
    test(`absent on the details page relationship banner when the booking is ${status}`, async ({
      page,
    }) => {
      const listingDetails = e2eListingDetails({
        owner: {
          id: 'owner-e2e-1',
          firstName: 'Olive',
          lastName: 'Owner',
          phoneNumber: OWNER_PHONE,
        },
      });

      await mockApi(page, {
        me: e2eUser(),
        listingDetails,
        myBookings: [e2eMyBooking({ status })],
      });

      await page.goto('/listings/listing-e2e-1');

      // Completed hides the relationship banner entirely (finished state,
      // no action needed) — Pending/Approved/Active show it. Either way the
      // phone number must never appear.
      if (status === 'Completed') {
        await expect(page.locator('.detail-page__relationship')).toHaveCount(0);
      } else {
        await expect(page.locator('.detail-page__relationship')).toBeVisible();
      }

      await expect(page.locator('body')).not.toContainText(OWNER_PHONE);
      await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
      // The chat notice on the owner card is unconditional — it does not
      // depend on booking status, unlike the old padlock copy which quoted
      // a specific reveal stage.
      await expect(page.locator('.detail-page__chat-notice')).toBeVisible();
    });
  }
});
