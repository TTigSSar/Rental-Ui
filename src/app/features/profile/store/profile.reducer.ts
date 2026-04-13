import { createReducer, on } from '@ngrx/store';

import * as ProfileActions from './profile.actions';
import { initialProfileState, type ProfileState } from './profile.state';

export const profileFeatureKey = 'profile' as const;

export const profileReducer = createReducer(
  initialProfileState,
  on(
    ProfileActions.loadProfile,
    (state): ProfileState => ({
      ...state,
      isLoading: true,
      error: null,
    }),
  ),
  on(
    ProfileActions.loadProfileSuccess,
    (state, { profile }): ProfileState => ({
      ...state,
      profile,
      isLoading: false,
      error: null,
    }),
  ),
  on(
    ProfileActions.loadProfileFailure,
    (state, { error }): ProfileState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
);
