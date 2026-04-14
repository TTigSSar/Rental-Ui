import { createReducer, on } from '@ngrx/store';

import * as AuthActions from './auth.actions';
import { initialAuthState, type AuthState } from './auth.state';

export const authFeatureKey = 'auth' as const;

export const authReducer = createReducer(
  initialAuthState,
  on(AuthActions.login, AuthActions.register, AuthActions.loadCurrentUser, (state): AuthState => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(AuthActions.loginSuccess, AuthActions.registerSuccess, (state, { token }): AuthState => ({
    ...state,
    token,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  })),
  on(AuthActions.loadCurrentUserSuccess, (state, { user }): AuthState => ({
    ...state,
    user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  })),
  on(
    AuthActions.loginFailure,
    AuthActions.registerFailure,
    (state, { error }): AuthState => ({
      ...state,
      isLoading: false,
      error,
    }),
  ),
  on(AuthActions.loadCurrentUserFailure, (state, { error }): AuthState => ({
    ...state,
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error,
  })),
  on(AuthActions.logout, (): AuthState => ({
    ...initialAuthState,
  })),
);
