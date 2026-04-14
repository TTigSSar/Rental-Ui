import { createAction, props } from '@ngrx/store';

import type {
  CurrentUser,
  ExternalAuthProvider,
  LoginRequest,
  RegisterRequest,
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

export const registerFailure = createAction(
  '[Auth] Register Failure',
  props<{ error: string }>(),
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
  props<{ error: string }>(),
);

export const logout = createAction('[Auth] Logout');
