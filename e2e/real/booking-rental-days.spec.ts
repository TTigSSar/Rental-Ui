import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  ACCOUNTS,
  API_URL,
  TOY_KITCHEN,
  apiLogin,
  assertDockerStack,
  releaseListingForRenter,
} from '../support/real-stack';

/**
 * ADR-043 regression net, API layer, real stack (real ASP.NET Core + real SQL
 * Server). Confirmed bug it guards: today -> tomorrow was charged 2 days
 * (inclusive end - start + 1) and minRentalDays was never enforced.
 *
 * Why the real stack and not the backend suite: the night-based overlap rule
 * is enforced in the SQL-backed atomic create (TryCreateBookingAsync); the
 * backend's SQLite "integration" tests cannot prove it (M-013 pattern).
 *
 * API-only on purpose (cheapest reliable layer): the UI half (1-day chip
 * costs 1 x price, disabled chips for minRentalDays) is pinned in the mocked
 * tier, e2e/listing-booking.spec.ts. Every booking is created far in the
 * future and cancelled in `finally`; the listing's minRentalDays is restored
 * to null in `finally` AND self-healed at the start (crashed-run safety).
 */

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A date `monthsAhead` months out, day `day` (1..28), as YYYY-MM-DD (UTC-safe, no DST maths). */
function isoInMonths(monthsAhead: number, day: number): string {
  const d = new Date();
  const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + monthsAhead) / 12);
  const m = ((d.getUTCMonth() + monthsAhead) % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function setMinRentalDays(
  request: APIRequestContext,
  ownerToken: string,
  value: number | null,
): Promise<void> {
  const res = await request.patch(`${API_URL}/api/listings/${TOY_KITCHEN.id}`, {
    headers: auth(ownerToken),
    data: { minRentalDays: value },
  });
  expect(res.ok(), `PATCH minRentalDays=${value} must succeed (${res.status()} ${await res.text()})`).toBe(
    true,
  );
}

test.describe('Booking rental days (ADR-043, real stack)', () => {
  test('one night costs 1 x price, back-to-back is accepted, a real overlap is refused, minimum rental is enforced', async ({
    request,
  }) => {
    await assertDockerStack(request);
    await releaseListingForRenter(request, TOY_KITCHEN.id);

    const renterToken = await apiLogin(request, ACCOUNTS.renter);
    const ownerToken = await apiLogin(request, ACCOUNTS.owner);
    await setMinRentalDays(request, ownerToken, null); // self-heal a crashed run

    // Fixed window 8 months out (lifecycle uses +2 and +5 months; home-point uses another listing).
    const d10 = isoInMonths(8, 10);
    const d11 = isoInMonths(8, 11);
    const d12 = isoInMonths(8, 12);
    const d13 = isoInMonths(8, 13);
    const created: string[] = [];

    const book = (startDate: string, endDate: string) =>
      request.post(`${API_URL}/api/bookings`, {
        headers: auth(renterToken),
        data: { listingId: TOY_KITCHEN.id, startDate, endDate },
        failOnStatusCode: false,
      });

    try {
      // 1. Pickup d10, return d11 = 1 rental day (inclusive counting charged 2).
      const first = await book(d10, d11);
      expect(first.status(), `first booking: ${await first.text()}`).toBeLessThan(300);
      const firstBody = (await first.json()) as { id: string; totalPrice: number };
      created.push(firstBody.id);
      expect(firstBody.totalPrice, 'd10 -> d11 is ONE rental day').toBe(TOY_KITCHEN.pricePerDay);

      // 2. Back-to-back: pickup on the previous booking's return day is free (night-based overlap).
      const backToBack = await book(d11, d12);
      expect(backToBack.status(), `back-to-back on the return day: ${await backToBack.text()}`).toBeLessThan(300);
      const b2b = (await backToBack.json()) as { id: string; totalPrice: number };
      created.push(b2b.id);
      expect(b2b.totalPrice).toBe(TOY_KITCHEN.pricePerDay);

      // 3. A genuine night overlap is still refused (d10 -> d12 covers nights d10 and d11).
      const overlap = await book(d10, d12);
      expect(overlap.status(), 'a window covering already-booked nights must conflict').toBe(409);

      // 4. Minimum rental: below -> 400 booking.below_min_rental; exactly at minimum -> accepted.
      await setMinRentalDays(request, ownerToken, 3);
      const tooShort = await book(d12, d13);
      expect(tooShort.status()).toBe(400);
      expect(((await tooShort.json()) as { errorCode?: string }).errorCode).toBe(
        'booking.below_min_rental',
      );
      const atMin = await book(d12, isoInMonths(8, 15)); // 3 rental days
      expect(atMin.status(), `at-minimum booking: ${await atMin.text()}`).toBeLessThan(300);
      const atMinBody = (await atMin.json()) as { id: string; totalPrice: number };
      created.push(atMinBody.id);
      expect(atMinBody.totalPrice).toBe(3 * TOY_KITCHEN.pricePerDay);
    } finally {
      await setMinRentalDays(request, ownerToken, null);
      for (const id of created) {
        await request.post(`${API_URL}/api/bookings/${id}/cancel`, {
          headers: auth(renterToken),
          failOnStatusCode: false,
        });
      }
    }
  });
});
