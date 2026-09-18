import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eListingDetails, e2eUser } from './support/fixtures';

/**
 * Loss & damage compensation (ADR-014 redesign, `DepositAmount` renamed to
 * `CompensationAmount`, migration `20260917052338_RenameDepositAmountTo
 * CompensationAmount`): the amount is now required on create and surfaces on
 * THREE different templates — the item details page's specs quad, its
 * pickup/delivery row, its "Loss & damage compensation" protection card, and
 * the booking page's own breakdown row (excluded from the total, with a "How
 * this works" popover).
 *
 * Existing coverage before this spec:
 *  - Unit: the create wizard's own validation/payload (required, 1,000–
 *    10,000,000 range, real `p-inputNumber` clamping regression) —
 *    `create-listing-form.component.spec.ts`.
 *  - Mocked e2e: `listing-details.spec.ts` covers only the NULL state (the
 *    spec tile collapses to "Not specified", still rendered).
 *  - Nothing anywhere (unit or e2e) rendered the POPULATED state on the
 *    details page's protection card / pickup row, or touched the booking
 *    page's compensation row or its popover at all — `listing-booking-page.
 *    component.spec.ts` only got a mechanical field-rename fixup, no new
 *    assertions.
 *
 * This is the one thin journey that closes that gap: it renders the details
 * page with a real amount, then follows the actual "Request to rent" CTA
 * into the booking page (not two independent `page.goto()` calls), so a
 * mismatch between what the two pages format/display for the same listing
 * would be caught the way a user would hit it. Data does not "flow" between
 * pages under network mocking (both pages are mocked from the same static
 * `compensationAmount`), so this does not replace the real-stack persistence
 * check in `real/create-listing-photo-upload.spec.ts` — it protects the
 * rendering/formatting contract across pages instead.
 */
test.describe('Loss & damage compensation — details page to booking page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('a set amount renders consistently on the details page, then on the booking page excluded from the total', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eUser(),
      listingDetails: e2eListingDetails({ compensationAmount: 45000 }),
    });

    await page.goto('/listings/listing-e2e-1');

    // ── Details page: specs quad tile ──
    const specQuad = page.locator('.detail-page__specquad');
    await expect(specQuad).toContainText('Loss & damage compensation');
    await expect(specQuad).toContainText('Up to 45,000 ֏');
    await expect(specQuad).not.toContainText('Not specified');

    // ── Details page: pickup/delivery row ──
    const pickupRow = page.locator('.detail-page__pickup-row', {
      hasText: 'Loss & damage compensation',
    });
    await expect(pickupRow).toBeVisible();
    await expect(pickupRow).toContainText('Up to 45,000 ֏');

    // ── Details page: protection card ("If something goes wrong") — the
    // `ng-template` backing it is instantiated twice (desktop + mobile
    // layout slots), so scope to the first like the rest of this page's
    // specs do for dual-rendered blocks. ──
    const protectionCard = page.locator('.detail-page__protection-card').first();
    await expect(protectionCard).toContainText('Up to 45,000 ֏');
    await expect(protectionCard).not.toContainText('Not specified');

    // ── Follow the real CTA into the booking page — a journey, not a second
    // independent page.goto() ──
    await page.getByRole('button', { name: 'Request to rent' }).click();
    await page.waitForURL(/\/listings\/listing-e2e-1\/book/);

    // The whole breakdown block (compensation row included) only renders
    // once dates are picked — before that the page shows a "select dates"
    // hint instead.
    await page.getByRole('button', { name: '1 week', exact: true }).click();

    // ── Booking page: compensation row, same amount, excluded from the total ──
    const compRow = page.locator('.booking-page__breakdown-row--compensation');
    await expect(compRow).toContainText('Loss & damage compensation');
    await expect(compRow).toContainText('Up to 45,000 ֏');
    await expect(compRow).toContainText('Not part of your total');

    const totalRow = page.locator('.booking-page__breakdown-row--total');
    await expect(totalRow).toBeVisible();
    await expect(totalRow).not.toContainText('45,000');
    await expect(
      page.locator('.booking-page__breakdown-total-note'),
    ).toContainText('The compensation amount is not included.');

    // ── "How this works" popover: opens on click, explains the mechanism,
    // and closes again (Escape) — the info affordance is the only place this
    // explanation lives, so if it silently failed to open an owner/renter
    // would have no way to learn why the row isn't in the total. ──
    const infoTrigger = page.getByRole('button', { name: 'How loss & damage compensation works' });
    await expect(page.getByRole('dialog', { name: 'How this works' })).toHaveCount(0);
    await infoTrigger.click();
    const popover = page.getByRole('dialog', { name: 'How this works' });
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('How this works');

    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });
});
