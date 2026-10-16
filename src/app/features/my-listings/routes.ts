import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
import { ChatEffects } from '../chat/store/chat.effects';
import { chatFeatureKey, chatReducer } from '../chat/store/chat.reducer';
import { ListingsEffects } from '../listings/store/listings.effects';
import { listingsFeatureKey, listingsReducer } from '../listings/store/listings.reducer';
import { ReviewsEffects } from '../reviews/store/reviews.effects';
import { reviewsFeatureKey, reviewsReducer } from '../reviews/store/reviews.reducer';
import { MyListingsEffects } from './store/my-listings.effects';
import { myListingsFeatureKey, myListingsReducer } from './store/my-listings.reducer';

export const myListingsRoutes: Routes = [
  {
    path: '',
    providers: [
      provideState(myListingsFeatureKey, myListingsReducer),
      provideEffects(MyListingsEffects),
    ],
    children: [
      {
        path: '',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/my-listings-page/my-listings-page.component').then(
            (m) => m.MyListingsPageComponent,
          ),
      },
      {
        path: ':id/edit',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./pages/edit-listing-page/edit-listing-page.component').then(
            (m) => m.EditListingPageComponent,
          ),
      },
      {
        // Owner's item-details view ("This is your listing"). Reuses the
        // listings + reviews feature slices for the shared listing payload and
        // read-only reviews; non-owners are redirected to the public view.
        path: ':id',
        canActivate: [authGuard],
        providers: [
          provideState(listingsFeatureKey, listingsReducer),
          provideEffects(ListingsEffects),
          provideState(reviewsFeatureKey, reviewsReducer),
          provideEffects(ReviewsEffects),
          // "Message {renter}" dispatches `openConversationFromBooking`; the chat
          // store is registered lazily per consuming route, never app-wide.
          provideState(chatFeatureKey, chatReducer),
          provideEffects(ChatEffects),
        ],
        loadComponent: () =>
          import('./pages/owner-listing-page/owner-listing-page.component').then(
            (m) => m.OwnerListingPageComponent,
          ),
      },
    ],
  },
];
