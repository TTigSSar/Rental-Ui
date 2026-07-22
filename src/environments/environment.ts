export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:7241',
  /**
   * Raster tile provider for `app-map` (`shared/ui/map/map.component.ts`).
   * With a non-empty key, `app-map` uses the configured provider (MapTiler).
   * With an empty key, it falls back to `tile.openstreetmap.org` and logs a
   * console warning; it never renders a blank map for a missing key.
   */
  tileProvider: {
    /** `{z}`/`{x}`/`{y}`/`{key}` placeholders, substituted by `app-map`. */
    urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
    // Leave this empty in the checked-in default — see `Rental-Ui/CLAUDE.md`
    // for how to set a real MapTiler key for local dev. Do NOT commit a real
    // key here: this repo is public, and a committed key ships to every
    // clone regardless of any origin restriction configured on the MapTiler
    // account side (which is a mitigation, not a substitute for not
    // committing it). `TILE_PROVIDER_CONFIG` (map.component.ts) is the DI
    // seam that lets consumers/tests supply a key without touching this file.
    apiKey: '',
    // Required by MapTiler's licence terms (both MapTiler's own attribution
    // and the underlying OSM data's), verbatim from
    // https://docs.maptiler.com/guides/map-design/how-to-add-maptiler-attribution-to-a-map/
    attribution:
      '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
    maxZoom: 19,
  },
  externalAuth: {
    google: {
      clientId: '6707214612-40dcffqfdopo4h12l9bg69h9gqp7oupt.apps.googleusercontent.com',
    },
    apple: {
      clientId: '',
      redirectUri: '',
      scope: 'name email',
      state: 'local-dev',
      usePopup: true,
      scriptSrc: 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    },
  },
} as const;
