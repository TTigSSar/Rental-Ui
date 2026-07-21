import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eUser } from './support/fixtures';
import { STUB_PNG_BUFFER } from './support/stub-image';

/**
 * Critical journey (P1-6): the create-listing wizard's Step 3 full-screen pin
 * picker is the ONLY way an owner's exact coordinate ever enters the system —
 * everything downstream (the backend's geohash-6 fuzzing for non-owners, the
 * point-in-polygon district derivation) only has a privacy story to tell if
 * the picker's confirmed pin actually reaches the create-listing request body.
 * That's the one thing this journey checks; it deliberately does not assert
 * anything about who else can see that coordinate afterwards (see
 * `listing-location.spec.ts`'s doc comment for why that's a backend-owned
 * concern already covered by xUnit tests).
 */
test.describe('Create listing — location pin', () => {
  test('confirms a pin in the Step 3 picker and submits it with the listing', async ({ page }) => {
    // Seeded token so the (authGuard-protected) /listings/create route admits us.
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    // The picker's map is real Leaflet — stub the tile host so it never hits
    // the real (volunteer-funded) OSM service.
    await mockTiles(page);
    await mockApi(page, { me: e2eUser() });

    await page.goto('/listings/create');

    // ── Step 1 — Photos: 3 synthetic images clear the MIN_PHOTOS gate ──
    await page.locator('#wizard-images-input').setInputFiles(
      [1, 2, 3].map((n) => ({
        name: `toy-${n}.png`,
        mimeType: 'image/png',
        buffer: STUB_PNG_BUFFER,
      })),
    );
    await page.getByRole('button', { name: 'Continue to basics' }).click();

    // ── Step 2 — Basics: title, category, description ──
    await page.getByLabel('Toy name').fill('E2E Wooden Train Set');
    await page.locator('.cs-trigger').click();
    await page.locator('.cs-option').first().click();
    await page
      .getByLabel('Description')
      .fill('A sturdy wooden train set with all pieces present and freshly cleaned.');
    await page.getByRole('button', { name: 'Continue to pricing' }).click();

    // ── Step 3 — Pricing & Location: required fields, then drop a pin via
    // the full-screen crosshair picker ──
    await page.locator('#wz-price').fill('25');
    await page.getByLabel('City').fill('Yerevan');

    await page.getByRole('button', { name: 'Set location on map' }).click();
    await page.getByRole('button', { name: 'Confirm location' }).click();

    // Confirming closes the picker and swaps the CTA for the pin preview +
    // "Change" affordance — proof the confirmed coordinate landed in the form.
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue to safety' }).click();

    // ── Step 4 — Safety (nothing required) ──
    await page.getByRole('button', { name: 'Continue to preview' }).click();

    // ── Step 5 — Preview & Submit: assert the coordinates travel with the
    // request, which is the entire contract this feature rests on ──
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().endsWith('/api/listings') && req.method() === 'POST'),
      page.getByRole('button', { name: 'Submit for review' }).click(),
    ]);

    const body = request.postDataJSON() as { latitude: number | null; longitude: number | null };
    // The picker's default centre (Republic Square, Yerevan — see
    // `YEREVAN_CENTER` in location-picker.component.ts) is a real, confirmable
    // coordinate: `confirm()` reads off whatever sits under the crosshair, and
    // panning is never required before it does. Asserting this default keeps
    // the journey deterministic — simulating a real Leaflet drag would add
    // flake risk (container-size timing) without protecting anything this
    // assertion doesn't already prove.
    expect(body.latitude).toBeCloseTo(40.1776, 3);
    expect(body.longitude).toBeCloseTo(44.5126, 3);
  });
});
