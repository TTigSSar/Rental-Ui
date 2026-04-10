import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, filter, map, mergeMap, of, tap, withLatestFrom } from 'rxjs';

import { AuthApiService } from '../services/auth-api.service';
import { AuthTokenService } from '../services/auth-token.service';
import * as AuthActions from './auth.actions';
import { selectAuthToken } from './auth.selectors';

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }
    return error.message.length > 0 ? error.message : 'Request failed';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly authApi = inject(AuthApiService);
  private readonly tokenService = inject(AuthTokenService);

  readonly login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      mergeMap(({ payload }) =>
        this.authApi.login(payload).pipe(
          map(({ token }) => AuthActions.loginSuccess({ token })),
          catchError((error: unknown) =>
            of(AuthActions.loginFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly initAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => this.tokenService.getToken()),
      filter((token): token is string => token !== null && token !== ''),
      map(() => AuthActions.loadCurrentUser()),
    ),
  );

  readonly register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.register),
      mergeMap(({ payload }) =>
        this.authApi.register(payload).pipe(
          map(({ token }) => AuthActions.registerSuccess({ token })),
          catchError((error: unknown) =>
            of(AuthActions.registerFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly persistToken$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loginSuccess, AuthActions.registerSuccess),
        tap(({ token }) => {
          this.tokenService.saveToken(token);
        }),
      ),
    { dispatch: false },
  );

  readonly loadCurrentUserAfterAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginSuccess, AuthActions.registerSuccess),
      map(() => AuthActions.loadCurrentUser()),
    ),
  );

  readonly loadCurrentUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loadCurrentUser),
      withLatestFrom(this.store.select(selectAuthToken)),
      mergeMap(([, stateToken]) => {
        const token = stateToken ?? this.tokenService.getToken();
        if (!token) {
          return of(AuthActions.loadCurrentUserFailure({ error: 'No auth token found' }));
        }
        return this.authApi.getCurrentUser().pipe(
          map((user) => AuthActions.loadCurrentUserSuccess({ user })),
          catchError((error: unknown) =>
            of(AuthActions.loadCurrentUserFailure({ error: toErrorMessage(error) })),
          ),
        );
      }),
    ),
  );

  readonly clearTokenOnLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logout),
        tap(() => {
          this.tokenService.removeToken();
        }),
      ),
    { dispatch: false },
  );
}
