import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { MyListing } from '../models/my-listing.model';
import { myListingsFeatureKey } from './my-listings.reducer';
import type { MyListingsState } from './my-listings.state';

export const selectMyListingsState =
  createFeatureSelector<MyListingsState>(myListingsFeatureKey);

export const selectMyListingsItems = createSelector(
  selectMyListingsState,
  (state: MyListingsState): MyListing[] => state.items,
);

export const selectMyListingsLoading = createSelector(
  selectMyListingsState,
  (state: MyListingsState): boolean => state.isLoading,
);

export const selectMyListingsError = createSelector(
  selectMyListingsState,
  (state: MyListingsState): string | null => state.error,
);
