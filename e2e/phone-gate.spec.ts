import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eCreateBookingResponse, e2eListingDetails, e2eUser } from './support/fixtures';
import { callsTo, recordCalls } from './support/google-stub';
import { mockTiles } from './support/tile-mock';
import { STUB_PNG_BUFFER } from './support/stub-image';

/**
 * Critical journeys: the phone gate (ADR-030 section 8). A user with no phone is asked for one
 * BEFORE the first listing is published / the first booking is requested, and the original
 * action is then sent exactly once. The server is the authority (409 `*.phone_required`,
 * refused before any write), so the same step is also the fallback for a client that thought
 * the user had a phone. Mocked tier: this pins the FRONTEND's ordering and counts; the server
 * refusal itself is pinned in the real-stack tier (`real/phone-gate.spec.ts`).
 */
const PHONE = '+374 99 123 456';

const phoneRequired = (code: 'booking.phone_required' | 'listing.phone_required') => ({
  type: `urn:rental:error:${code}`,
  title: 'A phone number is required.',
  status: 409,
  errorCode: code,
});

test.describe('Phone gate', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  async function fillPhoneAndSave(page: Page, cta: string): Promise<void> {
    const step = page.locator('.dr-step-dialog--phone');
    await step.locator('input').fill(`  ${PHONE}  `);
    await step.getByRole('button', { name: cta }).click();
  }

  // Journey 6
  test('publishing a listing without a phone opens the step first; "Not now" keeps the wizard; saving sends exactly one POST', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockTiles(page);
    await mockApi(page, { me: e2eUser({ phoneNumber: null }) });

    await page.goto('/listings/create');
    await page.locator('#wizard-images-input').setInputFiles(
      [1, 2, 3].map((n) => ({
        name: `toy-${n}.png`,
        mimeType: 'image/png',
        buffer: STUB_PNG_BUFFER,
      })),
    );
    await page.getByRole('button', { name: 'Continue to basics' }).click();
    await page.getByLabel('Toy name').fill('E2E Wooden Train Set');
    await page.locator('.cs-trigger').click();
    await page.locator('.cs-option').first().click();
    await page
      .getByLabel('Description')
      .fill('A sturdy wooden train set with all pieces present and freshly cleaned.');
    await page.getByRole('button', { name: 'Continue to pricing' }).click();
    await page.locator('#wz-price').fill('25');
    await page.locator('#wz-compensation').fill('45000');
    await page.getByRole('button', { name: 'Continue to safety' }).click();
    await page.getByRole('button', { name: 'Continue to preview' }).click();

    const submit = page.getByRole('button', { name: 'Submit for review' });
    await submit.click();

    // The step opens BEFORE anything is sent.
    const step = page.locator('.dr-step-dialog--phone');
    await expect(step).toBeVisible();
    await expect(step).toContainText('Before you publish');
    expect(callsTo(calls, 'POST', '/api/listings')).toHaveLength(0);

    // "Not now": the wizard is exactly where it was, nothing was written.
    await step.getByRole('button', { name: 'Not now' }).click();
    await expect(step).toBeHidden();
    await expect(submit).toBeVisible();
    expect(callsTo(calls, 'POST', '/api/listings')).toHaveLength(0);
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(0);

    // Save the phone: ONE PUT (trimmed), then ONE POST.
    await submit.click();
    await expect(step).toBeVisible();
    await fillPhoneAndSave(page, 'Save and publish');

    await expect.poll(() => callsTo(calls, 'POST', '/api/listings')).toHaveLength(1);
    await expect(step).toBeHidden();
    const puts = callsTo(calls, 'PUT', '/api/auth/me/phone');
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ phoneNumber: PHONE });
    expect(callsTo(calls, 'POST', '/api/listings')).toHaveLength(1);
  });

  async function pickWeekAndWrite(page: Page): Promise<void> {
    await page.goto('/listings/listing-e2e-1/book');
    await page.getByRole('button', { name: '1 week', exact: true }).click();
    await page.getByLabel('Your message').fill('Please leave it by the gate.');
  }

  // Journey 7
  test('requesting a booking without a phone opens the step first; saving sends exactly one POST', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, {
      me: e2eUser({ phoneNumber: null }),
      listingDetails: e2eListingDetails(),
      createBooking: { body: e2eCreateBookingResponse() },
    });

    await pickWeekAndWrite(page);
    const send = page.getByRole('button', { name: 'Send booking request' });
    await send.click();

    const step = page.locator('.dr-step-dialog--phone');
    await expect(step).toBeVisible();
    await expect(step).toContainText('Before you send the request');
    expect(callsTo(calls, 'POST', '/api/bookings')).toHaveLength(0);

    // "Not now" keeps the dates and the typed message.
    await step.getByRole('button', { name: 'Not now' }).click();
    await expect(step).toBeHidden();
    await expect(page.getByLabel('Your message')).toHaveValue('Please leave it by the gate.');
    expect(callsTo(calls, 'POST', '/api/bookings')).toHaveLength(0);

    await send.click();
    await fillPhoneAndSave(page, 'Save and send request');

    await expect(page.getByRole('heading', { name: 'Request sent to Olive!' })).toBeVisible();
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(1);
    const posts = callsTo(calls, 'POST', '/api/bookings');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({
      listingId: 'listing-e2e-1',
      note: 'Please leave it by the gate.',
    });
  });

  // Journey 8a
  test('server fallback: a 409 booking.phone_required opens the step and, after saving, resends exactly once', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, {
      // The client believes the user has a phone (it is in /me)...
      me: e2eUser(),
      listingDetails: e2eListingDetails(),
      // ...the server disagrees on the first request and accepts the second.
      createBooking: {
        sequence: [
          { status: 409, body: phoneRequired('booking.phone_required') },
          { status: 200, body: e2eCreateBookingResponse() },
        ],
      },
    });

    await pickWeekAndWrite(page);
    await page.getByRole('button', { name: 'Send booking request' }).click();

    const step = page.locator('.dr-step-dialog--phone');
    await expect(step).toBeVisible();
    // The refusal is answered with the step, never printed as an error banner.
    await expect(page.locator('.booking-page__error')).toHaveCount(0);
    expect(callsTo(calls, 'POST', '/api/bookings')).toHaveLength(1);

    await fillPhoneAndSave(page, 'Save and send request');

    await expect(page.getByRole('heading', { name: 'Request sent to Olive!' })).toBeVisible();
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(1);
    expect(callsTo(calls, 'POST', '/api/bookings')).toHaveLength(2);
  });

  // Journey 8b
  test('a 500 on booking creation never opens the phone step and is not re-sent automatically', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, {
      me: e2eUser(),
      listingDetails: e2eListingDetails(),
      createBooking: { status: 500, body: { title: 'Boom', status: 500 } },
    });

    await pickWeekAndWrite(page);
    await page.getByRole('button', { name: 'Send booking request' }).click();

    await expect(page.locator('.booking-page__error')).toBeVisible();
    await expect(page.locator('.dr-step-dialog--phone')).toHaveCount(0);
    expect(callsTo(calls, 'POST', '/api/bookings')).toHaveLength(1);
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(0);
  });

  // Journey 8c - the listing side of the same server fallback (the wizard re-sends once).
  test('server fallback: a 409 listing.phone_required opens the step and, after saving, resends exactly once', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockTiles(page);
    await mockApi(page, {
      me: e2eUser(),
      createListing: {
        sequence: [
          { status: 409, body: phoneRequired('listing.phone_required') },
          { status: 200, body: { id: 'listing-created-e2e-1', status: 'PendingApproval' } },
        ],
      },
    });

    await page.goto('/listings/create');
    await page.locator('#wizard-images-input').setInputFiles(
      [1, 2, 3].map((n) => ({
        name: `toy-${n}.png`,
        mimeType: 'image/png',
        buffer: STUB_PNG_BUFFER,
      })),
    );
    await page.getByRole('button', { name: 'Continue to basics' }).click();
    await page.getByLabel('Toy name').fill('E2E Wooden Train Set');
    await page.locator('.cs-trigger').click();
    await page.locator('.cs-option').first().click();
    await page
      .getByLabel('Description')
      .fill('A sturdy wooden train set with all pieces present and freshly cleaned.');
    await page.getByRole('button', { name: 'Continue to pricing' }).click();
    await page.locator('#wz-price').fill('25');
    await page.locator('#wz-compensation').fill('45000');
    await page.getByRole('button', { name: 'Continue to safety' }).click();
    await page.getByRole('button', { name: 'Continue to preview' }).click();
    await page.getByRole('button', { name: 'Submit for review' }).click();

    const step = page.locator('.dr-step-dialog--phone');
    await expect(step).toBeVisible();
    expect(callsTo(calls, 'POST', '/api/listings')).toHaveLength(1);

    await fillPhoneAndSave(page, 'Save and publish');

    await expect.poll(() => callsTo(calls, 'POST', '/api/listings')).toHaveLength(2);
    await expect(step).toBeHidden();
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(1);
  });
});
