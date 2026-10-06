import type { ApiErrorCode } from '../../../api/api-error.model';
import type { CurrentUser } from '../models/auth.models';

export interface AuthState {
  user: CurrentUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True only during the one-time startup hydration (ROOT_EFFECTS_INIT → /auth/me or no-token). Never goes back to true. */
  isInitializing: boolean;
  /** True while an explicit HTTP request (login / register / /auth/me) is in flight. */
  isLoading: boolean;
  error: string | null;
  /** The backend `ServiceError` code behind `error`, when there was one. The
   *  sign-up wizard branches on this (duplicate email → back to step 1;
   *  home point outside Yerevan → stay on step 2), which a human-readable
   *  message cannot support. Null for network/validation failures. */
  errorCode: ApiErrorCode | null;
  /** A home-point PUT/DELETE is in flight. Separate from `isLoading`, which
   *  means "an authentication request is in flight" — a home-point save must
   *  not put the login/register forms into their loading state. */
  homePointSaving: boolean;
  /** Last home-point failure, message + code. Cleared on a new attempt and by
   *  `clearHomePointError`. */
  homePointError: string | null;
  homePointErrorCode: ApiErrorCode | null;
}

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,
  errorCode: null,
  homePointSaving: false,
  homePointError: null,
  homePointErrorCode: null,
};
