import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { ListingPreview } from '../../listings/models/listing.model';
import type { PublicUserProfile } from '../models/public-profile.model';
import { publicProfilesFeatureKey } from './public-profiles.reducer';
import type {
  PublicProfileEntry,
  PublicProfilesState,
  UserListingsEntry,
} from './public-profiles.state';

export const selectPublicProfilesState =
  createFeatureSelector<PublicProfilesState>(publicProfilesFeatureKey);

const emptyEntry: PublicProfileEntry = { data: null, isLoading: false, error: null };
const emptyListingsEntry: UserListingsEntry = { data: null, isLoading: false, error: null };

export const selectPublicProfileEntry = (userId: string) =>
  createSelector(
    selectPublicProfilesState,
    (state): PublicProfileEntry => state.byId[userId] ?? emptyEntry,
  );

export const selectPublicProfile = (userId: string) =>
  createSelector(
    selectPublicProfileEntry(userId),
    (entry): PublicUserProfile | null => entry.data,
  );

export const selectPublicProfileLoading = (userId: string) =>
  createSelector(
    selectPublicProfileEntry(userId),
    (entry): boolean => entry.isLoading,
  );

export const selectPublicProfileError = (userId: string) =>
  createSelector(
    selectPublicProfileEntry(userId),
    (entry): string | null => entry.error,
  );

export const selectUserListingsEntry = (userId: string) =>
  createSelector(
    selectPublicProfilesState,
    (state): UserListingsEntry => state.userListings[userId] ?? emptyListingsEntry,
  );

export const selectUserListings = (userId: string) =>
  createSelector(
    selectUserListingsEntry(userId),
    (entry): readonly ListingPreview[] | null => entry.data,
  );

export const selectUserListingsLoading = (userId: string) =>
  createSelector(
    selectUserListingsEntry(userId),
    (entry): boolean => entry.isLoading,
  );

export const selectUserListingsError = (userId: string) =>
  createSelector(
    selectUserListingsEntry(userId),
    (entry): string | null => entry.error,
  );
