import type { ApiErrorCode } from '../../../api/api-error.model';
import type { CurrentUser } from '../models/auth.models';

/** The last failed `POST /api/auth/external`. Kept apart from `error`/`errorCode` so the
 *  password forms (which print `error`) never echo a Google failure in raw English. */
export interface ExternalAuthError {
  error: string;
  errorCode: ApiErrorCode | null;
  /** HTTP status; 0/null for a network failure. 429 carries no `errorCode`. */
  status: number | null;
}

/** Feedback line under the chat-emails switch (Settings > Notifications). */
export type ChatEmailsSaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface AuthState {
  user: CurrentUser | null;
  /** True once `user` was read with the CURRENT token (`loadCurrentUserSuccess`). The identity-bearing
   *  success actions (login / verify-email / external) clear it, so a transient `/auth/me` failure
   *  right after an A -> B token swap cannot leave user A displayed under B's token. Cleared state
   *  is NOT achieved by nulling `user`, which would hide the A -> B change from `detectSessionReplaced$`. */
  userMatchesToken: boolean;
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
  /** Set by `registerSuccess` (ADR-028): the address the confirmation link was
   *  sent to, driving the "check your email" step. Not a secret; no token. Cleared
   *  by `clearAuthError` (dialog open / tab switch), `register`, `logout`. */
  pendingVerificationEmail: string | null;
  /** A home-point PUT/DELETE is in flight. Separate from `isLoading`, which
   *  means "an authentication request is in flight" — a home-point save must
   *  not put the login/register forms into their loading state. */
  homePointSaving: boolean;
  /** Last home-point failure, message + code. Cleared on a new attempt and by
   *  `clearHomePointError`. */
  homePointError: string | null;
  homePointErrorCode: ApiErrorCode | null;
  externalError: ExternalAuthError | null;
  /** A `POST /auth/external` is in flight. Separate from `isLoading`, which login / register /
   *  loadCurrentUser share: the Google block's busy lock keys off this flag only (ADR-030 §3). */
  externalAuthPending: boolean;
  /** A `PUT /me/name` or `PUT /me/phone` is in flight (separate from `isLoading`). */
  nameSaving: boolean;
  nameError: string | null;
  nameErrorCode: ApiErrorCode | null;
  phoneSaving: boolean;
  phoneError: string | null;
  phoneErrorCode: ApiErrorCode | null;
  chatEmailsSaveState: ChatEmailsSaveState;
}

export const initialAuthState: AuthState = {
  user: null,
  userMatchesToken: false,
  token: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,
  errorCode: null,
  pendingVerificationEmail: null,
  homePointSaving: false,
  homePointError: null,
  homePointErrorCode: null,
  externalError: null,
  externalAuthPending: false,
  nameSaving: false,
  nameError: null,
  nameErrorCode: null,
  phoneSaving: false,
  phoneError: null,
  phoneErrorCode: null,
  chatEmailsSaveState: 'idle',
};
