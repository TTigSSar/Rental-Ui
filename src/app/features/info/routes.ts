import type { Routes } from '@angular/router';

export const infoRoutes: Routes = [
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about-page/about-page.component').then(
        (m) => m.AboutPageComponent,
      ),
  },
  {
    path: 'faq',
    loadComponent: () =>
      import('./pages/faq-page/faq-page.component').then(
        (m) => m.FaqPageComponent,
      ),
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./pages/terms-page/terms-page.component').then(
        (m) => m.TermsPageComponent,
      ),
  },
  {
    // Public, no guard: linked from the footer and from store-listing "delete account" URLs.
    path: 'account-deletion',
    loadComponent: () =>
      import('./pages/account-deletion-page/account-deletion-page.component').then(
        (m) => m.AccountDeletionPageComponent,
      ),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./pages/privacy-page/privacy-page.component').then(
        (m) => m.PrivacyPageComponent,
      ),
  },
];
