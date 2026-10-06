import { createAction, props } from '@ngrx/store';

import type { ApiErrorCode } from '../../../api/api-error.model';
import type {
  CurrentUser,
  ExternalAuthProvider,
  LoginRequest,
  RegisterRequest,
  UpdateHomePointRequest,
} from '../models/auth.models';

export const login = createAction(
  '[Auth] Login',
  props<{ payload: LoginRequest }>(),
);

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ token: string }>(),
);

export const loginFailure = createAction(
  '[Auth] Login Failure',
  props<{ error: string }>(),
);

export const register = createAction(
  '[Auth] Register',
  props<{ payload: RegisterRequest }>(),
);

export const registerSuccess = createAction(
  '[Auth] Register Success',
  props<{ token: string }>(),
);

/**
 * `errorCode` carries the backend's `ServiceError` code verbatim (read with
 * `getApiErrorCode`), because the sign-up wizard has to BRANCH on it rather
 * than just print it: `auth.duplicate_email` sends the user back to step 1
 * with the email field in error and everything else — including the home point
 * they just chose — preserved, while `auth.home_point_outside_yerevan` keeps
 * them on step 2 with the red inline message. Neither of those arrives as a
 * field-level validation error, so the human-readable `error` string alone
 * cannot distinguish them.
 */
export const registerFailure = createAction(
  '[Auth] Register Failure',
  props<{ error: string; errorCode?: ApiErrorCode | null }>(),
);

export const externalAuth = createAction(
  '[Auth] External Auth',
  props<{ provider: ExternalAuthProvider; idToken: string }>(),
);

export const externalAuthSuccess = createAction(
  '[Auth] External Auth Success',
  props<{ token: string }>(),
);

export const externalAuthFailure = createAction(
  '[Auth] External Auth Failure',
  props<{ error: string }>(),
);

export const loadCurrentUser = createAction('[Auth] Load Current User');

export const loadCurrentUserSuccess = createAction(
  '[Auth] Load Current User Success',
  props<{ user: CurrentUser }>(),
);

export const loadCurrentUserFailure = createAction(
  '[Auth] Load Current User Failure',
  props<{ error: string; preserveSession?: boolean }>(),
);

export const logout = createAction('[Auth] Logout');

/**
 * Dispatched once by App constructor after all effects are registered.
 * Using this instead of ROOT_EFFECTS_INIT because ROOT_EFFECTS_INIT fires from
 * the first provideEffects() call — before AuthEffects is registered — so
 * initAuth$ would miss it on a hot actions$ Subject.
 */
export const authInitStarted = createAction('[Auth] Init Started');

/** Dispatched by initAuth$ when no token exists — signals clean anonymous startup. */
export const authInitCompleted = createAction('[Auth] Init Completed');

/** Clears a stale auth error without triggering any HTTP request (e.g., when switching
 *  between login and register modes inside the auth dialog). */
export const clearAuthError = createAction('[Auth] Clear Error');

/**
 * User-initiated language switch, dispatched by `LanguageService.use()` on
 * every switch regardless of auth state. `AuthEffects.persistPreferredLanguage$`
 * gates on `selectIsAuthenticated` and persists to the backend only when
 * signed in; the local UI/localStorage switch has already happened by the
 * time this fires, so a failed persist is swallowed quietly (no revert, no
 * disruptive error surfaced to the user).
 */
export const updatePreferredLanguage = createAction(
  '[Auth] Update Preferred Language',
  props<{ code: string }>(),
);

// ── Home point (home-point model) ──────────────────────────────────
// The signed-in user's single home point: where every listing they own is
// shown from. Saving it server-side ALSO relocates all of their listings, which
// is why the profile card confirms with "this moves N toys" before dispatching.
//
// Deliberately NOT persisted anywhere on the client. The exact coordinates are
// the most sensitive value this app holds (ADR-008) and they already travel on
// every `/api/auth/me`; writing a copy into `localStorage` would leave them
// readable after logout, on a shared device, and to any XSS that gets a foothold
// — for no benefit, since the store is rehydrated from the API on every boot.

/** `PUT /api/auth/me/home-point`. */
export const updateHomePoint = createAction(
  '[Auth] Update Home Point',
  props<{ payload: UpdateHomePointRequest }>(),
);

/** Answers with the full refreshed `CurrentUserResponse`, so the whole user is
 *  replaced rather than just the point — the backend may have re-derived the
 *  public pair and the district. */
export const updateHomePointSuccess = createAction(
  '[Auth] Update Home Point Success',
  props<{ user: CurrentUser }>(),
);

/** `errorCode` is `auth.home_point_outside_yerevan` (400) for a pin outside the
 *  12 Yerevan districts — a `ServiceError` code, never a field error. */
export const updateHomePointFailure = createAction(
  '[Auth] Update Home Point Failure',
  props<{ error: string; errorCode?: ApiErrorCode | null }>(),
);

/** `DELETE /api/auth/me/home-point`. */
export const clearHomePoint = createAction('[Auth] Clear Home Point');

export const clearHomePointSuccess = createAction(
  '[Auth] Clear Home Point Success',
  props<{ user: CurrentUser }>(),
);

/** `errorCode` is `auth.home_point_in_use` (409) while the user still owns any
 *  listing — the UI blocks Remove before it gets that far, but a second tab or
 *  a race can still reach it. */
export const clearHomePointFailure = createAction(
  '[Auth] Clear Home Point Failure',
  props<{ error: string; errorCode?: ApiErrorCode | null }>(),
);

/** Drops a home-point error without firing any request — dispatched when the
 *  picker/confirmation is reopened, so a stale refusal never greets the user. */
export const clearHomePointError = createAction('[Auth] Clear Home Point Error');
