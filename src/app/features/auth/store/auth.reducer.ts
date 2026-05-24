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
  })),

  // Login / register / external-auth HTTP failure.
  on(
    AuthActions.loginFailure,
    AuthActions.registerFailure,
    AuthActions.externalAuthFailure,
    (state, { error }): AuthState => ({
      ...state,
      isLoading: false,
      error,
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
  })),

  // Logout — explicitly NOT spreading initialAuthState so isInitializing stays false.
  on(AuthActions.logout, (): AuthState => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isInitializing: false,
    isLoading: false,
    error: null,
  })),
);
