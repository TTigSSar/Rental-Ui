import { createReducer, on } from '@ngrx/store';

import * as AuthActions from '../../auth/store/auth.actions';
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
  // The Personal info card writes through the auth store; this slice (the profile header,
  // the desktop identity card) is a second copy of the same /auth/me payload, so it is kept
  // in step here instead of waiting for the next loadProfile.
  on(
    AuthActions.updateNameSuccess,
    (state, { firstName, lastName }): ProfileState => ({
      ...state,
      profile: state.profile === null ? null : { ...state.profile, firstName, lastName },
    }),
  ),
  on(
    AuthActions.updatePhoneSuccess,
    (state, { phoneNumber }): ProfileState => ({
      ...state,
      profile: state.profile === null ? null : { ...state.profile, phoneNumber },
    }),
  ),
  // ADR-070: the picture is owned by auth.user (selectCurrentUserAvatarUrl feeds every avatar
  // surface); this copy is patched from the same refreshed user only so it cannot diverge.
  on(
    AuthActions.uploadAvatarSuccess,
    AuthActions.removeAvatarSuccess,
    (state, { user }): ProfileState => ({
      ...state,
      profile: state.profile === null ? null : { ...state.profile, avatarUrl: user.avatarUrl ?? null },
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
