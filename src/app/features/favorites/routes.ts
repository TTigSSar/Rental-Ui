import type { Routes } from '@angular/router';

import { authGuard } from '../auth/guards/auth.guard';

export const favoritesRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/favorites-page/favorites-page.component').then(
        (m) => m.FavoritesPageComponent,
      ),
  },
];
