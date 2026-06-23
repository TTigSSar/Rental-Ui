import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
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
    ],
  },
];
