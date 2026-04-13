import { createReducer, on } from '@ngrx/store';

import type { ListingPreview } from '../../listings/models/listing.model';
import * as FavoritesActions from './favorites.actions';
import {
  initialFavoritesState,
  type FavoritesState,
} from './favorites.state';

export const favoritesFeatureKey = 'favorites' as const;

function withoutPending(
  pendingRemovals: FavoritesState['pendingRemovals'],
  listingId: string,
): FavoritesState['pendingRemovals'] {
  const { [listingId]: _, ...rest } = pendingRemovals;
  return rest;
}

function restoreRemovedItem(
  items: ListingPreview[],
  listing: ListingPreview,
  index: number,
): ListingPreview[] {
  const safeIndex = Math.max(0, Math.min(index, items.length));
  return [
    ...items.slice(0, safeIndex),
    listing,
    ...items.slice(safeIndex),
  ];
}

export const favoritesReducer = createReducer(
  initialFavoritesState,
  on(
    FavoritesActions.loadFavorites,
    (state): FavoritesState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    FavoritesActions.loadFavoritesSuccess,
    (state, { items }): FavoritesState => ({
      ...state,
      items: [...items],
      isLoading: false,
      error: null,
      pendingRemovals: {},
    }),
  ),
  on(
    FavoritesActions.loadFavoritesFailure,
    (state, { error }): FavoritesState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
  on(
    FavoritesActions.removeFavoriteOptimistic,
    (state, { listingId }): FavoritesState => {
      const index = state.items.findIndex((item) => item.id === listingId);
      if (index < 0) {
        return state;
      }

      const listing = state.items[index];
      return {
        ...state,
        items: state.items.filter((item) => item.id !== listingId),
        pendingRemovals: {
          ...state.pendingRemovals,
          [listingId]: { listing, index },
        },
        error: null,
      };
    },
  ),
  on(
    FavoritesActions.removeFavoriteSuccess,
    (state, { listingId }): FavoritesState => ({
      ...state,
      pendingRemovals: withoutPending(state.pendingRemovals, listingId),
    }),
  ),
  on(
    FavoritesActions.removeFavoriteFailure,
    (state, { listingId, error }): FavoritesState => {
      const pending = state.pendingRemovals[listingId];
      const pendingRemovals = withoutPending(state.pendingRemovals, listingId);

      if (pending === undefined) {
        return {
          ...state,
          pendingRemovals,
          error,
        };
      }

      return {
        ...state,
        items: restoreRemovedItem(state.items, pending.listing, pending.index),
        pendingRemovals,
        error,
      };
    },
  ),
);
