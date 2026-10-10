import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { ApiErrorCode } from '../../../api/api-error.model';
import type { CurrentUser, HomePoint } from '../models/auth.models';
import { authFeatureKey } from './auth.reducer';
import type { AuthState } from './auth.state';

export const selectAuthState = createFeatureSelector<AuthState>(authFeatureKey);

export const selectAuthUser = createSelector(
  selectAuthState,
  (state: AuthState | undefined): CurrentUser | null => state?.user ?? null,
);

export const selectAuthToken = createSelector(
  selectAuthState,
  (state: AuthState | undefined): string | null => state?.token ?? null,
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.isAuthenticated ?? false,
);

export const selectAuthLoading = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.isLoading ?? false,
);

export const selectAuthError = createSelector(
  selectAuthState,
  (state: AuthState | undefined): string | null => state?.error ?? null,
);

export const selectAuthInitializing = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.isInitializing ?? true,
);

export const selectAuthErrorCode = createSelector(
  selectAuthState,
  (state: AuthState | undefined): ApiErrorCode | null => state?.errorCode ?? null,
);

export const selectPendingVerificationEmail = createSelector(
  selectAuthState,
  (state: AuthState | undefined): string | null => state?.pendingVerificationEmail ?? null,
);

/**
 * The signed-in user's home point, or null when they have not set one.
 *
 * THE single source for it on the client. The profile page reads this, not a
 * second copy inside the profile slice: `UserProfile` is built from the same
 * `/api/auth/me` payload, so a second copy is a second thing to keep in step
 * after a PUT — and the one that goes stale is the one the user is looking at.
 */
export const selectHomePoint = createSelector(
  selectAuthUser,
  (user: CurrentUser | null): HomePoint | null => user?.homePoint ?? null,
);

/** `false` is also the state in which creating a listing fails with 409
 *  `listing.home_point_required` — i.e. what the wizard's gate keys off. */
export const selectHasHomePoint = createSelector(
  selectHomePoint,
  (homePoint: HomePoint | null): boolean => homePoint !== null,
);

export const selectHomePointSaving = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.homePointSaving ?? false,
);

export const selectHomePointError = createSelector(
  selectAuthState,
  (state: AuthState | undefined): string | null => state?.homePointError ?? null,
);

export const selectHomePointErrorCode = createSelector(
  selectAuthState,
  (state: AuthState | undefined): ApiErrorCode | null => state?.homePointErrorCode ?? null,
);

/** The one refusal the picker renders inline rather than as a banner — the pin
 *  is outside the 12 Yerevan districts. */
export const selectHomePointOutsideYerevan = createSelector(
  selectHomePointErrorCode,
  (code: ApiErrorCode | null): boolean => code === 'auth.home_point_outside_yerevan',
);
