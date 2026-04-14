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
    },
  },
} as const;
