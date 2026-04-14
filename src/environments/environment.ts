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
    },
  },
} as const;
