import type { Routes } from '@angular/router';

import { adminGuard } from './guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    children: [
      {
        path: 'listings/pending',
        loadComponent: () =>
          import('./pages/pending-listings-page/pending-listings-page.component').then(
            (m) => m.PendingListingsPageComponent,
          ),
      },
    ],
  },
];
