import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { ListingPreview } from '../../listings/models/listing.model';
import { favoritesFeatureKey } from './favorites.reducer';
import type { FavoritesState } from './favorites.state';

export const selectFavoritesState =
  createFeatureSelector<FavoritesState>(favoritesFeatureKey);

export const selectFavoriteItems = createSelector(
  selectFavoritesState,
  (state: FavoritesState): ListingPreview[] => state.items,
);

export const selectFavoritesLoading = createSelector(
  selectFavoritesState,
  (state: FavoritesState): boolean => state.isLoading,
);

export const selectFavoritesError = createSelector(
  selectFavoritesState,
  (state: FavoritesState): string | null => state.error,
);
