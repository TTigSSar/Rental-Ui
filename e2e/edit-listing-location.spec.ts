import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eHomePoint, e2eListingDetails, e2eListingImages, e2eUser } from './support/fixtures';
import {
  LISTING_UPDATE_WRITABLE_FIELDS,
  homePointDerivedFieldsIn,
} from '../src/testing/listing-write-contract';

/**
 * Critical journey, UPDATE side (home-point model): what an edit is allowed to
 * change. The exact mirror of `create-listing-location.spec.ts`, which pins the
 * same contract on `POST /api/listings`.
 *
 * `latitude`, `longitude`, `districtId`, `city` and `country` were removed from
 * `UpdateListingRequest` as well as from create: a listing's location is its
 * owner's home point, and update can no longer touch any part of it. A client
 * that still sends one of them is SILENTLY IGNORED by the server — unknown JSON
 * members bind to nothing, so the PATCH returns success and nothing is applied.
 * Accepted-looking and never applied is the worst failure shape available,
 * because the client looks like it is working.
 *
 * Why this spec exists at the wire tier at all, when
 * `edit-listing-page.component.spec.ts` already guards `onSave`: the unit guard
 * checks the OBJECT handed to `MyListingsApiService.updateListing`. This one
 * checks the JSON that actually leaves the browser — the whole real wizard, the
 * real prefill, the real HTTP client, real serialization. The named risk is the
 * one M-013 already charged for: the layer every test fakes is the layer nobody
 * tests, and the create side carries exactly this pair of tiers for exactly
 * this reason. `country` survived THREE separate removal waves on the update
 * side while create was double-guarded and update had nothing.
 */
test.describe('Edit listing — update cannot change the home-point-derived location', () => {
  const LISTING_ID = 'listing-e2e-1';

  /** `GET /api/listings/mine` wire shape, extended fields included (the edit
   *  page prefills the wizard from this, not from the detail endpoint). */
  function ownedListing() {
    return {
      id: LISTING_ID,
      title: 'E2E Wooden Train Set',
      city: 'Yerevan',
      pricePerDay: 1500,
      primaryImageUrl: null,
      status: 'Approved',
      createdAt: '2026-01-01T00:00:00.000Z',
      rejection: null,
      description: 'A sturdy wooden train set with every piece present and freshly cleaned.',
      categoryId: 'cat-e2e-1',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      hygieneNotes: 'Wiped down after every rental.',
      safetyNotes: 'Small parts, not for under-3s.',
      // A real amount on file, so the amber "amount missing" notice stays down
      // and step 3 is already valid — this journey is about the payload, not
      // about the compensation gate (that one is its own spec).
      compensationAmount: 45000,
      minRentalDays: 2,
      deliveryType: 'Courier',
      deliveryTypes: ['Courier'],
    };
  }

  test('the PATCH body carries none of the derived fields and exactly the writable set', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
    // Step 3 draws the read-only Pickup-area card on a real Leaflet map — stub
    // the tile host so the suite never hits the real service.
    await mockTiles(page);
    await mockApi(page, {
      me: e2eUser({ homePoint: e2eHomePoint() }),
      myListings: [ownedListing()],
      // The edit page fetches the full listing for its image set; two images
      // keep the gallery non-empty so Save isn't gated on "keep one photo",
      // and leaving the order untouched means no delete/upload/reorder call
      // follows the PATCH.
      listingDetails: e2eListingDetails({ id: LISTING_ID, images: e2eListingImages(2) }),
    });

    await page.goto(`/my-listings/${LISTING_ID}/edit`);

    // Edit mode never raises the home-point gate (an existing listing is
    // already placed), so the wizard opens straight on step 1.
    await expect(page.locator('.wizard--gate')).toBeHidden();
    const titleField = page.getByLabel('Toy name');

    await page.getByRole('button', { name: 'Continue to basics' }).click();
    await expect(titleField).toBeVisible();

    // Make a REAL edit: the assertions below must not be satisfiable by an
    // empty body or by Save quietly doing nothing.
    await titleField.fill('E2E Wooden Train Set (edited)');
    await page.getByRole('button', { name: 'Continue to pricing' }).click();

    // Step 3's location block is read-only in edit mode too: no city input, no
    // district select, no per-listing pin picker.
    await expect(page.locator('app-pickup-area-card')).toBeVisible();
    await expect(page.locator('[formcontrolname="city"]')).toHaveCount(0);
    await expect(page.locator('#wz-district')).toHaveCount(0);

    await page.locator('#wz-price').fill('1800');
    await page.getByRole('button', { name: 'Continue to safety' }).click();
    await page.getByRole('button', { name: 'Continue to preview' }).click();

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith(`/api/listings/${LISTING_ID}`) && req.method() === 'PATCH',
      ),
      page.getByRole('button', { name: 'Save changes' }).click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;

    // The guard. A key set over the shared constant in
    // src/testing/listing-write-contract.ts — the same constant the create
    // guards use — so a sixth derived field added there is covered here by
    // construction rather than by someone remembering this file.
    expect(homePointDerivedFieldsIn(body)).toEqual([]);
    // Exact set, not a subset: a "no derived fields" check alone would pass
    // just as happily on an empty body, and any newly writable field has to be
    // added to the constant consciously.
    expect(Object.keys(body).sort()).toEqual([...LISTING_UPDATE_WRITABLE_FIELDS].sort());

    // The edits travelled, and the untouched fields travelled unchanged.
    expect(body['title']).toBe('E2E Wooden Train Set (edited)');
    expect(body['pricePerDay']).toBe(1800);
    expect(body['description']).toBe(
      'A sturdy wooden train set with every piece present and freshly cleaned.',
    );
    expect(body['compensationAmount']).toBe(45000);
    expect(body['minRentalDays']).toBe(2);
    expect(body['condition']).toBe('Good');
    expect(body['deliveryType']).toBe('Courier');
    expect(body['deliveryTypes']).toEqual(['Courier']);
    expect(body['ageFromMonths']).toBe(24);
    expect(body['ageToMonths']).toBe(60);
  });
});
