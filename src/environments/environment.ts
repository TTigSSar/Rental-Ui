export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:7241',
  externalAuth: {
    googleClientId: '',
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
