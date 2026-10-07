import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eHomePoint, e2eUser } from './support/fixtures';
import { STUB_PNG_BUFFER } from './support/stub-image';
import { homePointDerivedFieldsIn } from '../src/testing/listing-write-contract';

/**
 * Critical journey (home-point model): where a listing's location comes from.
 *
 * This spec used to assert the opposite thing — that a pin confirmed in the
 * wizard's Step 3 picker reached `POST /api/listings` as `latitude`/`longitude`.
 * That contract no longer exists: the backend REMOVED `latitude`, `longitude`,
 * `districtId`, `city` and `country` from `CreateListingRequest` and derives all
 * five from the owner's home point. A client that still sent them would be
 * silently ignored by the serializer, which is the dangerous failure mode —
 * accepted-looking and never applied — so the two halves of the new reality are
 * pinned here instead:
 *
 *  1. With a home point, the wizard completes and the create payload carries
 *     NONE of the five fields (and `addressLine: null`, which ADR-017 settled).
 *  2. Without one, the wizard does not let the owner fill five steps and fail
 *     at the end: it gates before step 1, saves the point via
 *     `PUT /api/auth/me/home-point`, and then continues.
 */
test.describe('Create listing — location comes from the home point', () => {
  async function completeWizard(page: import('@playwright/test').Page): Promise<void> {
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

    // ── Step 3 — Pricing & Location ──
    await page.locator('#wz-price').fill('25');
    // Loss & damage compensation is required on create (1,000–10,000,000 ֏).
    // Without this fill, `goToNextStep()` silently refuses to advance past step
    // 3 and "Continue to safety" below never fires — the same "looks like a
    // hang" trap MIN_PHOTOS sets.
    await page.locator('#wz-compensation').fill('45000');
    await page.getByRole('button', { name: 'Continue to safety' }).click();

    // ── Step 4 — Safety (nothing required) ──
    await page.getByRole('button', { name: 'Continue to preview' }).click();
  }

  test('step 3 shows a read-only Pickup area and the payload carries none of the five derived fields', async ({
    page,
  }) => {
    // Seeded token so the (authGuard-protected) /listings/create route admits us.
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    // The pickup-area card draws a real Leaflet map — stub the tile host so it
    // never hits the real (volunteer-funded) service.
    await mockTiles(page);
    await mockApi(page, { me: e2eUser({ homePoint: e2eHomePoint() }) });

    await page.goto('/listings/create');
    // An owner WITH a home point goes straight into the wizard; no gate.
    await expect(page.locator('.wizard--gate')).toBeHidden();

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

    // Step 3's location block is now a read-only card: no city input, no
    // district select, no per-listing pin picker.
    await expect(page.locator('app-pickup-area-card')).toBeVisible();
    await expect(page.locator('.pickup-card__city-value')).toContainText('Yerevan');
    await expect(page.locator('[formcontrolname="city"]')).toHaveCount(0);
    await expect(page.locator('#wz-district')).toHaveCount(0);

    await page.locator('#wz-price').fill('25');
    await page.locator('#wz-compensation').fill('45000');
    await page.getByRole('button', { name: 'Continue to safety' }).click();
    await page.getByRole('button', { name: 'Continue to preview' }).click();

    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().endsWith('/api/listings') && req.method() === 'POST'),
      page.getByRole('button', { name: 'Submit for review' }).click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    // The entire point of this assertion: the fields the backend dropped must
    // not be in the payload. Re-adding any of them would typecheck, ship, and
    // be ignored by the server. Checked as a key set against the shared
    // constant in src/testing/listing-write-contract.ts — the same one the
    // component spec and the update-path guards use, so a sixth derived field
    // added there is covered here without touching this file.
    expect(homePointDerivedFieldsIn(body)).toEqual([]);
    // ...while the fields that DO still travel are unaffected.
    expect(body['addressLine']).toBeNull();
    expect(body['compensationAmount']).toBe(45000);
    expect(body['title']).toBe('E2E Wooden Train Set');
  });

  test('without a home point the wizard gates before step 1, saves the point, then continues', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    await mockTiles(page);
    await mockApi(page, { me: e2eUser({ homePoint: null }) });

    await page.goto('/listings/create');

    // The gate, not step 1: a listing with no location is unplaceable, and the
    // backend refuses to create one (409 `listing.home_point_required`).
    const gate = page.locator('.wizard--gate');
    await expect(gate).toBeVisible();
    await expect(page.locator('#wizard-images-input')).toBeHidden();

    // Its primary action starts disabled — the map opens on the city centre and
    // nobody should save Republic Square because that is where the crosshair
    // happened to be.
    const cta = gate.getByRole('button', { name: 'Save and continue' });
    await expect(cta).toBeDisabled();

    // A deliberate pan. Wait for Leaflet to have actually taken over the
    // container first (`leaflet-container` is the class it adds on init) —
    // before that, mouse events land on a plain div and pan nothing, which
    // reads as "the gate never unlocks" rather than as a timing problem.
    const surface = gate.locator('app-home-point-map .app-map__surface');
    await expect(surface).toHaveClass(/leaflet-container/);
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 - 70, box!.y + box!.height / 2 - 45, {
      steps: 10,
    });
    await page.mouse.up();

    await expect(cta).toBeEnabled();

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/auth/me/home-point') && req.method() === 'PUT',
      ),
      cta.click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['latitude', 'longitude']);
    expect(Number(body['latitude'])).toBeGreaterThan(39);
    expect(Number(body['latitude'])).toBeLessThan(42);

    // The gate gives way to step 1 in place — no navigation, nothing lost.
    await expect(gate).toBeHidden();
    await expect(page.locator('#wizard-images-input')).toBeAttached();
  });

  test('"Not now" on the gate leaves the wizard without creating anything', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    await mockTiles(page);
    await mockApi(page, { me: e2eUser({ homePoint: null }) });

    await page.goto('/listings/create');
    const gate = page.locator('.wizard--gate');
    await expect(gate).toBeVisible();

    const writes: string[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') writes.push(`${req.method()} ${req.url()}`);
    });

    await gate.getByRole('button', { name: 'Not now' }).click();

    // No draft is created, so there is nothing to save and nothing is sent.
    await expect(gate).toBeHidden();
    expect(writes).toHaveLength(0);
  });

  /**
   * The server can still refuse a create for a missing home point — the point
   * was removed in another tab, say. That used to surface as a generic red
   * banner on step 5 with nothing the owner could do about it.
   */
  test('a 409 listing.home_point_required re-raises the gate instead of a dead-end banner', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    await mockTiles(page);
    await mockApi(page, {
      me: e2eUser({ homePoint: e2eHomePoint() }),
      createListing: {
        status: 409,
        body: {
          type: 'urn:rental:error:listing.home_point_required',
          title: 'A home point is required before listing a toy.',
          status: 409,
          errorCode: 'listing.home_point_required',
        },
      },
    });

    await page.goto('/listings/create');
    await completeWizard(page);
    await page.getByRole('button', { name: 'Submit for review' }).click();

    await expect(page.locator('.wizard--gate')).toBeVisible();
    await expect(page.locator('.wizard__error-banner')).toHaveCount(0);
  });
});
