import type { Page, Route } from '@playwright/test';

import { environment } from '../../src/environments/environment';
import { STUB_PNG_BUFFER } from './stub-image';

/**
 * Intercepts every map tile request and serves a stub PNG instead. Leaflet
 * itself is the REAL library (dynamically imported, not mocked) — only the
 * network call to whichever tile host is actually configured is stubbed, so
 * this suite never depends on nor hammers a third party.
 *
 * The host to intercept is derived from `environment.tileProvider`
 * (`src/environments/environment.ts`), the SAME config
 * `shared/ui/map/map.component.ts`'s `resolveTileSource()` reads — not
 * hardcoded here — so this stays correct whether or not a provider API key
 * is configured for the environment the dev server (`npm start`, used by
 * `webServer` in `playwright.config.ts`) was started with: empty key ->
 * `tile.openstreetmap.org` fallback; key set -> the configured provider's
 * origin (MapTiler by default).
 *
 * Journeys assert against `count()` (did a tile request fire, or not) —
 * never against rendered pixels, which this stub doesn't attempt to look like
 * a real map tile.
 */
export interface TileInterceptor {
  /** Number of tile requests served since interception started. */
  count(): number;
}

/** Mirrors the OSM fallback in `map.component.ts`'s `resolveTileSource()`. */
const OSM_FALLBACK_ORIGIN = 'https://tile.openstreetmap.org';

function activeTileOrigin(): string {
  const { apiKey, urlTemplate } = environment.tileProvider;
  if (!apiKey) return OSM_FALLBACK_ORIGIN;
  const sample = urlTemplate
    .replace('{z}', '0')
    .replace('{x}', '0')
    .replace('{y}', '0')
    .replace('{key}', apiKey);
  return new URL(sample).origin;
}

export async function mockTiles(page: Page): Promise<TileInterceptor> {
  let hits = 0;
  await page.route(`${activeTileOrigin()}/**`, (route: Route) => {
    hits += 1;
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: STUB_PNG_BUFFER,
    });
  });
  return { count: () => hits };
}
