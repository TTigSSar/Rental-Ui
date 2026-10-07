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
    AuthActions.externalAuth,
    AuthActions.loadCurrentUser,
    (state): AuthState => ({
      ...state,
      isLoading: true,
      error: null,
      errorCode: null,
    }),
  ),

  // Login / register / external-auth HTTP success — token is now known.
  on(
    AuthActions.loginSuccess,
    AuthActions.registerSuccess,
    AuthActions.externalAuthSuccess,
    (state, { token }): AuthState => ({
      ...state,
      token,
      isAuthenticated: true,
      isInitializing: false,
      isLoading: false,
      error: null,
      errorCode: null,
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

  // Login / register / external-auth HTTP failure. `registerFailure` is the
  // only one of the three that carries an `errorCode` today; destructuring a
  // property the other two never set yields `undefined`, normalised to null.
  on(
    AuthActions.loginFailure,
    AuthActions.registerFailure,
    AuthActions.externalAuthFailure,
    (state, action): AuthState => ({
      ...state,
      isLoading: false,
      error: action.error,
      errorCode: 'errorCode' in action ? (action.errorCode ?? null) : null,
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
    user: null,
    token: null,
    isAuthenticated: false,
    isInitializing: false,
    isLoading: false,
    error: null,
    errorCode: null,
    homePointSaving: false,
    homePointError: null,
    homePointErrorCode: null,
  })),

  on(AuthActions.clearAuthError, (state): AuthState => ({
    ...state,
    error: null,
    errorCode: null,
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

  // Logout — explicitly NOT spreading initialAuthState so isInitializing stays false.
  on(AuthActions.logout, (): AuthState => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isInitializing: false,
    isLoading: false,
    error: null,
    errorCode: null,
    homePointSaving: false,
    homePointError: null,
    homePointErrorCode: null,
  })),
);
