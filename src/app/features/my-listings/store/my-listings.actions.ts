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
