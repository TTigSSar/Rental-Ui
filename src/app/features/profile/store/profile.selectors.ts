import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { UserProfile } from '../models/profile.model';
import { profileFeatureKey } from './profile.reducer';
import type { ProfileState } from './profile.state';

export const selectProfileState =
  createFeatureSelector<ProfileState>(profileFeatureKey);

export const selectProfile = createSelector(
  selectProfileState,
  (state: ProfileState): UserProfile | null => state.profile,
);

export const selectProfileLoading = createSelector(
  selectProfileState,
  (state: ProfileState): boolean => state.isLoading,
);

export const selectProfileError = createSelector(
  selectProfileState,
  (state: ProfileState): string | null => state.error,
);
