import { createAction, props } from '@ngrx/store';

import type { ListingDetails } from '../models/listing-details.model';
import type { ListingPreview } from '../models/listing.model';
import type { ListingsFilter } from '../models/listings-filter.model';

export const loadListings = createAction('[Listings] Load Listings');

export const loadListingsSuccess = createAction(
  '[Listings] Load Listings Success',
  props<{
    items: ListingPreview[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  }>(),
);

export const loadListingsFailure = createAction(
  '[Listings] Load Listings Failure',
  props<{ error: string }>(),
);

export const loadNextPage = createAction('[Listings] Load Next Page');

export const updateFilters = createAction(
  '[Listings] Update Filters',
  props<{ filters: ListingsFilter }>(),
);

export const resetListings = createAction('[Listings] Reset Listings');

export const loadListingDetails = createAction(
  '[Listings] Load Listing Details',
  props<{ id: string }>(),
);

export const loadListingDetailsSuccess = createAction(
  '[Listings] Load Listing Details Success',
  props<{ listing: ListingDetails }>(),
);

export const loadListingDetailsFailure = createAction(
  '[Listings] Load Listing Details Failure',
  props<{ error: string }>(),
);

export const toggleFavoriteOptimistic = createAction(
  '[Listings] Toggle Favorite Optimistic',
  props<{ listingId: string }>(),
);

export const toggleFavoriteRollback = createAction(
  '[Listings] Toggle Favorite Rollback',
  props<{ listingId: string; isFavorite: boolean }>(),
);
