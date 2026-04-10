import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { CurrentUser } from '../models/auth.models';
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
