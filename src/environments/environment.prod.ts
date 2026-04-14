export const environment = {
  production: true,
  apiBaseUrl: 'https://api.example.com',
  externalAuth: {
    googleClientId: '',
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
