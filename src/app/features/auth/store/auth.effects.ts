import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, filter, map, mergeMap, of, tap, withLatestFrom } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { AuthApiService } from '../services/auth-api.service';
import { ExternalAuthProviderService } from '../services/external-auth-provider.service';
import { AuthTokenService } from '../services/auth-token.service';
import * as AuthActions from './auth.actions';
import { selectAuthToken } from './auth.selectors';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error, {
    unauthorizedMessage: 'Your session has expired. Please log in again.',
    serverErrorMessage: 'Service is temporarily unavailable. Please try again.',
  });
}

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly externalAuthProvider = inject(ExternalAuthProviderService);
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

  readonly externalAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.externalAuth),
      filter(({ idToken }) => idToken.trim() !== ''),
      mergeMap(({ provider, idToken }) =>
        this.authApi.externalAuth({ provider, idToken }).pipe(
          map(({ token }) => AuthActions.externalAuthSuccess({ token })),
          catchError((error: unknown) =>
            of(AuthActions.externalAuthFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly resolveExternalAuthToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.externalAuth),
      filter(({ idToken }) => idToken === ''),
      mergeMap(({ provider }) =>
        this.externalAuthProvider.getIdToken(provider).pipe(
          map((idToken) => AuthActions.externalAuth({ provider, idToken })),
          catchError((error: unknown) =>
            of(AuthActions.externalAuthFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  readonly persistToken$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          AuthActions.loginSuccess,
          AuthActions.registerSuccess,
          AuthActions.externalAuthSuccess,
        ),
        tap(({ token }) => {
          this.tokenService.saveToken(token);
        }),
      ),
    { dispatch: false },
  );

  readonly loadCurrentUserAfterAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        AuthActions.loginSuccess,
        AuthActions.registerSuccess,
        AuthActions.externalAuthSuccess,
      ),
      map(() => AuthActions.loadCurrentUser()),
    ),
  );

  readonly navigateAfterAuthenticated$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadCurrentUserSuccess),
        tap(() => {
          if (this.router.url.startsWith('/auth/')) {
            void this.router.navigateByUrl('/listings');
          }
        }),
      ),
    { dispatch: false },
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

  readonly navigateAfterLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logout),
        tap(() => {
          void this.router.navigateByUrl('/auth/login');
        }),
      ),
    { dispatch: false },
  );

  readonly clearTokenOnCurrentUserFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadCurrentUserFailure),
        tap(() => {
          this.tokenService.removeToken();
        }),
      ),
    { dispatch: false },
  );
}
