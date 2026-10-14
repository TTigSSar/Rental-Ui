import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import { AuthApiService } from '../../services/auth-api.service';
import { ExternalAuthConfigService } from '../../services/external-auth-config.service';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState } from '../../store/auth.state';
import { ForgotPasswordComponent } from './forgot-password.component';

function problem(status: number, errorCode: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { title: 'x', status, errorCode } });
}

const UNAVAILABLE = problem(503, 'auth.password_reset_unavailable');

function setup(
  options: { email?: string; forgot?: ReturnType<typeof vi.fn>; googleClientId?: string } = {},
) {
  const forgotPassword = options.forgot ?? vi.fn().mockReturnValue(of(undefined));
  TestBed.configureTestingModule({
    imports: [ForgotPasswordComponent, TranslateModule.forRoot()],
    providers: [
      provideMockStore({ initialState: { [authFeatureKey]: initialAuthState } }),
      { provide: AuthApiService, useValue: { forgotPassword } },
      { provide: ExternalAuthConfigService, useValue: { googleClientId: options.googleClientId ?? '' } },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    auth: {
      forgot: {
        chkS: 'If an account exists for <b>{{email}}</b>, we sent a link.',
        againIn: 'Send again in <b>{{time}}</b>',
      },
    },
  });
  translate.use('en');
  const fixture: ComponentFixture<ForgotPasswordComponent> =
    TestBed.createComponent(ForgotPasswordComponent);
  fixture.componentRef.setInput('initialEmail', options.email ?? '');
  const backToLogin = vi.fn();
  fixture.componentInstance.backToLogin.subscribe(backToLogin);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, component: fixture.componentInstance, forgotPassword, backToLogin, el };
}

function type(component: ForgotPasswordComponent, value: string): void {
  component['email'].setValue(value);
}

describe('ForgotPasswordComponent - request step', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('copies the Sign in email as typed, even when it is not a valid address', () => {
    const { component } = setup({ email: 'not-an-email' });

    expect(component['email'].value).toBe('not-an-email');
    expect(component['step']()).toBe('request');
  });

  it('empty field: field error, no server call', () => {
    const { component, forgotPassword } = setup();

    component['submit']();

    expect(component['fieldError']()).toBe('empty');
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('invalid format: field error that clears as soon as the user edits; no server call', () => {
    const { component, forgotPassword } = setup({ email: 'anna@' });

    component['submit']();
    expect(component['fieldError']()).toBe('invalid');
    expect(forgotPassword).not.toHaveBeenCalled();

    type(component, 'anna@e');
    expect(component['fieldError']()).toBeNull();
  });

  it('valid: posts the trimmed address and moves to Check your email on 202', () => {
    const { component, forgotPassword, fixture, el } = setup({ email: ' anna@example.com ' });

    component['submit']();
    fixture.detectChanges();

    expect(forgotPassword).toHaveBeenCalledTimes(1);
    expect(forgotPassword.mock.calls[0][0].email).toBe('anna@example.com');
    expect(component['step']()).toBe('check');
    expect(el.querySelector('[data-testid="fp-check"]')).not.toBeNull();
    // The address is shown in bold, as text (never markup).
    expect(el.querySelector('[data-testid="fp-check-text"] b')?.textContent).toBe('anna@example.com');
    expect(el.querySelector('[data-testid="fp-check-text"]')?.textContent).toContain('If an account exists');
  });

  it('escapes the address it echoes back', () => {
    const { component, fixture, el } = setup({ email: 'a"<img src=x>"@example.com' });
    // Not a valid address, so go through the again-path state directly.
    component['submittedEmail'].set('a<img src=x onerror=1>@example.com');
    component['step'].set('check');
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="fp-check-text"] img')).toBeNull();
    expect(el.querySelector('[data-testid="fp-check-text"] b')?.textContent).toContain('<img');
  });

  it('sends preferredLanguage = the current UI language (M-056: switch to hy, assert "hy")', () => {
    const { component, forgotPassword } = setup({ email: 'anna@example.com' });

    component['submit']();
    expect(forgotPassword.mock.calls[0][0].preferredLanguage).toBe('en');

    TestBed.inject(LanguageService).use('hy');
    forgotPassword.mockClear();
    component['useOtherEmail']();
    type(component, 'anna@example.com');
    component['submit']();

    expect(forgotPassword).toHaveBeenCalledTimes(1);
    expect(forgotPassword.mock.calls[0][0]).toEqual({
      email: 'anna@example.com',
      preferredLanguage: 'hy',
    });
  });

  it('Enter / the native submit event is handled in-app (never a page reload)', () => {
    const { el, forgotPassword } = setup({ email: 'anna@example.com' });

    const event = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(forgotPassword).toHaveBeenCalledTimes(1);
  });

  it('sending: ignores a second submit while the request is in flight', () => {
    const pending = new Subject<void>();
    const { component, forgotPassword } = setup({
      email: 'anna@example.com',
      forgot: vi.fn().mockReturnValue(pending),
    });

    component['submit']();
    component['submit']();

    expect(component['sending']()).toBe(true);
    expect(forgotPassword).toHaveBeenCalledTimes(1);
  });

  it('503 auth.password_reset_unavailable: Unavailable state, address kept, no toast', () => {
    const { component, fixture, el } = setup({
      email: 'anna@example.com',
      forgot: vi.fn().mockReturnValue(throwError(() => UNAVAILABLE)),
    });

    component['submit']();
    fixture.detectChanges();

    expect(component['step']()).toBe('unavailable');
    expect(component['email'].value).toBe('anna@example.com');
    expect(el.querySelector('[data-testid="fp-unavailable"]')).not.toBeNull();
  });

  it('a 503 without the reset errorCode is a plain failure, not the Unavailable state', () => {
    const { component, fixture, el } = setup({
      email: 'anna@example.com',
      forgot: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 }))),
    });

    component['submit']();
    fixture.detectChanges();

    expect(component['step']()).toBe('request');
    expect(el.querySelector('[data-testid="fp-fail"]')).not.toBeNull();
  });

  it('429 (no body): rate-limit warn message, stays on Request', () => {
    const { component, fixture, el } = setup({
      email: 'anna@example.com',
      forgot: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 }))),
    });

    component['submit']();
    fixture.detectChanges();

    expect(component['step']()).toBe('request');
    expect(el.querySelector('[data-testid="fp-rate"]')).not.toBeNull();
  });

  it('5xx / no response: inline "couldn\'t send" error, field value kept', () => {
    const { component, fixture, el } = setup({
      email: 'anna@example.com',
      forgot: vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 }))),
    });

    component['submit']();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="fp-fail"]')).not.toBeNull();
    expect(component['email'].value).toBe('anna@example.com');
  });

  it('Back to Sign in carries the address back', () => {
    const { component, backToLogin } = setup({ email: 'anna@exam' });

    component['back']();

    expect(backToLogin).toHaveBeenCalledWith('anna@exam');
  });
});

describe('ForgotPasswordComponent - check step', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function sent() {
    const ctx = setup({ email: 'anna@example.com' });
    ctx.component['submit']();
    ctx.fixture.detectChanges();
    return ctx;
  }

  it('starts at 1:00 as plain text (no disabled button), counts down, then offers "Send again"', () => {
    const { component, fixture, el } = sent();

    expect(component['cooldownLabel']()).toBe('1:00');
    expect(el.querySelector('[data-testid="fp-countdown"]')?.textContent).toContain('1:00');
    expect(el.querySelector('[data-testid="fp-again"]')).toBeNull();
    // Nothing disabled-looking to click: ignored in the model as well.
    component['sendAgain']();
    expect(TestBed.inject(AuthApiService).forgotPassword).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_000);
    expect(component['cooldownLabel']()).toBe('0:59');
    vi.advanceTimersByTime(59_000);
    fixture.detectChanges();

    expect(component['cooldown']()).toBe(0);
    expect(el.querySelector('[data-testid="fp-countdown"]')).toBeNull();
    expect(el.querySelector('[data-testid="fp-again"]')).not.toBeNull();
    // The polite live region carries the announcement only now.
    expect(el.querySelector('.fp__sr')?.textContent?.trim()).not.toBe('');
  });

  it('keeps the live region silent while the countdown runs', () => {
    const { el } = sent();

    expect(el.querySelector('.fp__sr')?.textContent?.trim()).toBe('');
  });

  it('"Send again" re-sends to the same address, shows the ok message and restarts at 1:00', () => {
    const { component, fixture, el } = sent();
    vi.advanceTimersByTime(60_000);

    component['sendAgain']();
    fixture.detectChanges();

    const api = TestBed.inject(AuthApiService).forgotPassword as ReturnType<typeof vi.fn>;
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls[1][0].email).toBe('anna@example.com');
    expect(component['cooldownLabel']()).toBe('1:00');
    expect(el.querySelector('[data-testid="fp-sent-again"]')).not.toBeNull();
  });

  it('429 on "Send again": rate-limit warn message in this step', () => {
    const { component, fixture, el } = sent();
    vi.advanceTimersByTime(60_000);
    (TestBed.inject(AuthApiService).forgotPassword as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429 })),
    );

    component['sendAgain']();
    fixture.detectChanges();

    expect(component['step']()).toBe('check');
    expect(el.querySelector('[data-testid="fp-rate"]')).not.toBeNull();
  });

  it('503 on "Send again": Unavailable state', () => {
    const { component } = sent();
    vi.advanceTimersByTime(60_000);
    (TestBed.inject(AuthApiService).forgotPassword as ReturnType<typeof vi.fn>).mockReturnValue(
      throwError(() => UNAVAILABLE),
    );

    component['sendAgain']();

    expect(component['step']()).toBe('unavailable');
    expect(component['email'].value).toBe('anna@example.com');
  });

  it('"Use a different email" returns to Request with the address in the field', () => {
    const { component } = sent();

    component['useOtherEmail']();

    expect(component['step']()).toBe('request');
    expect(component['email'].value).toBe('anna@example.com');
    expect(component['cooldown']()).toBe(0);
  });

  it('the countdown survives a language switch (state is a number, not text)', () => {
    const { component } = sent();
    vi.advanceTimersByTime(10_000);

    TestBed.inject(LanguageService).use('ru');

    expect(component['cooldown']()).toBe(50);
  });
});

describe('ForgotPasswordComponent - Unavailable state', () => {
  function unavailable(googleClientId: string) {
    const ctx = setup({
      email: 'anna@example.com',
      googleClientId,
      forgot: vi.fn().mockReturnValueOnce(throwError(() => UNAVAILABLE)),
    });
    ctx.component['submit']();
    ctx.fixture.detectChanges();
    return ctx;
  }

  it('shows the Google hint only when Google sign-in is configured', () => {
    expect(unavailable('client-id').el.querySelector('[data-testid="fp-google-hint"]')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(unavailable('').el.querySelector('[data-testid="fp-google-hint"]')).toBeNull();
  });

  it('"Try again": 202 -> Check your email; still 503 -> stays here; 429 -> warn', () => {
    const { component, forgotPassword } = unavailable('');

    forgotPassword.mockReturnValueOnce(throwError(() => UNAVAILABLE));
    component['submit']();
    expect(component['step']()).toBe('unavailable');

    forgotPassword.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 429 })));
    component['submit']();
    expect(component['notice']()).toBe('rate');

    forgotPassword.mockReturnValueOnce(of(undefined));
    component['submit']();
    expect(component['step']()).toBe('check');
  });
});
