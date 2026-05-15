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
    path: 'privacy',
    loadComponent: () =>
      import('./pages/privacy-page/privacy-page.component').then(
        (m) => m.PrivacyPageComponent,
      ),
  },
];
