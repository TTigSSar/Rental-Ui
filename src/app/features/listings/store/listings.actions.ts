import { createAction, props } from '@ngrx/store';

import type {
  CreateListingRequest,
  CreateListingResponse,
  ListingCategoryOption,
} from '../models/create-listing.model';
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

export const loadListingCategories = createAction(
  '[Listings] Load Listing Categories',
);

export const loadListingCategoriesSuccess = createAction(
  '[Listings] Load Listing Categories Success',
  props<{ categories: ListingCategoryOption[] }>(),
);

export const loadListingCategoriesFailure = createAction(
  '[Listings] Load Listing Categories Failure',
  props<{ error: string }>(),
);

export const createListing = createAction(
  '[Listings] Create Listing',
  props<{ payload: CreateListingRequest; files: File[] }>(),
);

export const createListingSuccess = createAction(
  '[Listings] Create Listing Success',
  props<{ response: CreateListingResponse; imageUploadFailed: boolean }>(),
);

export const createListingFailure = createAction(
  '[Listings] Create Listing Failure',
  props<{ error: string }>(),
);

export const clearCreateListingState = createAction(
  '[Listings] Clear Create Listing State',
);
