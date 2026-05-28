import type { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  {
    path: ':userId',
    loadComponent: () =>
      import(
        './pages/public-profile-page/public-profile-page.component'
      ).then((m) => m.PublicProfilePageComponent),
  },
];
