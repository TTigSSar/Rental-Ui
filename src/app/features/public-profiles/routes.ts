import type { Routes } from '@angular/router';

export const usersRoutes: Routes = [
  {
    path: ':userId',
    loadComponent: () =>
      import(
        './pages/public-profile-page/public-profile-page.component'
      ).then((m) => m.PublicProfilePageComponent),
  },
  {
    path: ':userId/listings',
    loadComponent: () =>
      import(
        './pages/user-listings-page/user-listings-page.component'
      ).then((m) => m.UserListingsPageComponent),
  },
  {
    path: ':userId/reviews',
    loadComponent: () =>
      import(
        './pages/all-reviews-page/all-reviews-page.component'
      ).then((m) => m.AllReviewsPageComponent),
  },
];
