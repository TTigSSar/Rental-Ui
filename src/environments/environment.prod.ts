export const environment = {
  production: true,
  apiBaseUrl: '',
  // See environment.ts for field docs. Empty apiKey => OSM fallback + console
  // warning; set before a production build once a MapTiler key exists
  // (Rental-Ui/CLAUDE.md documents where).
  tileProvider: {
    urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
    apiKey: '',
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
      state: 'production',
      usePopup: true,
      scriptSrc: 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    },
  },
} as const;
