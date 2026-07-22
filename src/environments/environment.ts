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
    // This is a client-side MapTiler key restricted to specific HTTP origins
    // (allowlist configured on the MapTiler account side) — that origin
    // restriction, not secrecy, is what protects it, so committing it to
    // this public repo is acceptable. `TILE_PROVIDER_CONFIG`
    // (map.component.ts) is the DI seam that lets consumers/tests supply a
    // different key without touching this file.
    apiKey: 'AOVIoZYj8fp5xR9RTVKe',
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
