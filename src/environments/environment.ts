export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:7241',
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
