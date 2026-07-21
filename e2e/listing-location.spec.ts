import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eListingDetails } from './support/fixtures';

/**
 * Critical journey (P1-8): the listing-detail location block always shows the
 * district + city as text, and defers loading the OpenStreetMap tile layer
 * until the visitor explicitly asks for it ("tap to load the map"). We're on
 * volunteer-funded OSM tiles, so silently fetching one on every page view
 * would be a real, silent regression — exactly the kind this suite exists to
 * catch (M-013: the layer every test fakes is the layer nobody tests).
 *
 * Deliberately NOT covered here: which lat/lng a given caller actually
 * receives (the owner's exact pin vs. a non-owner's geohash-fuzzed centroid).
 * That privacy gate lives entirely in the backend and is already covered by
 * xUnit tests (`ListingDetailCoordinatePrivacyTests`,
 * `ListingDetailAddressRevealTests`). With the backend stubbed at the network
 * layer here, an assertion about it would only prove this fixture echoes back
 * whatever the test itself wrote — it wouldn't protect anything real.
 */
test.describe('Listing detail — approximate location', () => {
  test('shows district + city text and defers the map until requested', async ({ page }) => {
    const tiles = await mockTiles(page);
    await mockApi(page, { listingDetails: e2eListingDetails() });

    await page.goto('/listings/listing-e2e-1');

    const place = page.locator('.listing-location__place');
    await expect(place).toContainText('Kentron');
    await expect(place).toContainText('Yerevan');

    // No tile request before the visitor asks for the map — the button to
    // ask hasn't even rendered a map yet, only the placeholder + CTA.
    await expect(page.locator('.listing-location__show-map-btn')).toBeVisible();
    expect(tiles.count()).toBe(0);

    await page.locator('.listing-location__show-map-btn').click();

    // Requesting the map instantiates the real Leaflet tile layer, which
    // fetches at least one (stubbed) tile.
    await expect.poll(() => tiles.count()).toBeGreaterThan(0);
  });

  test('falls back to text only when the listing has no coordinates', async ({ page }) => {
    const tiles = await mockTiles(page);
    await mockApi(page, {
      listingDetails: e2eListingDetails({ latitude: null, longitude: null }),
    });

    await page.goto('/listings/listing-e2e-1');

    const place = page.locator('.listing-location__place');
    await expect(place).toContainText('Kentron');
    await expect(place).toContainText('Yerevan');

    // The pin is optional (P1-8 spec) — no coordinates means no map
    // affordance at all, not even the "show map" button.
    await expect(page.locator('.listing-location__show-map-btn')).toHaveCount(0);
    expect(tiles.count()).toBe(0);
  });
});
