import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { PendingListing } from '../models/pending-listing.model';
import { adminModerationFeatureKey } from './admin-moderation.reducer';
import type { AdminModerationState } from './admin-moderation.state';

export const selectAdminModerationState =
  createFeatureSelector<AdminModerationState>(adminModerationFeatureKey);

export const selectPendingListings = createSelector(
  selectAdminModerationState,
  (state: AdminModerationState): PendingListing[] => state.pendingListings,
);

export const selectPendingListingsLoading = createSelector(
  selectAdminModerationState,
  (state: AdminModerationState): boolean => state.isLoading,
);

export const selectPendingListingsError = createSelector(
  selectAdminModerationState,
  (state: AdminModerationState): string | null => state.error,
);

export const selectPendingListingActionIds = createSelector(
  selectAdminModerationState,
  (state: AdminModerationState): string[] => state.actionIds,
);
