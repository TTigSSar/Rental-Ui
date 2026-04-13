import type { Routes } from '@angular/router';

import { authGuard } from '../auth/guards/auth.guard';

export const myListingsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/my-listings-page/my-listings-page.component').then(
        (m) => m.MyListingsPageComponent,
      ),
  },
];
