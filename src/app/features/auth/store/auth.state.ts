import type { CurrentUser } from '../models/auth.models';

export interface AuthState {
  user: CurrentUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  // Start as "loading" so the header never flashes guest state before
  // ROOT_EFFECTS_INIT fires and we know whether a token exists.
  isLoading: true,
  error: null,
};
