import type { Page, Route } from '@playwright/test';

import { environment } from '../../src/environments/environment';
import { STUB_PNG_BUFFER } from './stub-image';

/**
 * Intercepts every map tile request and serves a stub instead. Leaflet
 * itself is the REAL library (dynamically imported, not mocked) — only the
 * network call to whichever tile host is actually configured is stubbed, so
 * this suite never depends on nor hammers a third party.
 *
 * The host to intercept is derived from `environment.tileProvider`
 * (`src/environments/environment.ts`), the SAME config
 * `shared/ui/map/map.component.ts`'s `resolveTileSource()` reads by default —
 * not hardcoded here — so this stays correct whether or not a provider API
 * key is configured for the environment the dev server (`npm start`, used by
 * `webServer` in `playwright.config.ts`) was started with: empty key ->
 * `tile.openstreetmap.org` fallback; key set -> the configured provider's
 * origin (MapTiler by default). In the running app this same value reaches
 * `MapComponent` through the `TILE_PROVIDER_CONFIG` DI token rather than a
 * direct import (see that token's doc comment) — but this file runs as
 * Playwright/Node code outside the Angular injector entirely, so it reads
 * `environment` directly, which is the token's own default value anyway.
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

/**
 * `app-map` renders a MapLibre VECTOR base layer when the browser has WebGL
 * and falls back to raster PNG tiles otherwise (see `map.component.ts`), so
 * this stubs both families on the provider origin:
 *  - raster `{z}/{x}/{y}.png`            -> stub PNG                (counted)
 *  - `/tiles/v3/tiles.json`              -> a TileJSON pointing back at the stub below
 *  - `/tiles/v3/{z}/{x}/{y}.pbf`         -> EMPTY body, a valid empty vector tile (counted)
 *  - `/fonts/**` (glyph ranges)          -> empty body, i.e. no glyphs
 *  - `/maps/**\/sprite*`                 -> `{}` / stub PNG
 * `count()` counts tile fetches only (png + pbf), so `count() > 0` keeps
 * meaning "the map fetched tiles" on either path. The style itself
 * (`/map/style.json`) is the app's own static file and is NOT intercepted.
 */
export async function mockTiles(page: Page): Promise<TileInterceptor> {
  let hits = 0;
  const origin = activeTileOrigin();
  await page.route(`${origin}/**`, (route: Route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/tiles.json')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          tilejson: '2.2.0',
          tiles: [`${origin}/tiles/v3/{z}/{x}/{y}.pbf`],
          minzoom: 0,
          maxzoom: 14,
          vector_layers: [],
        }),
      });
    }
    if (pathname.startsWith('/fonts/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-protobuf',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.alloc(0),
      });
    }
    if (pathname.includes('/sprite')) {
      const isJson = pathname.endsWith('.json');
      return route.fulfill({
        status: 200,
        contentType: isJson ? 'application/json' : 'image/png',
        headers: { 'access-control-allow-origin': '*' },
        body: isJson ? '{}' : STUB_PNG_BUFFER,
      });
    }
    hits += 1;
    if (pathname.endsWith('.pbf')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/x-protobuf',
        headers: { 'access-control-allow-origin': '*' },
        body: Buffer.alloc(0),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: STUB_PNG_BUFFER,
    });
  });
  return { count: () => hits };
}
