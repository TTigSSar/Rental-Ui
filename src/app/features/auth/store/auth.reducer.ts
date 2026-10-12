import { createReducer, on } from '@ngrx/store';

import * as AuthActions from './auth.actions';
import { initialAuthState, type AuthState } from './auth.state';

export const authFeatureKey = 'auth' as const;

export const authReducer = createReducer(
  initialAuthState,

  // Active HTTP request started.
  on(
    AuthActions.login,
    AuthActions.register,
    AuthActions.loadCurrentUser,
    (state): AuthState => ({
      ...state,
      isLoading: true,
      error: null,
      errorCode: null,
      pendingVerificationEmail: null,
    }),
  ),

  // A new Google attempt drops the previous Google failure (ADR-030: messages clear
  // on the next attempt) and, like the others, the "check your email" step.
  on(
    AuthActions.externalAuth,
    (state): AuthState => ({
      ...state,
      isLoading: true,
      externalAuthPending: true,
      error: null,
      errorCode: null,
      externalError: null,
      pendingVerificationEmail: null,
    }),
  ),

  // Login / verify-email / external-auth HTTP success — token is now known.
  on(
    AuthActions.loginSuccess,
    AuthActions.verifyEmailSuccess,
    AuthActions.externalAuthSuccess,
    (state, { token }): AuthState => ({
      ...state,
      externalAuthPending: false,
      token,
      isAuthenticated: true,
      isInitializing: false,
      isLoading: false,
      error: null,
      errorCode: null,
      externalError: null,
      pendingVerificationEmail: null,
    }),
  ),

  // Register HTTP success (ADR-028) — NO token and NOT authenticated: the account
  // is unverified. Only remembers the address so the dialog can show the
  // "check your email" step.
  on(
    AuthActions.registerSuccess,
    (state, { email }): AuthState => ({
      ...state,
      isLoading: false,
      error: null,
      errorCode: null,
      pendingVerificationEmail: email,
    }),
  ),

  // /auth/me resolved — user is confirmed authenticated.
  on(AuthActions.loadCurrentUserSuccess, (state, { user }): AuthState => ({
    ...state,
    user,
    isAuthenticated: true,
    isInitializing: false,
    isLoading: false,
    error: null,
    errorCode: null,
  })),

  // Login / register HTTP failure. Both carry an `errorCode`; an action that never set
  // one yields `undefined`, normalised to null.
  on(
    AuthActions.loginFailure,
    AuthActions.registerFailure,
    (state, action): AuthState => ({
      ...state,
      isLoading: false,
      error: action.error,
      errorCode: 'errorCode' in action ? (action.errorCode ?? null) : null,
    }),
  ),

  // External-auth failure (ADR-030). Stored in its OWN slot, with code and HTTP status,
  // so the Google block can pick a message/tone and the password forms (which print
  // `error`) never show a Google failure as a raw English string.
  on(
    AuthActions.externalAuthFailure,
    (state, { error, errorCode, status }): AuthState => ({
      ...state,
      isLoading: false,
      externalAuthPending: false,
      externalError: { error, errorCode: errorCode ?? null, status: status ?? null },
    }),
  ),

  // /auth/me failure.
  // preserveSession: true  → keep token & isAuthenticated (non-401, transient error).
  // preserveSession: false → clear token & isAuthenticated (401, token rejected).
  on(
    AuthActions.loadCurrentUserFailure,
    (state, { error, preserveSession = false }): AuthState => ({
      ...state,
      user: null,
      token: preserveSession ? state.token : null,
      isAuthenticated: preserveSession ? state.isAuthenticated : false,
      isInitializing: false,
      isLoading: false,
      error,
      errorCode: null,
    }),
  ),

  // No token found during startup — anonymous session confirmed.
  on(AuthActions.authInitCompleted, (): AuthState => ({
    ...initialAuthState,
    isInitializing: false,
  })),

  // Also drops the "check your email" step: the auth dialog dispatches this on
  // open and on every tab switch, which is exactly when that step must reset.
  on(AuthActions.clearAuthError, (state): AuthState => ({
    ...state,
    error: null,
    errorCode: null,
    externalError: null,
    pendingVerificationEmail: null,
  })),

  // ── Home point ────────────────────────────────────────────────
  on(
    AuthActions.updateHomePoint,
    AuthActions.clearHomePoint,
    (state): AuthState => ({
      ...state,
      homePointSaving: true,
      homePointError: null,
      homePointErrorCode: null,
    }),
  ),

  // Both routes answer with the full refreshed CurrentUserResponse, so the
  // whole user is replaced: the backend re-derives the public pair and the
  // district, and patching only `homePoint.latitude/longitude` locally would
  // leave those two stale until the next /auth/me.
  on(
    AuthActions.updateHomePointSuccess,
    AuthActions.clearHomePointSuccess,
    (state, { user }): AuthState => ({
      ...state,
      user,
      homePointSaving: false,
      homePointError: null,
      homePointErrorCode: null,
    }),
  ),

  on(
    AuthActions.updateHomePointFailure,
    AuthActions.clearHomePointFailure,
    (state, { error, errorCode }): AuthState => ({
      ...state,
      homePointSaving: false,
      homePointError: error,
      homePointErrorCode: errorCode ?? null,
    }),
  ),

  on(AuthActions.clearHomePointError, (state): AuthState => ({
    ...state,
    homePointError: null,
    homePointErrorCode: null,
  })),

  // Logout — explicitly keeps isInitializing false (the startup hydration is long done).
  on(AuthActions.logout, (): AuthState => ({
    ...initialAuthState,
    isInitializing: false,
  })),

  // ── Name and phone (ADR-030) ──────────────────────────────────
  on(AuthActions.updateName, (state): AuthState => ({
    ...state,
    nameSaving: true,
    nameError: null,
    nameErrorCode: null,
  })),

  // The server answers 204, so the user is patched with the trimmed values the request
  // carried; `reloadUserAfterProfileWrite$` then re-reads /auth/me to confirm.
  on(AuthActions.updateNameSuccess, (state, { firstName, lastName }): AuthState => ({
    ...state,
    user: state.user === null ? null : { ...state.user, firstName, lastName },
    nameSaving: false,
    nameError: null,
    nameErrorCode: null,
  })),

  on(AuthActions.updateNameFailure, (state, { error, errorCode }): AuthState => ({
    ...state,
    nameSaving: false,
    nameError: error,
    nameErrorCode: errorCode ?? null,
  })),

  on(AuthActions.updatePhone, (state): AuthState => ({
    ...state,
    phoneSaving: true,
    phoneError: null,
    phoneErrorCode: null,
  })),

  on(AuthActions.updatePhoneSuccess, (state, { phoneNumber }): AuthState => ({
    ...state,
    user: state.user === null ? null : { ...state.user, phoneNumber },
    phoneSaving: false,
    phoneError: null,
    phoneErrorCode: null,
  })),

  on(AuthActions.updatePhoneFailure, (state, { error, errorCode }): AuthState => ({
    ...state,
    phoneSaving: false,
    phoneError: error,
    phoneErrorCode: errorCode ?? null,
  })),

  on(AuthActions.clearProfileWriteError, (state): AuthState => ({
    ...state,
    nameError: null,
    nameErrorCode: null,
    phoneError: null,
    phoneErrorCode: null,
  })),
);
