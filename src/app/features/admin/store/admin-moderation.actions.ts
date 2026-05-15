import { createAction, props } from '@ngrx/store';

import type { PendingListing } from '../models/pending-listing.model';

export const loadPendingListings = createAction(
  '[Admin Moderation] Load Pending Listings',
);

export const loadPendingListingsSuccess = createAction(
  '[Admin Moderation] Load Pending Listings Success',
  props<{ items: PendingListing[] }>(),
);

export const loadPendingListingsFailure = createAction(
  '[Admin Moderation] Load Pending Listings Failure',
  props<{ error: string }>(),
);

export const approvePendingListing = createAction(
  '[Admin Moderation] Approve Pending Listing',
  props<{ listingId: string }>(),
);

export const approvePendingListingSuccess = createAction(
  '[Admin Moderation] Approve Pending Listing Success',
  props<{ listingId: string }>(),
);

export const approvePendingListingFailure = createAction(
  '[Admin Moderation] Approve Pending Listing Failure',
  props<{ listingId: string; error: string }>(),
);

export const rejectPendingListing = createAction(
  '[Admin Moderation] Reject Pending Listing',
  props<{ listingId: string; reason: string }>(),
);

export const rejectPendingListingSuccess = createAction(
  '[Admin Moderation] Reject Pending Listing Success',
  props<{ listingId: string }>(),
);

export const rejectPendingListingFailure = createAction(
  '[Admin Moderation] Reject Pending Listing Failure',
  props<{ listingId: string; error: string }>(),
);
