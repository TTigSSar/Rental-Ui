import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { HomeEffects } from './store/home.effects';
import { homeFeatureKey, homeReducer } from './store/home.reducer';
import { FavoritesEffects } from '../favorites/store/favorites.effects';
import { favoritesFeatureKey, favoritesReducer } from '../favorites/store/favorites.reducer';
import { ListingsEffects } from '../listings/store/listings.effects';
import { listingsFeatureKey, listingsReducer } from '../listings/store/listings.reducer';

export const homeRoutes: Routes = [
  {
    path: '',
    providers: [
      provideState(homeFeatureKey, homeReducer),
      provideEffects(HomeEffects),
      provideState(favoritesFeatureKey, favoritesReducer),
      provideEffects(FavoritesEffects),
      provideState(listingsFeatureKey, listingsReducer),
      provideEffects(ListingsEffects),
    ],
    loadComponent: () =>
      import('./pages/home-page/home-page.component').then((m) => m.HomePageComponent),
  },
];
