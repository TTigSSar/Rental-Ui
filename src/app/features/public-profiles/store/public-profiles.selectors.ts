import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { PublicUserProfile } from '../models/public-profile.model';
import { publicProfilesFeatureKey } from './public-profiles.reducer';
import type { PublicProfileEntry, PublicProfilesState } from './public-profiles.state';

export const selectPublicProfilesState =
  createFeatureSelector<PublicProfilesState>(publicProfilesFeatureKey);

const emptyEntry: PublicProfileEntry = { data: null, isLoading: false, error: null };

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
