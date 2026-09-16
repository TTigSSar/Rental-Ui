import { expect, test } from '@playwright/test';

import { ACCOUNTS, API_URL, assertDockerStack, loginViaDialog } from '../support/real-stack';
import { STUB_PNG_BUFFER } from '../support/stub-image';

/**
 * Regression coverage for the create-listing wizard's two-request photo
 * pipeline: `POST /api/listings` creates the listing, and only once that
 * resolves does the client fire a second, independent multipart
 * `POST /api/listings/{id}/images` (`ListingsApiService.uploadListingImages`,
 * triggered from `ListingsEffects.createListing$` — see
 * `Rental-Ui/src/app/features/listings/store/listings.effects.ts`). Nothing
 * in the existing suites proves those two requests are actually sequenced
 * and that the second one's result lands on the listing:
 *
 * - The mocked tier (`e2e/create-listing-location.spec.ts`) stubs both calls
 *   at the network layer (`api-mock.ts`) and only ever asserts the first
 *   request's *body* (the coordinate payload) — it can't prove anything
 *   about upload sequencing or server-side persistence because there is no
 *   server.
 * - Backend "integration" tests run against SQLite, never the real file
 *   storage + SQL Server combination the docker stack uses.
 *
 * This is the exact M-013 shape: chat upload was 100% broken in production
 * while 453 tests stayed green, because every layer that touched storage was
 * faked. This spec closes the equivalent gap for listing photos by going
 * through the real wizard, the real API, and the real SQL Server-backed
 * image records — asserting on the wire response of the second request (not
 * a timeout, not client-side state) and then re-reading the listing back
 * through a fresh, unrelated `GET /api/listings/{id}` call.
 *
 * One-time investigation note (2026-09-15, throwaway spec, deleted after use):
 * a scripted check that read `images: []` off the listing immediately after
 * the create POST resolved was racing the second (image) request, not
 * observing a real bug — this spec avoids that trap by waiting on the
 * response of the images POST itself before asserting anything.
 *
 * Selectors follow `e2e/create-listing-location.spec.ts` (the mocked tier's
 * sibling journey) for steps 1–3, updated for the ADR-017 multi-select
 * delivery control (`role="checkbox"` buttons in a `role="group"`, not the
 * old single-select). Gotcha carried over: `MIN_PHOTOS = 3` in
 * `create-listing-form.component.ts` — fewer than 3 photos and "Continue to
 * basics" silently never advances (looks like a hang, not a validation
 * error).
 *
 * Determinism: creates one listing with a unique, timestamped title and
 * archives it in `afterEach` (via the real
 * `POST /api/listings/{id}/archive` endpoint — works from any
 * non-Archived status, including the PendingApproval state a freshly
 * created, never-moderated listing sits in) so reruns never accumulate
 * PendingApproval listings and — since `archive` moves it out of every
 * status the public `GET /api/listings` endpoint returns from anyway — it
 * can never leak into `listings-search-filter.spec.ts`'s counts even before
 * cleanup runs.
 *
 * Login budget: `AuthController`'s `AuthPolicy` rate limit (5 requests/min/IP,
 * shared across every real-stack spec file — see `map-pins-privacy.spec.ts`)
 * is why this spec logs in exactly once, through the UI dialog, and reuses
 * that session's JWT (read out of `localStorage`'s `auth_token` key — see
 * `AuthTokenService`) for the follow-up API calls instead of a second
 * `apiLogin`.
 */
test.describe('Create listing — photo upload (real stack)', () => {
  let ownerToken: string | null = null;
  let createdListingId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (!createdListingId || !ownerToken) return;
    // Best-effort: archive so the listing never lingers as PendingApproval
    // and can't affect other real-stack specs' counts. A failure here (e.g.
    // the test itself failed before the listing was even created) must not
    // mask the real test result, so no assertion on the outcome.
    await request.post(`${API_URL}/api/listings/${createdListingId}/archive`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      failOnStatusCode: false,
    });
  });

  test('photos picked in the wizard are attached to the created listing', async ({
    page,
    request,
  }) => {
    await test.step('guard: docker stack is what is actually serving :4200/:8080', async () => {
      await assertDockerStack(request);
    });

    await test.step('log in as owner', async () => {
      await loginViaDialog(page, ACCOUNTS.owner);
    });

    ownerToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(ownerToken, 'owner JWT must be in localStorage after a successful login').toBeTruthy();

    const uniqueTitle = `QA Photo Upload ${Date.now()}`;

    await test.step('wizard step 1 — 3 deterministic photos clear MIN_PHOTOS', async () => {
      await page.goto('/listings/create');
      await page.locator('#wizard-images-input').setInputFiles(
        [1, 2, 3].map((n) => ({
          name: `toy-${n}.png`,
          mimeType: 'image/png',
          buffer: STUB_PNG_BUFFER,
        })),
      );
      await page.getByRole('button', { name: 'Continue to basics' }).click();
    });

    await test.step('wizard step 2 — basics', async () => {
      await page.getByLabel('Toy name').fill(uniqueTitle);
      await page.locator('.cs-trigger').click();
      await page.locator('.cs-option').first().click();
      await page
        .getByLabel('Description')
        .fill('QA real-stack regression fixture — proves wizard photos reach the listing.');
      await page.getByRole('button', { name: 'Continue to pricing' }).click();
    });

    await test.step('wizard step 3 — pricing, map pin, delivery', async () => {
      await page.locator('#wz-price').fill('25');
      await page.getByLabel('City').fill('Yerevan');

      await page.getByRole('button', { name: 'Show on map' }).click();
      await page.getByRole('button', { name: 'Confirm location' }).click();
      // Confirming closes the picker and swaps the CTA for the pin preview +
      // "Change" affordance — proof the pin landed in the form.
      await expect(page.getByRole('button', { name: 'Change' })).toBeVisible();

      // ADR-017 multi-select delivery: 'Pickup' is selected by default (the
      // form control never allows an empty selection), so this click is a
      // deliberate no-op that documents the step rather than a state change —
      // it still leaves >=1 delivery option selected, which is all the
      // create payload requires.
      await page.getByRole('checkbox', { name: /Pickup from me/i }).click();

      await page.getByRole('button', { name: 'Continue to safety' }).click();
    });

    await test.step('wizard step 4 — safety (nothing required)', async () => {
      await page.getByRole('button', { name: 'Continue to preview' }).click();
    });

    interface CreateListingResponse {
      readonly id: string;
    }
    interface ListingImageResponse {
      readonly id: string;
      readonly url: string;
    }

    const [createResponse, imagesResponse] = await test.step(
      'wizard step 5 — submit, capturing BOTH real requests the effect fires',
      () =>
        Promise.all([
          page.waitForResponse(
            (res) => res.url().endsWith('/api/listings') && res.request().method() === 'POST',
          ),
          // The second, independent multipart request — this is the one
          // M-013-class gap this spec exists to close. Matched by path shape
          // (…/api/listings/{id}/images), not a hardcoded id, since the id
          // only exists once the first request above resolves.
          page.waitForResponse(
            (res) =>
              /\/api\/listings\/[0-9a-fA-F-]+\/images$/.test(new URL(res.url()).pathname) &&
              res.request().method() === 'POST',
          ),
          page.getByRole('button', { name: 'Submit for review' }).click(),
        ]),
    );

    expect(createResponse.ok(), 'POST /api/listings must succeed').toBe(true);
    const created = (await createResponse.json()) as CreateListingResponse;
    createdListingId = created.id;

    expect(
      imagesResponse.ok(),
      `POST /api/listings/${created.id}/images must succeed (status ${imagesResponse.status()})`,
    ).toBe(true);
    const uploadedImages = (await imagesResponse.json()) as ListingImageResponse[];
    expect(uploadedImages, 'the images upload response itself must report all 3 photos').toHaveLength(3);

    await test.step('verify via a FRESH, unrelated API call — not client state', async () => {
      const detailRes = await request.get(`${API_URL}/api/listings/${created.id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(detailRes.ok(), 'GET /api/listings/{id} as owner must succeed').toBe(true);
      const detail = (await detailRes.json()) as { images: ListingImageResponse[] };
      expect(detail.images, 'listing must have exactly the 3 photos picked in the wizard').toHaveLength(
        3,
      );

      const imageRes = await request.get(`${API_URL}${detail.images[0].url}`);
      expect(
        imageRes.status(),
        `uploaded image must actually be served (${detail.images[0].url})`,
      ).toBe(200);
    });
  });
});
