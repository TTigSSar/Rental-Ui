export const environment = {
  production: true,
  apiBaseUrl: 'https://api.example.com',
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
