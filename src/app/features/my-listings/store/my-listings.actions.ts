import { createAction, props } from '@ngrx/store';

import type { MyListing } from '../models/my-listing.model';

export const loadMyListings = createAction('[My Listings] Load My Listings');

export const loadMyListingsSuccess = createAction(
  '[My Listings] Load My Listings Success',
  props<{ items: MyListing[] }>(),
);

export const loadMyListingsFailure = createAction(
  '[My Listings] Load My Listings Failure',
  props<{ error: string }>(),
);

export const archiveListing = createAction(
  '[My Listings] Archive Listing',
  props<{ listingId: string }>(),
);

export const archiveListingSuccess = createAction(
  '[My Listings] Archive Listing Success',
  props<{ listingId: string }>(),
);

export const archiveListingFailure = createAction(
  '[My Listings] Archive Listing Failure',
  props<{ error: string }>(),
);

export const restoreListing = createAction(
  '[My Listings] Restore Listing',
  props<{ listingId: string }>(),
);

export const restoreListingSuccess = createAction(
  '[My Listings] Restore Listing Success',
  props<{ listingId: string }>(),
);

export const restoreListingFailure = createAction(
  '[My Listings] Restore Listing Failure',
  props<{ error: string }>(),
);

export const resubmitListing = createAction(
  '[My Listings] Resubmit Listing',
  props<{ listingId: string }>(),
);

export const resubmitListingSuccess = createAction(
  '[My Listings] Resubmit Listing Success',
  props<{ listingId: string }>(),
);

export const resubmitListingFailure = createAction(
  '[My Listings] Resubmit Listing Failure',
  props<{ error: string }>(),
);
