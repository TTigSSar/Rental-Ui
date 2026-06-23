import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
import { FavoritesEffects } from './store/favorites.effects';
import { favoritesFeatureKey, favoritesReducer } from './store/favorites.reducer';
import { ListingsEffects } from '../listings/store/listings.effects';
import { listingsFeatureKey, listingsReducer } from '../listings/store/listings.reducer';

export const favoritesRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    providers: [
      provideState(favoritesFeatureKey, favoritesReducer),
      provideEffects(FavoritesEffects),
      provideState(listingsFeatureKey, listingsReducer),
      provideEffects(ListingsEffects),
    ],
    loadComponent: () =>
      import('./pages/favorites-page/favorites-page.component').then(
        (m) => m.FavoritesPageComponent,
      ),
  },
];
