import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
import { ProfileEffects } from './store/profile.effects';
import { profileFeatureKey, profileReducer } from './store/profile.reducer';
import { BookingsEffects } from '../bookings/store/bookings.effects';
import { bookingsFeatureKey, bookingsReducer } from '../bookings/store/bookings.reducer';
import { FavoritesEffects } from '../favorites/store/favorites.effects';
import { favoritesFeatureKey, favoritesReducer } from '../favorites/store/favorites.reducer';
import { MyListingsEffects } from '../my-listings/store/my-listings.effects';
import { myListingsFeatureKey, myListingsReducer } from '../my-listings/store/my-listings.reducer';
import { ReviewsEffects } from '../reviews/store/reviews.effects';
import { reviewsFeatureKey, reviewsReducer } from '../reviews/store/reviews.reducer';

export const profileRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    providers: [
      provideState(profileFeatureKey, profileReducer),
      provideEffects(ProfileEffects),
      provideState(bookingsFeatureKey, bookingsReducer),
      provideEffects(BookingsEffects),
      provideState(favoritesFeatureKey, favoritesReducer),
      provideEffects(FavoritesEffects),
      provideState(myListingsFeatureKey, myListingsReducer),
      provideEffects(MyListingsEffects),
      provideState(reviewsFeatureKey, reviewsReducer),
      provideEffects(ReviewsEffects),
    ],
    loadComponent: () =>
      import('./pages/profile-page/profile-page.component').then(
        (m) => m.ProfilePageComponent,
      ),
    children: [
      {
        path: 'toys',
        loadComponent: () =>
          import('../my-listings/pages/my-listings-page/my-listings-page.component').then(
            (m) => m.MyListingsPageComponent,
          ),
      },
      {
        path: 'rentals',
        loadComponent: () =>
          import('../bookings/pages/my-bookings-page/my-bookings-page.component').then(
            (m) => m.MyBookingsPageComponent,
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('../bookings/pages/booking-requests-page/booking-requests-page.component').then(
            (m) => m.BookingRequestsPageComponent,
          ),
      },
      {
        path: 'saved',
        loadComponent: () =>
          import('../favorites/pages/favorites-page/favorites-page.component').then(
            (m) => m.FavoritesPageComponent,
          ),
      },
    ],
  },
];
