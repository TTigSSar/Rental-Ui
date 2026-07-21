import type { Page, Route } from '@playwright/test';

import { STUB_PNG_BUFFER } from './stub-image';

/**
 * Intercepts every OpenStreetMap tile request (`shared/ui/map/map.component.ts`
 * hardcodes `tile.openstreetmap.org`) and serves a stub PNG instead. Leaflet
 * itself is the REAL library (dynamically imported, not mocked) — only the
 * network call to the volunteer-funded tile host is stubbed, so this suite
 * never depends on nor hammers a third party.
 *
 * Journeys assert against `count()` (did a tile request fire, or not) —
 * never against rendered pixels, which this stub doesn't attempt to look like
 * a real map tile.
 */
export interface TileInterceptor {
  /** Number of tile requests served since interception started. */
  count(): number;
}

export async function mockTiles(page: Page): Promise<TileInterceptor> {
  let hits = 0;
  await page.route('https://tile.openstreetmap.org/**', (route: Route) => {
    hits += 1;
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: STUB_PNG_BUFFER,
    });
  });
  return { count: () => hits };
}
