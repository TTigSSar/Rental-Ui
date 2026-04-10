import { createReducer, on } from '@ngrx/store';

import type { ListingDetails } from '../models/listing-details.model';
import type { ListingPreview } from '../models/listing.model';
import * as ListingsActions from './listings.actions';
import { initialListingsState, type ListingsState } from './listings.state';

export const listingsFeatureKey = 'listings' as const;

function toggleFavoriteOnDetails(
  listing: ListingDetails | null,
  listingId: string,
): ListingDetails | null {
  if (listing === null || listing.id !== listingId) {
    return listing;
  }
  return { ...listing, isFavorite: !listing.isFavorite };
}

function setFavoriteOnDetails(
  listing: ListingDetails | null,
  listingId: string,
  isFavorite: boolean,
): ListingDetails | null {
  if (listing === null || listing.id !== listingId) {
    return listing;
  }
  return { ...listing, isFavorite };
}

function mapItemsToggleFavorite(
  items: ListingPreview[],
  listingId: string,
): ListingPreview[] {
  return items.map((item) =>
    item.id === listingId ? { ...item, isFavorite: !item.isFavorite } : item,
  );
}

function mapItemsSetFavorite(
  items: ListingPreview[],
  listingId: string,
  isFavorite: boolean,
): ListingPreview[] {
  return items.map((item) =>
    item.id === listingId ? { ...item, isFavorite } : item,
  );
}

export const listingsReducer = createReducer(
  initialListingsState,
  on(
    ListingsActions.loadListings,
    (state): ListingsState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadNextPage,
    (state): ListingsState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingsSuccess,
    (state, { items, page, pageSize, hasMore }): ListingsState => ({
      ...state,
      items: page <= 1 ? [...items] : [...state.items, ...items],
      page,
      pageSize,
      hasMore,
      isLoading: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingsFailure,
    (state, { error }): ListingsState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
  on(
    ListingsActions.updateFilters,
    (state, { filters }): ListingsState => ({
      ...state,
      filters: { ...filters },
      page: 1,
      items: [],
      hasMore: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.resetListings,
    (): ListingsState => ({
      ...initialListingsState,
      filters: { ...initialListingsState.filters },
    }),
  ),
  on(
    ListingsActions.loadListingDetails,
    (state): ListingsState => ({
      ...state,
      isDetailsLoading: true,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingDetailsSuccess,
    (state, { listing }): ListingsState => ({
      ...state,
      selectedListing: listing,
      isDetailsLoading: false,
      error: null,
    }),
  ),
  on(
    ListingsActions.loadListingDetailsFailure,
    (state, { error }): ListingsState => ({
      ...state,
      isDetailsLoading: false,
      error,
    }),
  ),
  on(
    ListingsActions.toggleFavoriteOptimistic,
    (state, { listingId }): ListingsState => ({
      ...state,
      items: mapItemsToggleFavorite(state.items, listingId),
      selectedListing: toggleFavoriteOnDetails(state.selectedListing, listingId),
    }),
  ),
  on(
    ListingsActions.toggleFavoriteRollback,
    (state, { listingId, isFavorite }): ListingsState => ({
      ...state,
      items: mapItemsSetFavorite(state.items, listingId, isFavorite),
      selectedListing: setFavoriteOnDetails(
        state.selectedListing,
        listingId,
        isFavorite,
      ),
    }),
  ),
);
