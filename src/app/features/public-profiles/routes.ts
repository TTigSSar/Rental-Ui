import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { PublicProfilesEffects } from './store/public-profiles.effects';
import {
  publicProfilesFeatureKey,
  publicProfilesReducer,
} from './store/public-profiles.reducer';
import { ListingsEffects } from '../listings/store/listings.effects';
import { listingsFeatureKey, listingsReducer } from '../listings/store/listings.reducer';
import { ReviewsEffects } from '../reviews/store/reviews.effects';
import { reviewsFeatureKey, reviewsReducer } from '../reviews/store/reviews.reducer';

export const usersRoutes: Routes = [
  {
    path: '',
    providers: [
      provideState(publicProfilesFeatureKey, publicProfilesReducer),
      provideEffects(PublicProfilesEffects),
      provideState(listingsFeatureKey, listingsReducer),
      provideEffects(ListingsEffects),
      provideState(reviewsFeatureKey, reviewsReducer),
      provideEffects(ReviewsEffects),
    ],
    children: [
      {
        path: ':userId',
        loadComponent: () =>
          import('./pages/public-profile-page/public-profile-page.component').then(
            (m) => m.PublicProfilePageComponent,
          ),
      },
      {
        path: ':userId/listings',
        loadComponent: () =>
          import('./pages/user-listings-page/user-listings-page.component').then(
            (m) => m.UserListingsPageComponent,
          ),
      },
      {
        path: ':userId/reviews',
        loadComponent: () =>
          import('./pages/all-reviews-page/all-reviews-page.component').then(
            (m) => m.AllReviewsPageComponent,
          ),
      },
    ],
  },
];
