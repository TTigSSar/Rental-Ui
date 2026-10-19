import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  EMPTY,
  catchError,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  of,
  pairwise,
  switchMap,
  take,
  tap,
  withLatestFrom,
} from 'rxjs';

import { ApiErrorMapper } from '../../../api/api-error-mapper';
import { getApiErrorCode } from '../../../api/api-error.model';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import { AuthApiService } from '../services/auth-api.service';
import { ExternalAuthProviderService } from '../services/external-auth-provider.service';
import { AuthTokenService } from '../services/auth-token.service';
import * as AuthActions from './auth.actions';
import { selectAuthToken, selectAuthUser, selectIsAuthenticated } from './auth.selectors';

@Injectable()
export class AuthEffects {
  private readonly actions$ = inject(Actions);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly externalAuthProvider = inject(ExternalAuthProviderService);
  private readonly tokenService = inject(AuthTokenService);
  private readonly authRedirect = inject(AuthRedirectService);
  private readonly languageService = inject(LanguageService);

  readonly login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.login),
      mergeMap(({ payload }) =>
        this.authApi.login(payload).pipe(
          map(({ token }) => AuthActions.loginSuccess({ token })),
          catchError((error: unknown) =>
            of(
              AuthActions.loginFailure({
                error: this.apiErrors.message(error),
                // 403 `auth.email_not_verified` vs 403 `auth.user_blocked`: told
                // apart by code, never by status (ADR-028).
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly initAuth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.authInitStarted),
      take(1),
      map(() => {
        const token = this.tokenService.getToken();
        if (token !== null && token !== '') {
          return AuthActions.loadCurrentUser();
        }
        return AuthActions.authInitCompleted();
      }),
    ),
  );

  readonly register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.register),
      mergeMap(({ payload }) =>
        this.authApi.register(payload).pipe(
          map(({ email }) => AuthActions.registerSuccess({ email })),
          catchError((error: unknown) =>
            of(
              AuthActions.registerFailure({
                error: this.apiErrors.message(error),
                // Sign-up branches on this: `auth.duplicate_email` returns to
                // step 1, `auth.home_point_outside_yerevan` stays on step 2.
                errorCode: getApiErrorCode(error),
              }),
            ),
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
        // M-056: the backend reads `preferredLanguage` only when it CREATES the user,
        // so the UI language must travel with every external sign-in.
        this.authApi
          .externalAuth({
            provider,
            idToken,
            preferredLanguage: this.languageService.current().code,
          })
          .pipe(
            map(({ token }) => AuthActions.externalAuthSuccess({ token })),
            catchError((error: unknown) =>
              of(
                AuthActions.externalAuthFailure({
                  error: this.apiErrors.message(error),
                  // 409 conflict / pending / 403 blocked / 503 unavailable are told apart
                  // by code; the rate limiter's 429 carries none, hence the status.
                  errorCode: getApiErrorCode(error),
                  status: error instanceof HttpErrorResponse ? error.status : null,
                }),
              ),
            ),
          ),
      ),
    ),
  );

  /**
   * Non-Google providers (currently Apple) dispatch `externalAuth` with an
   * empty `idToken` and resolve it asynchronously here. Google is handled
   * directly by the pages via `ExternalAuthProviderService.renderGoogleButton`,
   * which dispatches `externalAuth` with the idToken already filled.
   */
  readonly resolveExternalAuthToken$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.externalAuth),
      filter(({ provider, idToken }) => provider !== 'google' && idToken === ''),
      mergeMap(({ provider }) =>
        this.externalAuthProvider.getIdToken(provider).pipe(
          map((idToken) => AuthActions.externalAuth({ provider, idToken })),
          catchError((error: unknown) =>
            of(AuthActions.externalAuthFailure({ error: this.apiErrors.message(error) })),
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
          AuthActions.verifyEmailSuccess,
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
        AuthActions.verifyEmailSuccess,
        AuthActions.externalAuthSuccess,
      ),
      map(() => AuthActions.loadCurrentUser()),
    ),
  );

  /**
   * Post-auth landing navigation. This must NOT simply key off
   * `loadCurrentUserSuccess` — that action also fires on every app
   * bootstrap/session restore (`authInitStarted` → `initAuth$` →
   * `loadCurrentUser`), and an admin reloading `/listings` (or any other
   * page) must stay put, not get yanked to `/admin`. So this effect starts
   * from the explicit-auth actions (`loginSuccess` / `externalAuthSuccess`;
   * NOT `registerSuccess` — ADR-028: register issues no token — and NOT
   * `verifyEmailSuccess`, whose page navigates to a fixed route itself so a
   * stale returnUrl can never redirect a link-driven sign-in) and `switchMap`s to the *next* `loadCurrentUserSuccess`
   * — the one produced by `loadCurrentUserAfterAuth$` for that same login —
   * so bootstrap-driven loads are structurally excluded rather than filtered
   * by a flag.
   *
   * This is the single place that decides post-auth navigation, so the
   * returnUrl and admin-landing rules can't race each other:
   *   1. A pending `AuthRedirectService` returnUrl (set by the auth guard
   *      before redirecting a guest to log in) always wins — deep-link intent
   *      beats role-based landing, for admins too.
   *   2. Otherwise, an Admin user lands in the admin console.
   *   3. Otherwise, no navigation — the user stays where they were.
   */
  readonly navigateAfterAuthenticated$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          AuthActions.loginSuccess,
          AuthActions.externalAuthSuccess,
        ),
        switchMap(() => this.actions$.pipe(ofType(AuthActions.loadCurrentUserSuccess), take(1))),
        tap(({ user }) => {
          const returnUrl = this.authRedirect.consume();
          if (returnUrl !== null) {
            void this.router.navigateByUrl(returnUrl);
            return;
          }
          if (user.roles.includes('Admin')) {
            void this.router.navigateByUrl('/admin');
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
          return of(
            AuthActions.loadCurrentUserFailure({
              error: 'No auth token found',
              preserveSession: true,
            }),
          );
        }
        return this.authApi.getCurrentUser().pipe(
          map((user) => AuthActions.loadCurrentUserSuccess({ user })),
          catchError((error: unknown) =>
            of(
              AuthActions.loadCurrentUserFailure({
                error: this.apiErrors.message(error),
                preserveSession: !(error instanceof HttpErrorResponse && error.status === 401),
              }),
            ),
          ),
        );
      }),
    ),
  );

  /**
   * `PUT /api/auth/me/home-point`. Server-side this also relocates every listing
   * the user owns, which is why the profile card confirms ("this moves N toys")
   * BEFORE dispatching — by the time this effect runs the decision is made.
   *
   * `mergeMap`, not `switchMap`: a home-point save is a write, and cancelling an
   * in-flight one because a second was dispatched would leave the first's server
   * effect (the listing relocation) unobserved rather than undone. The UI
   * disables the button while `homePointSaving` is true, so overlapping saves
   * are not a normal path anyway.
   */
  readonly updateHomePoint$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.updateHomePoint),
      mergeMap(({ payload }) =>
        this.authApi.updateHomePoint(payload).pipe(
          map((user) => AuthActions.updateHomePointSuccess({ user })),
          catchError((error: unknown) =>
            of(
              AuthActions.updateHomePointFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * `PUT /api/auth/me/name` (ADR-030 §5). The server trims; the success carries the
   * trimmed values so the store can patch the user before `/auth/me` is re-read.
   */
  readonly updateName$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.updateName),
      mergeMap(({ payload }) => {
        const firstName = payload.firstName.trim();
        const lastName = (payload.lastName ?? '').trim();
        return this.authApi.updateName({ firstName, lastName }).pipe(
          map(() => AuthActions.updateNameSuccess({ firstName, lastName })),
          catchError((error: unknown) =>
            of(
              AuthActions.updateNameFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        );
      }),
    ),
  );

  /** `PUT /api/auth/me/phone` (ADR-030 §8). The server regex rejects a LEADING space,
   *  so the value is trimmed here whatever the caller did. */
  readonly updatePhone$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.updatePhone),
      mergeMap(({ phoneNumber }) => {
        const trimmed = phoneNumber.trim();
        return this.authApi.updatePhone({ phoneNumber: trimmed }).pipe(
          map(() => AuthActions.updatePhoneSuccess({ phoneNumber: trimmed })),
          catchError((error: unknown) =>
            of(
              AuthActions.updatePhoneFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        );
      }),
    ),
  );

  /** Re-reads `/auth/me` after a name/phone write so every consumer of the user agrees
   *  with the server (the success reducers already patched the same values). */
  readonly reloadUserAfterProfileWrite$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.updateNameSuccess, AuthActions.updatePhoneSuccess),
      map(() => AuthActions.loadCurrentUser()),
    ),
  );

  /** `DELETE /api/auth/me/home-point` — 409 `auth.home_point_in_use` while the
   *  user still owns any listing. */
  readonly clearHomePoint$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.clearHomePoint),
      mergeMap(() =>
        this.authApi.clearHomePoint().pipe(
          map((user) => AuthActions.clearHomePointSuccess({ user })),
          catchError((error: unknown) =>
            of(
              AuthActions.clearHomePointFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * Identity A -> identity B with no logout in between (reset-password / verify-email success
   * while signed in, or any token swap). Watches the user id in the store, so it is independent
   * of which action replaced the token. Logout goes through `null` and never matches; a same-user
   * re-auth keeps the id and never matches either.
   */
  readonly detectSessionReplaced$ = createEffect(() =>
    this.store.select(selectAuthUser).pipe(
      map((user) => user?.id ?? null),
      distinctUntilChanged(),
      pairwise(),
      filter(([previous, current]) => previous !== null && current !== null),
      map(() => AuthActions.sessionReplaced()),
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
        tap(({ preserveSession }) => {
          if (!preserveSession) {
            this.tokenService.removeToken();
          }
        }),
      ),
    { dispatch: false },
  );

  /**
   * Inbound language sync: whenever a current user arrives (app boot with a
   * token, or right after login/register/external auth), apply their saved
   * server preference. `applyFromUser` no-ops on null/unknown, so a user
   * without a saved preference simply keeps whatever is already active.
   */
  readonly applyServerLanguage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.loadCurrentUserSuccess),
        tap(({ user }) => {
          this.languageService.applyFromUser(user.preferredLanguage);
        }),
      ),
    { dispatch: false },
  );

  /**
   * Outbound language persistence: only when the user is authenticated at
   * the moment of the switch. The local UI/localStorage switch has already
   * happened in `LanguageService.use()` by the time this runs, so a failed
   * persist is swallowed quietly — no error surfaced, no revert.
   */
  readonly persistPreferredLanguage$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.updatePreferredLanguage),
        withLatestFrom(this.store.select(selectIsAuthenticated)),
        filter(([, isAuthenticated]) => isAuthenticated),
        mergeMap(([{ code }]) =>
          this.authApi.updatePreferredLanguage(code).pipe(catchError(() => EMPTY)),
        ),
      ),
    { dispatch: false },
  );
}
