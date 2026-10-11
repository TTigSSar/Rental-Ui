import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { actionsHarness } from '../../../../testing/ngrx.helpers';
import { makeUser } from '../../../../testing/fixtures';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthApiService } from '../services/auth-api.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import { AuthTokenService } from '../services/auth-token.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';
import { authReducer } from './auth.reducer';
import {
  selectNameStepRequired,
  selectHasPhone,
} from './auth.selectors';
import { initialAuthState, type AuthState } from './auth.state';

function stateWith(overrides: Partial<AuthState>): AuthState {
  return { ...initialAuthState, ...overrides };
}

describe('authReducer — Google failure slot (ADR-030)', () => {
  it('keeps the errorCode and HTTP status of externalAuthFailure, and leaves the password-form error alone', () => {
    const next = authReducer(
      stateWith({ isLoading: true }),
      AuthActions.externalAuthFailure({
        error: 'Conflict',
        errorCode: 'auth.external_link_conflict',
        status: 409,
      }),
    );

    expect(next.isLoading).toBe(false);
    expect(next.externalError).toEqual({
      error: 'Conflict',
      errorCode: 'auth.external_link_conflict',
      status: 409,
    });
    // The login/register forms print `error`; a Google failure must not reach them.
    expect(next.error).toBeNull();
    expect(next.errorCode).toBeNull();
  });

  it('normalises a missing code/status (429 has no code) to null', () => {
    const next = authReducer(
      stateWith({}),
      AuthActions.externalAuthFailure({ error: 'Too many requests', status: 429 }),
    );
    expect(next.externalError).toEqual({ error: 'Too many requests', errorCode: null, status: 429 });
  });

  it('clears the previous Google failure on the next attempt and on clearAuthError', () => {
    const failed = stateWith({
      externalError: { error: 'x', errorCode: 'auth.user_blocked', status: 403 },
    });
    expect(
      authReducer(failed, AuthActions.externalAuth({ provider: 'google', idToken: 't' }))
        .externalError,
    ).toBeNull();
    expect(authReducer(failed, AuthActions.clearAuthError()).externalError).toBeNull();
  });
});

describe('authReducer — name and phone (ADR-030)', () => {
  const signedIn = stateWith({
    isAuthenticated: true,
    user: makeUser({ firstName: '', lastName: '', phoneNumber: null }),
  });

  it('patches the user with the trimmed name the server accepted', () => {
    const saving = authReducer(
      signedIn,
      AuthActions.updateName({ payload: { firstName: ' Anna ', lastName: '' } }),
    );
    expect(saving.nameSaving).toBe(true);

    const done = authReducer(
      saving,
      AuthActions.updateNameSuccess({ firstName: 'Anna', lastName: '' }),
    );
    expect(done.nameSaving).toBe(false);
    expect(done.user?.firstName).toBe('Anna');
  });

  it('keeps the error code of a refused name', () => {
    const next = authReducer(
      signedIn,
      AuthActions.updateNameFailure({ error: 'bad', errorCode: 'auth.invalid_name' }),
    );
    expect(next.nameError).toBe('bad');
    expect(next.nameErrorCode).toBe('auth.invalid_name');
    expect(next.nameSaving).toBe(false);
  });

  it('patches the phone and clears a refusal with clearProfileWriteError', () => {
    const done = authReducer(signedIn, AuthActions.updatePhoneSuccess({ phoneNumber: '+374 99 1' }));
    expect(done.user?.phoneNumber).toBe('+374 99 1');

    const failed = authReducer(done, AuthActions.updatePhoneFailure({ error: 'x' }));
    expect(failed.phoneError).toBe('x');
    const cleared = authReducer(failed, AuthActions.clearProfileWriteError());
    expect(cleared.phoneError).toBeNull();
    expect(cleared.phoneErrorCode).toBeNull();
  });
});

describe('name step / phone selectors', () => {
  const root = (auth: AuthState) => ({ auth });

  it('requires a name only for a signed-in, loaded user with an empty first name', () => {
    const empty = makeUser({ firstName: '   ' });
    expect(
      selectNameStepRequired(root(stateWith({ isAuthenticated: true, user: empty }))),
    ).toBe(true);
    expect(
      selectNameStepRequired(
        root(stateWith({ isAuthenticated: true, user: makeUser({ firstName: 'Anna' }) })),
      ),
    ).toBe(false);
    // Token present but /auth/me not loaded yet — the step must not flash.
    expect(selectNameStepRequired(root(stateWith({ isAuthenticated: true, user: null })))).toBe(false);
    expect(selectNameStepRequired(root(stateWith({ isAuthenticated: false, user: empty })))).toBe(false);
  });

  it('treats null and whitespace-only phones as missing', () => {
    const has = (phoneNumber: string | null) =>
      selectHasPhone(root(stateWith({ user: makeUser({ phoneNumber }) })));
    expect(has(null)).toBe(false);
    expect(has('  ')).toBe(false);
    expect(has('+374 99 123 456')).toBe(true);
  });
});

describe('AuthEffects — Google sign-in (ADR-030)', () => {
  function setup(api: Partial<AuthApiService> = {}) {
    const harness = actionsHarness();
    TestBed.configureTestingModule({
      providers: [
        AuthEffects,
        harness.provider,
        provideMockStore(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthApiService, useValue: api },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: AuthRedirectService, useValue: { consume: vi.fn().mockReturnValue(null) } },
        { provide: AuthTokenService, useValue: { getToken: vi.fn(), saveToken: vi.fn() } },
      ],
    });
    TestBed.inject(MockStore);
    return { harness, effects: TestBed.inject(AuthEffects) };
  }

  it('maps each failure to its errorCode and HTTP status (429 has no code)', () => {
    const cases: { status: number; body: unknown; code: string | null }[] = [
      { status: 409, body: { title: 'x', errorCode: 'auth.external_pending_registration' }, code: 'auth.external_pending_registration' },
      { status: 403, body: { title: 'x', errorCode: 'auth.user_blocked' }, code: 'auth.user_blocked' },
      { status: 503, body: { title: 'x', errorCode: 'auth.external_provider_unavailable' }, code: 'auth.external_provider_unavailable' },
      { status: 429, body: null, code: null },
    ];
    for (const c of cases) {
      TestBed.resetTestingModule();
      const externalAuth = vi
        .fn()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status: c.status, error: c.body })));
      const { harness, effects } = setup({ externalAuth });
      const emitted: unknown[] = [];
      effects.externalAuth$.subscribe((a) => emitted.push(a));

      harness.send(AuthActions.externalAuth({ provider: 'google', idToken: 'tok' }));

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        type: AuthActions.externalAuthFailure.type,
        errorCode: c.code,
        status: c.status,
      });
    }
  });

  it('dispatches nothing for a blank id token', () => {
    const externalAuth = vi.fn().mockReturnValue(of({ token: 't' }));
    const { harness, effects } = setup({ externalAuth });
    effects.externalAuth$.subscribe();
    harness.send(AuthActions.externalAuth({ provider: 'google', idToken: '  ' }));
    expect(externalAuth).not.toHaveBeenCalled();
  });

  it('trims the name before PUT me/name and again for the success payload', () => {
    const updateName = vi.fn().mockReturnValue(of(undefined));
    const { harness, effects } = setup({ updateName });
    const emitted: unknown[] = [];
    effects.updateName$.subscribe((a) => emitted.push(a));

    harness.send(AuthActions.updateName({ payload: { firstName: '  Anna ', lastName: ' P ' } }));

    expect(updateName).toHaveBeenCalledWith({ firstName: 'Anna', lastName: 'P' });
    expect(emitted).toEqual([AuthActions.updateNameSuccess({ firstName: 'Anna', lastName: 'P' })]);
  });

  it('trims the phone (the server regex rejects a leading space) and keeps the error code on failure', () => {
    const updatePhone = vi
      .fn()
      .mockReturnValueOnce(of(undefined))
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 400, error: { title: 'bad' } })),
      );
    const { harness, effects } = setup({ updatePhone });
    const emitted: unknown[] = [];
    effects.updatePhone$.subscribe((a) => emitted.push(a));

    harness.send(AuthActions.updatePhone({ phoneNumber: '  +374 99 123 456 ' }));
    harness.send(AuthActions.updatePhone({ phoneNumber: '1' }));

    expect(updatePhone).toHaveBeenNthCalledWith(1, { phoneNumber: '+374 99 123 456' });
    expect(emitted[0]).toEqual(AuthActions.updatePhoneSuccess({ phoneNumber: '+374 99 123 456' }));
    expect(emitted[1]).toMatchObject({ type: AuthActions.updatePhoneFailure.type, error: 'bad' });
  });

  it('re-reads /auth/me after a name or phone write', () => {
    const { harness, effects } = setup();
    const emitted: unknown[] = [];
    effects.reloadUserAfterProfileWrite$.subscribe((a) => emitted.push(a));

    harness.send(AuthActions.updateNameSuccess({ firstName: 'A', lastName: '' }));
    harness.send(AuthActions.updatePhoneSuccess({ phoneNumber: '1' }));

    expect(emitted).toEqual([AuthActions.loadCurrentUser(), AuthActions.loadCurrentUser()]);
  });
});

/**
 * M-056: the backend reads `preferredLanguage` only when it CREATES a user, so the UI
 * language has to be on the wire of every /external call. Real service + HTTP layer,
 * so a field renamed or dropped anywhere between the effect and the wire fails here.
 */
describe('POST /api/auth/external — preferredLanguage on the wire (M-056)', () => {
  it('carries the UI language the user switched to (hy)', () => {
    const harness = actionsHarness();
    TestBed.configureTestingModule({
      providers: [
        AuthEffects,
        harness.provider,
        provideMockStore(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: AuthRedirectService, useValue: { consume: vi.fn().mockReturnValue(null) } },
        { provide: AuthTokenService, useValue: { getToken: vi.fn(), saveToken: vi.fn() } },
      ],
    });
    TestBed.inject(MockStore);
    const http = TestBed.inject(HttpTestingController);
    const effects = TestBed.inject(AuthEffects);
    effects.externalAuth$.subscribe();

    TestBed.inject(LanguageService).use('hy');
    harness.send(AuthActions.externalAuth({ provider: 'google', idToken: 'google-id-token' }));

    const req = http.expectOne(toApiUrl(ApiContract.auth.external));
    expect(req.request.body).toEqual({
      provider: 'google',
      idToken: 'google-id-token',
      preferredLanguage: 'hy',
    });
    req.flush({ token: 'jwt' });
    http.verify();
  });
});
