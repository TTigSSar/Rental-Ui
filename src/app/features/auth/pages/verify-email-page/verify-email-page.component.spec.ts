import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AuthApiService } from '../../services/auth-api.service';
import * as AuthActions from '../../store/auth.actions';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState } from '../../store/auth.state';
import {
  POST_VERIFY_ROUTE,
  VerifyEmailPageComponent,
  readTokenFromFragment,
} from './verify-email-page.component';

const TOKEN = 'dGhpcy1pcy1hLTQzLWNoYXItYmFzZTY0dXJsLXRva2VuLXh4eHg';

function problem(status: number, errorCode: string, title = 'Problem'): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { title, status, errorCode } });
}

function setup(options: { hash?: string; api?: Partial<AuthApiService> } = {}) {
  window.location.hash = options.hash ?? `#token=${TOKEN}`;
  const location = { path: vi.fn().mockReturnValue('/auth/verify-email'), replaceState: vi.fn() };
  const api = {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn().mockReturnValue(of(undefined)),
    ...options.api,
  };
  TestBed.configureTestingModule({
    imports: [VerifyEmailPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({ initialState: { [authFeatureKey]: initialAuthState } }),
      { provide: AuthApiService, useValue: api },
      { provide: Location, useValue: location },
    ],
  });
  const fixture: ComponentFixture<VerifyEmailPageComponent> =
    TestBed.createComponent(VerifyEmailPageComponent);
  const store = TestBed.inject(Store) as MockStore;
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const dispatch = vi.spyOn(store, 'dispatch');
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, api, location, dispatch, navigate };
}

function typePassword(component: VerifyEmailPageComponent, value: string): void {
  component['passwordForm'].controls.password.setValue(value);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

describe('readTokenFromFragment', () => {
  it('reads #token=… and ignores everything else', () => {
    expect(readTokenFromFragment(`#token=${TOKEN}`)).toBe(TOKEN);
    expect(readTokenFromFragment('')).toBeNull();
    expect(readTokenFromFragment('#token=')).toBeNull();
    expect(readTokenFromFragment('#other=1')).toBeNull();
  });
});

describe('VerifyEmailPageComponent — token handling', () => {
  it('strips the fragment from the address bar on init (path only)', () => {
    const { location } = setup();

    expect(location.replaceState).toHaveBeenCalledTimes(1);
    expect(location.replaceState).toHaveBeenCalledWith('/auth/verify-email');
    expect(location.replaceState.mock.calls[0][0]).not.toContain('token');
  });

  it('does NOT POST on load — the user must click (mail scanners)', () => {
    const { api } = setup();

    expect(api.verifyEmail).not.toHaveBeenCalled();
    expect(api.resendVerification).not.toHaveBeenCalled();
  });

  it('keeps the token out of the store, localStorage and sessionStorage', () => {
    // Node's experimental localStorage is not usable under the test runner, so
    // record every write through a fake instead.
    const writes: string[] = [];
    const fakeStorage = { setItem: (k: string, v: string) => writes.push(k + v), getItem: () => null };
    vi.stubGlobal('localStorage', fakeStorage);
    vi.stubGlobal('sessionStorage', fakeStorage);
    const { component, dispatch } = setup({
      api: { verifyEmail: vi.fn().mockReturnValue(of({ token: 'jwt-1', expiresAt: null })) },
    });
    typePassword(component, 'Password1!');
    component['submit']();

    const dispatched = JSON.stringify(dispatch.mock.calls);
    expect(dispatched).not.toContain(TOKEN);
    // Only the resulting JWT is dispatched.
    expect(dispatch).toHaveBeenCalledWith(AuthActions.verifyEmailSuccess({ token: 'jwt-1' }));
    expect(writes.join('')).not.toContain(TOKEN);
  });
});

describe('VerifyEmailPageComponent — submit', () => {
  it('posts { token, password } on click, dispatches verifyEmailSuccess and goes to the FIXED route', () => {
    const verifyEmail = vi.fn().mockReturnValue(of({ token: 'jwt-1', expiresAt: null }));
    const { component, api, dispatch, navigate } = setup({ api: { verifyEmail } });

    typePassword(component, 'Password1!');
    component['submit']();

    expect(api.verifyEmail).toHaveBeenCalledWith({ token: TOKEN, password: 'Password1!' });
    expect(dispatch).toHaveBeenCalledWith(AuthActions.verifyEmailSuccess({ token: 'jwt-1' }));
    expect(navigate).toHaveBeenCalledWith(POST_VERIFY_ROUTE);
    expect(POST_VERIFY_ROUTE).toBe('/');
  });

  it('does not post with an empty password', () => {
    const { component, api } = setup();

    component['submit']();

    expect(api.verifyEmail).not.toHaveBeenCalled();
  });

  it('wrong password (401 invalid_credentials): says so, keeps the token and lets the user retry', () => {
    const verifyEmail = vi
      .fn()
      .mockReturnValueOnce(throwError(() => problem(401, 'auth.invalid_credentials')))
      .mockReturnValueOnce(of({ token: 'jwt-2', expiresAt: null }));
    const { component, api, navigate } = setup({ api: { verifyEmail } });

    typePassword(component, 'wrong-password');
    component['submit']();

    expect(component['error']()).toBe('wrongPassword');
    expect(component['showPasswordForm']()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();

    typePassword(component, 'Password1!');
    component['submit']();

    // The SAME token was re-sent — it was never discarded.
    expect(api.verifyEmail).toHaveBeenLastCalledWith({ token: TOKEN, password: 'Password1!' });
    expect(navigate).toHaveBeenCalledWith(POST_VERIFY_ROUTE);
  });

  it.each([
    ['auth.verification_token_expired', 400, 'expired'],
    ['auth.verification_token_invalid', 400, 'invalid'],
  ])('%s: drops the token and offers a resend', (code, status, expected) => {
    const { component } = setup({
      api: { verifyEmail: vi.fn().mockReturnValue(throwError(() => problem(status, code))) },
    });

    typePassword(component, 'Password1!');
    component['submit']();

    expect(component['error']()).toBe(expected);
    expect(component['showPasswordForm']()).toBe(false);
    expect(component['showResend']()).toBe(true);
  });

  it('already verified (409): says so and opens the login dialog; no resend offered', () => {
    const { component } = setup({
      api: {
        verifyEmail: vi
          .fn()
          .mockReturnValue(throwError(() => problem(409, 'auth.email_already_verified'))),
      },
    });

    typePassword(component, 'Password1!');
    component['submit']();

    expect(component['error']()).toBe('alreadyVerified');
    expect(component['showLoginDialog']()).toBe(true);
    expect(component['showResend']()).toBe(false);
  });

  it('blocked (403 user_blocked): shows the server message, no resend', () => {
    const { component } = setup({
      api: {
        verifyEmail: vi
          .fn()
          .mockReturnValue(throwError(() => problem(403, 'auth.user_blocked', 'User is blocked'))),
      },
    });

    typePassword(component, 'Password1!');
    component['submit']();

    expect(component['error']()).toBe('blocked');
    expect(component['serverMessage']()).toBe('User is blocked');
    expect(component['showResend']()).toBe(false);
  });

  it('429: shows a try-later message and keeps the token for a later retry', () => {
    const { component } = setup({
      api: { verifyEmail: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 }))) },
    });

    typePassword(component, 'Password1!');
    component['submit']();

    expect(component['error']()).toBe('rateLimited');
    expect(component['showPasswordForm']()).toBe(true);
  });
});

describe('VerifyEmailPageComponent — no token (e.g. after a reload)', () => {
  it('asks to open the email link again, offers resend and shows no password form', () => {
    const { fixture, component, api } = setup({ hash: '' });

    expect(component['showPasswordForm']()).toBe(false);
    expect(component['showResend']()).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="verify-no-token"]')).not.toBeNull();

    typePassword(component, 'Password1!');
    component['submit']();
    expect(api.verifyEmail).not.toHaveBeenCalled();
  });
});

describe('VerifyEmailPageComponent — resend target', () => {
  it('is empty until the typed address is valid, then follows it', () => {
    const { component } = setup({ hash: '' });

    expect(component['resendTarget']()).toBe('');
    component['resendEmail'].setValue('not-an-email');
    expect(component['resendTarget']()).toBe('');
    component['resendEmail'].setValue('anna.p@gmail.com');
    expect(component['resendTarget']()).toBe('anna.p@gmail.com');
  });
});
