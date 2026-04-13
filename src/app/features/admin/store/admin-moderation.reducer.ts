import { createReducer, on } from '@ngrx/store';

import type { PendingListing } from '../models/pending-listing.model';
import * as AdminModerationActions from './admin-moderation.actions';
import {
  initialAdminModerationState,
  type AdminModerationState,
} from './admin-moderation.state';

export const adminModerationFeatureKey = 'adminModeration' as const;

function addActionId(ids: string[], listingId: string): string[] {
  if (ids.includes(listingId)) {
    return ids;
  }
  return [...ids, listingId];
}

function removeActionId(ids: string[], listingId: string): string[] {
  return ids.filter((id) => id !== listingId);
}

function removeListingById(
  listings: PendingListing[],
  listingId: string,
): PendingListing[] {
  return listings.filter((item) => item.id !== listingId);
}

export const adminModerationReducer = createReducer(
  initialAdminModerationState,
  on(
    AdminModerationActions.loadPendingListings,
    (state): AdminModerationState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    AdminModerationActions.loadPendingListingsSuccess,
    (state, { items }): AdminModerationState => ({
      ...state,
      pendingListings: [...items],
      isLoading: false,
      error: null,
    }),
  ),
  on(
    AdminModerationActions.loadPendingListingsFailure,
    (state, { error }): AdminModerationState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
  on(
    AdminModerationActions.approvePendingListing,
    AdminModerationActions.rejectPendingListing,
    (state, { listingId }): AdminModerationState => ({
      ...state,
      actionIds: addActionId(state.actionIds, listingId),
      error: null,
    }),
  ),
  on(
    AdminModerationActions.approvePendingListingSuccess,
    AdminModerationActions.rejectPendingListingSuccess,
    (state, { listingId }): AdminModerationState => ({
      ...state,
      pendingListings: removeListingById(state.pendingListings, listingId),
      actionIds: removeActionId(state.actionIds, listingId),
    }),
  ),
  on(
    AdminModerationActions.approvePendingListingFailure,
    AdminModerationActions.rejectPendingListingFailure,
    (state, { listingId, error }): AdminModerationState => ({
      ...state,
      actionIds: removeActionId(state.actionIds, listingId),
      error,
    }),
  ),
);
