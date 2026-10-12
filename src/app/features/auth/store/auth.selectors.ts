import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { ApiErrorCode } from '../../../api/api-error.model';
import type { CurrentUser, HomePoint } from '../models/auth.models';
import { authFeatureKey } from './auth.reducer';
import type { AuthState, ExternalAuthError } from './auth.state';

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

/** A `POST /auth/external` is in flight (dedicated flag, not the shared `isLoading`). */
export const selectExternalAuthPending = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.externalAuthPending ?? false,
);

/** The last failed Google sign-in (code + HTTP status), or null. */
export const selectAuthExternalError = createSelector(
  selectAuthState,
  (state: AuthState | undefined): ExternalAuthError | null => state?.externalError ?? null,
);

/**
 * ADR-030 §5: signed in with no first name — the mandatory "What should we call you?"
 * step. `user === null` (not loaded yet) is NOT "empty", so the step never flashes
 * while `/auth/me` is still in flight.
 */
export const selectNameStepRequired = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean =>
    state !== undefined &&
    state.isAuthenticated &&
    state.user !== null &&
    state.user.firstName.trim() === '',
);

export const selectNameSaving = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.nameSaving ?? false,
);

export const selectNameError = createSelector(
  selectAuthState,
  (state: AuthState | undefined): string | null => state?.nameError ?? null,
);

export const selectNameErrorCode = createSelector(
  selectAuthState,
  (state: AuthState | undefined): ApiErrorCode | null => state?.nameErrorCode ?? null,
);

export const selectPhoneSaving = createSelector(
  selectAuthState,
  (state: AuthState | undefined): boolean => state?.phoneSaving ?? false,
);

export const selectPhoneError = createSelector(
  selectAuthState,
  (state: AuthState | undefined): string | null => state?.phoneError ?? null,
);

export const selectPhoneErrorCode = createSelector(
  selectAuthState,
  (state: AuthState | undefined): ApiErrorCode | null => state?.phoneErrorCode ?? null,
);

/**
 * A LOADED user with no phone number: the phone step opens before a first listing / booking
 * request (ADR-030 §8). An unloaded user (`null`) is not "missing" — then the server's own
 * 409 `*.phone_required` is the authority, and the step opens on that instead.
 */
export const selectPhoneMissing = createSelector(
  selectAuthUser,
  (user: CurrentUser | null): boolean => user !== null && (user.phoneNumber ?? '').trim() === '',
);
