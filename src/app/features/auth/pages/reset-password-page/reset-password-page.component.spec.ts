import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';

import { AuthApiService } from '../../services/auth-api.service';
import * as AuthActions from '../../store/auth.actions';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState } from '../../store/auth.state';
import { POST_RESET_ROUTE, ResetPasswordPageComponent } from './reset-password-page.component';

const TOKEN = 'dGhpcy1pcy1hLTQzLWNoYXItYmFzZTY0dXJsLXRva2VuLXh4eHg';

function problem(status: number, errorCode: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { title: 'x', status, errorCode } });
}

function setup(
  options: {
    hash?: string;
    check?: ReturnType<typeof vi.fn>;
    reset?: ReturnType<typeof vi.fn>;
  } = {},
) {
  window.location.hash = options.hash ?? `#token=${TOKEN}`;
  const location = { path: vi.fn().mockReturnValue('/auth/reset-password'), replaceState: vi.fn() };
  const api = {
    resetPasswordCheck: options.check ?? vi.fn().mockReturnValue(of(undefined)),
    resetPassword: options.reset ?? vi.fn(),
  };
  const messages = { add: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ResetPasswordPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({ initialState: { [authFeatureKey]: initialAuthState } }),
      { provide: AuthApiService, useValue: api },
      { provide: Location, useValue: location },
      { provide: MessageService, useValue: messages },
    ],
  });
  const fixture: ComponentFixture<ResetPasswordPageComponent> =
    TestBed.createComponent(ResetPasswordPageComponent);
  const store = TestBed.inject(Store) as MockStore;
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const navigateTo = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const dispatch = vi.spyOn(store, 'dispatch');
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, api, location, dispatch, navigate, navigateTo, messages };
}

function fill(component: ResetPasswordPageComponent, password: string, confirm = password): void {
  component['form'].controls.newPassword.setValue(password);
  component['form'].controls.confirmPassword.setValue(confirm);
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('ResetPasswordPageComponent - token and link check', () => {
  it('strips the fragment on init and checks the token (the check is read-only, safe on load)', () => {
    const { location, api } = setup();

    expect(location.replaceState).toHaveBeenCalledWith('/auth/reset-password');
    expect(location.replaceState.mock.calls[0][0]).not.toContain('token');
    expect(api.resetPasswordCheck).toHaveBeenCalledWith({ token: TOKEN });
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('shows a neutral loading state while checking', () => {
    const { component, fixture } = setup({ check: vi.fn().mockReturnValue(new Subject<void>()) });

    expect(component['phase']()).toBe('checking');
    expect(fixture.nativeElement.querySelector('[data-testid="reset-checking"]')).not.toBeNull();
  });

  it('204 -> the form', () => {
    const { component, fixture } = setup();

    expect(component['phase']()).toBe('form');
    expect(fixture.nativeElement.querySelector('[data-testid="reset-submit"]')).not.toBeNull();
  });

  it('400 auth.reset_token_expired -> Expired state with "Request a new link"', () => {
    const { component, fixture } = setup({
      check: vi.fn().mockReturnValue(throwError(() => problem(400, 'auth.reset_token_expired'))),
    });

    expect(component['phase']()).toBe('expired');
    expect(fixture.nativeElement.querySelector('[data-testid="reset-expired"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="reset-request"]')).not.toBeNull();
  });

  it('400 auth.reset_token_invalid -> Invalid state', () => {
    const { component } = setup({
      check: vi.fn().mockReturnValue(throwError(() => problem(400, 'auth.reset_token_invalid'))),
    });

    expect(component['phase']()).toBe('invalid');
  });

  it('no token in the fragment -> Invalid state, and nothing is posted', () => {
    const { component, api } = setup({ hash: '' });

    expect(component['phase']()).toBe('invalid');
    expect(api.resetPasswordCheck).not.toHaveBeenCalled();
  });

  it('429 / network on the check -> inline error with a retry that keeps the token', () => {
    const check = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 429 })))
      .mockReturnValueOnce(of(undefined));
    const { component, fixture } = setup({ check });

    expect(component['phase']()).toBe('checkFailed');
    expect(fixture.nativeElement.querySelector('[data-testid="reset-check-retry"]')).not.toBeNull();

    component['checkLink']();

    expect(check).toHaveBeenLastCalledWith({ token: TOKEN });
    expect(component['phase']()).toBe('form');
  });

  it('"Request a new link" goes Home with the /?forgot marker and never carries the token', () => {
    const { component, navigateTo } = setup({ hash: '' });

    component['requestNewLink']();

    expect(navigateTo).toHaveBeenCalledWith(['/'], { queryParams: { forgot: '' } });
    expect(JSON.stringify(navigateTo.mock.calls)).not.toContain(TOKEN);
  });
});

describe('ResetPasswordPageComponent - validation', () => {
  it('too short: error after blur/submit (replaces the hint), nothing posted', () => {
    const { component, api } = setup();

    component['form'].controls.newPassword.setValue('short');
    expect(component['newPasswordErrorKey']()).toBeNull();
    component['form'].controls.newPassword.markAsTouched();
    expect(component['newPasswordErrorKey']()).toBe('auth.reset.eShort');

    fill(component, 'short');
    component['submit']();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('too long is measured in UTF-8 bytes while typing: 40 Armenian letters = 80 bytes', () => {
    const { component } = setup();

    component['form'].controls.newPassword.setValue('ա'.repeat(36)); // 72 bytes: allowed
    expect(component['newPasswordErrorKey']()).toBeNull();

    component['form'].controls.newPassword.setValue('ա'.repeat(40)); // 80 bytes, only 40 characters
    expect(component['newPasswordErrorKey']()).toBe('auth.validation.passwordTooLong');
    // No maxlength anywhere: a long paste is flagged, never cut.
    expect(component['form'].controls.newPassword.value.length).toBe(40);
  });

  it('72 Latin characters are fine, 73 are too long', () => {
    const { component } = setup();

    component['form'].controls.newPassword.setValue('a'.repeat(72));
    expect(component['newPasswordErrorKey']()).toBeNull();
    component['form'].controls.newPassword.setValue('a'.repeat(73));
    expect(component['newPasswordErrorKey']()).toBe('auth.validation.passwordTooLong');
  });

  it('mismatch: shown once Confirm is touched with both values, clears as soon as they match', () => {
    const { component, api } = setup();

    fill(component, 'Password1!', 'Password2!');
    expect(component['confirmPasswordErrorKey']()).toBeNull();
    component['form'].controls.confirmPassword.markAsTouched();
    expect(component['confirmPasswordErrorKey']()).toBe('auth.reset.eMatch');

    component['submit']();
    expect(api.resetPassword).not.toHaveBeenCalled();

    component['form'].controls.confirmPassword.setValue('Password1!');
    expect(component['confirmPasswordErrorKey']()).toBeNull();
  });

  it('an empty Confirm on submit reads as "don\'t match"', () => {
    const { component, api } = setup();

    fill(component, 'Password1!', '');
    component['submit']();

    expect(component['confirmPasswordErrorKey']()).toBe('auth.reset.eMatch');
    expect(api.resetPassword).not.toHaveBeenCalled();
  });
});

describe('ResetPasswordPageComponent - submit', () => {
  it('200: stores the session like login/verify-email, shows the toast and goes Home', () => {
    const reset = vi.fn().mockReturnValue(of({ token: 'jwt-1', expiresAt: null }));
    const { component, api, dispatch, navigate, messages } = setup({ reset });

    fill(component, 'Password1!');
    component['submit']();

    expect(api.resetPassword).toHaveBeenCalledWith({ token: TOKEN, newPassword: 'Password1!' });
    expect(dispatch).toHaveBeenCalledWith(AuthActions.verifyEmailSuccess({ token: 'jwt-1' }));
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain(TOKEN);
    expect(navigate).toHaveBeenCalledWith(POST_RESET_ROUTE);
    expect(POST_RESET_ROUTE).toBe('/');
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('while saving the form is locked and a second submit is ignored', () => {
    const pending = new Subject<never>();
    const { component, api } = setup({ reset: vi.fn().mockReturnValue(pending) });

    fill(component, 'Password1!');
    component['submit']();
    component['submit']();

    expect(component['submitting']()).toBe(true);
    expect(api.resetPassword).toHaveBeenCalledTimes(1);
  });

  it('server auth.password_too_long -> the same field error as the client check, form kept', () => {
    const { component } = setup({
      reset: vi.fn().mockReturnValue(throwError(() => problem(400, 'auth.password_too_long'))),
    });

    fill(component, 'Password1!');
    component['submit']();

    expect(component['newPasswordErrorKey']()).toBe('auth.validation.passwordTooLong');
    expect(component['phase']()).toBe('form');
    expect(component['form'].controls.newPassword.value).toBe('Password1!');
  });

  it('400 expired on submit -> Expired replaces the form; invalid -> Invalid', () => {
    const expired = setup({
      reset: vi.fn().mockReturnValue(throwError(() => problem(400, 'auth.reset_token_expired'))),
    });
    fill(expired.component, 'Password1!');
    expired.component['submit']();
    expect(expired.component['phase']()).toBe('expired');

    TestBed.resetTestingModule();
    const invalid = setup({
      reset: vi.fn().mockReturnValue(throwError(() => problem(400, 'auth.reset_token_invalid'))),
    });
    fill(invalid.component, 'Password1!');
    invalid.component['submit']();
    expect(invalid.component['phase']()).toBe('invalid');
  });

  it('5xx / network: inline error, values kept, can submit again', () => {
    const reset = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of({ token: 'jwt-2', expiresAt: null }));
    const { component, navigate } = setup({ reset });

    fill(component, 'Password1!');
    component['submit']();

    expect(component['saveError']()).toBe('fail');
    expect(component['form'].controls.newPassword.value).toBe('Password1!');

    component['submit']();
    expect(reset).toHaveBeenLastCalledWith({ token: TOKEN, newPassword: 'Password1!' });
    expect(navigate).toHaveBeenCalledWith(POST_RESET_ROUTE);
  });
});
