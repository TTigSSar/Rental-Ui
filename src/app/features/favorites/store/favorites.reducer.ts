import { createReducer, on } from '@ngrx/store';

import { HomeSectionsActions } from '../../home/store/home.actions';
import type { ListingPreview } from '../../listings/models/listing.model';
import * as ListingsActions from '../../listings/store/listings.actions';
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

function addId(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

function removeId(ids: readonly string[], id: string): readonly string[] {
  return ids.filter((i) => i !== id);
}

function seedIds(ids: readonly string[], items: ListingPreview[]): readonly string[] {
  const toAdd = items.filter((i) => i.isFavorite && !ids.includes(i.id)).map((i) => i.id);
  return toAdd.length === 0 ? ids : [...ids, ...toAdd];
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
      favoriteIds: items.map((i) => i.id),
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
  // ── Legacy action (kept for the removeFavorite$ effect in favorites.effects.ts) ──
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
        favoriteIds: removeId(state.favoriteIds, listingId),
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
          favoriteIds: addId(state.favoriteIds, listingId),
          error,
        };
      }

      return {
        ...state,
        items: restoreRemovedItem(state.items, pending.listing, pending.index),
        pendingRemovals,
        favoriteIds: addId(state.favoriteIds, listingId),
        error,
      };
    },
  ),
  // ── Unified toggle (dispatched from all pages) ────────────────────────────
  on(
    ListingsActions.toggleFavoriteOptimistic,
    (state, { listingId }): FavoritesState => {
      const wasInFavorites = state.favoriteIds.includes(listingId);
      const newFavoriteIds = wasInFavorites
        ? removeId(state.favoriteIds, listingId)
        : addId(state.favoriteIds, listingId);

      const index = state.items.findIndex((item) => item.id === listingId);
      if (index < 0) {
        return { ...state, favoriteIds: newFavoriteIds, error: null };
      }
      const listing = state.items[index];
      return {
        ...state,
        items: state.items.filter((item) => item.id !== listingId),
        pendingRemovals: {
          ...state.pendingRemovals,
          [listingId]: { listing, index },
        },
        favoriteIds: newFavoriteIds,
        error: null,
      };
    },
  ),
  on(
    ListingsActions.toggleFavoriteRollback,
    (state, { listingId, isFavorite }): FavoritesState => {
      const newFavoriteIds = isFavorite
        ? addId(state.favoriteIds, listingId)
        : removeId(state.favoriteIds, listingId);

      if (!isFavorite) {
        return { ...state, favoriteIds: newFavoriteIds };
      }
      const pending = state.pendingRemovals[listingId];
      if (pending === undefined) {
        return { ...state, favoriteIds: newFavoriteIds };
      }
      return {
        ...state,
        items: restoreRemovedItem(state.items, pending.listing, pending.index),
        pendingRemovals: withoutPending(state.pendingRemovals, listingId),
        favoriteIds: newFavoriteIds,
      };
    },
  ),
  // ── Bootstrap: seed favoriteIds from API responses ────────────────────────
  on(
    ListingsActions.loadListingsSuccess,
    (state, { items }): FavoritesState => {
      const updated = seedIds(state.favoriteIds, items);
      return updated === state.favoriteIds ? state : { ...state, favoriteIds: updated };
    },
  ),
  on(
    ListingsActions.loadListingDetailsSuccess,
    (state, { listing }): FavoritesState => {
      const hasId = state.favoriteIds.includes(listing.id);
      if (listing.isFavorite && !hasId) {
        return { ...state, favoriteIds: addId(state.favoriteIds, listing.id) };
      }
      if (!listing.isFavorite && hasId) {
        return { ...state, favoriteIds: removeId(state.favoriteIds, listing.id) };
      }
      return state;
    },
  ),
  on(
    HomeSectionsActions.loadSuccess,
    (state, { sections }): FavoritesState => {
      const allItems = sections.flatMap((s) => s.items);
      const updated = seedIds(state.favoriteIds, allItems);
      return updated === state.favoriteIds ? state : { ...state, favoriteIds: updated };
    },
  ),
);
