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
}

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,
};
