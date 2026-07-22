export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:7241',
  /**
   * Raster tile provider for `app-map` (`shared/ui/map/map.component.ts`).
   * `apiKey` is intentionally empty here — see `Rental-Ui/CLAUDE.md` for how
   * to set it for local dev. With an empty key, `app-map` falls back to
   * `tile.openstreetmap.org` and logs a console warning; it never renders a
   * blank map for a missing key.
   */
  tileProvider: {
    /** `{z}`/`{x}`/`{y}`/`{key}` placeholders, substituted by `app-map`. */
    urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
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
