import { expect, test, type Request } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eListing } from './support/fixtures';

/**
 * Regression for Trello #80: "After setting filter by location there is no
 * functional to reset it."
 *
 * The radius filter is split across two independent stores that used to have
 * no shared reset path: `radiusKm` lives in the URL, but the renter's
 * reference point (`ListingsState.originCoords`/`originSource`) is
 * session-only NgRx state that is NEVER reflected in the URL. Before the fix
 * there was no action that unset the origin at all — "Clear all" and the
 * radius chip's × only ever touched `radiusKm`. Worse,
 * `RadiusOriginFilterComponent`'s auto-default effect (`defaultRequested`,
 * an instance-local flag) re-emitted the 1 km default on every NEW instance
 * of the widget as long as an origin still existed in the store — so even a
 * renter who left `/listings` and came back (a fresh component instance,
 * same never-cleared store) got `radiusKm=1` silently re-applied. There was
 * no way out of the location filter short of clearing all site data.
 *
 * Unit coverage already added for this fix (`listings.reducer.spec.ts`,
 * `radius-origin-filter.component.spec.ts`, `listings-page.component.spec.ts`)
 * proves the reducer and the button's dispatch/emit wiring in isolation, all
 * against `MockStore` (dispatched actions never reach a real reducer) and a
 * single component instance — it does not, and structurally cannot, prove
 * the cross-component/cross-navigation failure mode above: a REAL NgRx store
 * that survives route navigation, feeding a REAL widget instance that gets
 * destroyed and re-created by the REAL router. That is exactly what this
 * journey drives, at the cheapest layer that can see it — the mocked tier,
 * because this bug is pure UI wiring (routing + NgRx + component lifecycle),
 * not a backend behaviour.
 */
test.describe('Listings — clearing the radius/origin filter (Trello #80)', () => {
  function isListingsGet(req: Request): boolean {
    if (req.method() !== 'GET') return false;
    return new URL(req.url()).pathname.endsWith('/api/listings');
  }

  test('Remove clears the URL and the API request, and the clear survives leaving and returning to /listings', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 40.18, longitude: 44.51 });
    await mockTiles(page);
    await mockApi(page, { listings: [e2eListing()] });

    // ── Initial load: no location filter yet ──────────────────────────
    const initialLoad = page.waitForRequest(isListingsGet);
    await page.goto('/listings');
    const initialReq = await initialLoad;
    const initialParams = new URL(initialReq.url()).searchParams;
    expect(initialParams.has('radiusKm')).toBe(false);
    expect(initialParams.has('originLat')).toBe(false);

    // ── Set an origin via "Detect my location" (desktop sidebar widget).
    // The auto-default effect fires as soon as originCoords lands, emitting
    // the 1 km default, which the page merge-navigates into the URL. ──
    const withOrigin = page.waitForRequest(
      (req) => isListingsGet(req) && new URL(req.url()).searchParams.has('radiusKm'),
    );
    await page.getByRole('button', { name: 'Detect my location' }).click();
    const originReq = await withOrigin;
    const originParams = new URL(originReq.url()).searchParams;
    expect(originParams.get('radiusKm')).toBe('1');
    expect(originParams.has('originLat')).toBe(true);
    expect(originParams.has('originLng')).toBe(true);
    await expect(page).toHaveURL(/radiusKm=1/);

    // ── Click Remove — must drop BOTH the URL param and the session-only
    // origin behind it, in the same request cycle. ──
    const removeBtn = page.locator('.rof__edit--remove');
    await expect(removeBtn).toBeVisible();
    const afterRemove = page.waitForRequest(
      (req) => isListingsGet(req) && !new URL(req.url()).searchParams.has('radiusKm'),
    );
    await removeBtn.click();
    const removedReq = await afterRemove;
    const removedParams = new URL(removedReq.url()).searchParams;
    expect(removedParams.has('radiusKm')).toBe(false);
    expect(removedParams.has('originLat')).toBe(false);
    expect(removedParams.has('originLng')).toBe(false);
    await expect(page).not.toHaveURL(/radiusKm/);

    // The widget must have fallen back to its "unset" state — the Remove
    // button (and the "Change" it sits next to) only render in geo/manual.
    await expect(page.getByRole('button', { name: 'Detect my location' })).toBeVisible();

    // ── Leave /listings entirely via real in-app navigation (never a
    // reload — a reload would drop the store and trivially "fix" the bug),
    // then come back the same way. This destroys and re-creates the
    // `RadiusOriginFilterComponent` instance while the NgRx store — which a
    // route change never tears down — is the thing under test: does the
    // now-cleared origin STAY cleared through that recreation. ──
    await page.getByRole('link', { name: 'DoRent home' }).click();
    await expect(page).toHaveURL('/');

    const returnLoad = page.waitForRequest(isListingsGet);
    await page.getByRole('link', { name: 'All toy categories' }).click();
    const returnReq = await returnLoad;
    await expect(page).toHaveURL(/\/listings/);

    // The exact regression: a fresh widget instance must NOT silently
    // re-apply the 1 km default just because it still exists in memory.
    await expect(page).not.toHaveURL(/radiusKm/);
    const returnParams = new URL(returnReq.url()).searchParams;
    expect(returnParams.has('radiusKm')).toBe(false);
    expect(returnParams.has('originLat')).toBe(false);
    expect(returnParams.has('originLng')).toBe(false);
  });
});
