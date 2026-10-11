import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import { AuthApiService } from '../../services/auth-api.service';
import { ExternalAuthConfigService } from '../../services/external-auth-config.service';
import { ExternalAuthProviderService } from '../../services/external-auth-provider.service';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState, type AuthState } from '../../store/auth.state';
import { RegisterFormComponent } from '../register-form/register-form.component';
import { AuthDialogComponent } from './auth-dialog.component';

function credential(claims: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${b64}.s`;
}

describe('AuthDialogComponent — Google block (ADR-030 §9)', () => {
  let fixture: ComponentFixture<AuthDialogComponent>;
  let store: MockStore;
  let onCredential: ((idToken: string) => void) | null;
  let nonceCalls: number;
  const config = { googleClientId: 'client-id' };

  const root = (auth: Partial<AuthState>) => ({ [authFeatureKey]: { ...initialAuthState, ...auth } });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function open(mode: 'login' | 'register' = 'login'): void {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('visible', true);
  }

  beforeEach(() => {
    onCredential = null;
    nonceCalls = 0;
    config.googleClientId = 'client-id';
    TestBed.configureTestingModule({
      imports: [AuthDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({ initialState: root({}) }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: ExternalAuthConfigService, useValue: config },
        { provide: LanguageService, useValue: { current: () => ({ code: 'en' }) } },
        {
          provide: ExternalAuthProviderService,
          useValue: {
            renderGoogleButton: (_el: HTMLElement, cb: (t: string) => void) => {
              onCredential = cb;
              return Promise.resolve();
            },
            releaseGoogleButton: vi.fn(),
          },
        },
        {
          provide: AuthApiService,
          useValue: {
            externalNonce: () => {
              nonceCalls++;
              return of({ nonce: 'n', expiresAt: '2099-01-01T00:00:00Z' });
            },
          },
        },
      ],
    });
    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AuthDialogComponent);
    fixture.componentRef.setInput('visible', false);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-dialog-mask').forEach((el) => el.remove());
  });

  it('creates no Google block (and asks for no nonce) while the dialog is closed', async () => {
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).toBeNull();
    expect(nonceCalls).toBe(0);
  });

  it('Register: the block is on step 1 only - gone on the home-point step and on "check your email"', async () => {
    open('register');
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).not.toBeNull();

    const form = fixture.debugElement.query(By.directive(RegisterFormComponent));
    // step 2 (home point)
    (form.componentInstance as { step: { set(v: 1 | 2): void } }).step.set(2);
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).toBeNull();
    expect(document.querySelector('.gsi-block__or')).toBeNull();

    // back to step 1
    (form.componentInstance as { step: { set(v: 1 | 2): void } }).step.set(1);
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).not.toBeNull();

    // "check your email" state
    store.setState(root({ pendingVerificationEmail: 'a@b.co' }));
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).toBeNull();
  });

  it('Sign in tab keeps the block regardless of the register step', async () => {
    open('login');
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).not.toBeNull();
  });

  it('shows the block above the form on BOTH tabs and fetches a nonce on each opening', async () => {
    open('login');
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).not.toBeNull();
    expect(nonceCalls).toBe(1);

    const tabs = Array.from(document.querySelectorAll<HTMLElement>('.auth-dialog__tab'));
    tabs[1].click(); // Register
    await settle();
    expect(document.querySelector('app-google-sign-in-block')).not.toBeNull();
    // the same block stays across a tab switch: no new nonce
    expect(nonceCalls).toBe(1);
  });

  it('409 link conflict: switches to Sign in, shows "account exists" and prefills the email from the credential', async () => {
    open('register');
    await settle();
    expect(document.querySelector('app-register-form')).not.toBeNull();

    onCredential?.(credential({ email: 'anna.p@yahoo.com' }));
    store.setState(
      root({
        isLoading: true,
      }),
    );
    await settle();
    store.setState(
      root({
        isLoading: false,
        externalError: { error: 'x', errorCode: 'auth.external_link_conflict', status: 409 },
      }),
    );
    await settle();

    expect(document.querySelector('app-register-form')).toBeNull();
    expect(document.querySelector('app-login-form')).not.toBeNull();
    expect(document.querySelector('[data-testid="google-exists"]')).not.toBeNull();
    const email = document.querySelector<HTMLInputElement>('app-login-form input[type="email"]');
    expect(email?.value).toBe('anna.p@yahoo.com');
    // focus lands on the password field
    expect(document.activeElement).toBe(
      document.querySelector('app-login-form input[type="password"]'),
    );
  });

  it('the "account exists" message clears on a tab switch', async () => {
    open('login');
    await settle();
    onCredential?.(credential({ email: 'a@b.am' }));
    store.setState(root({ isLoading: true }));
    await settle();
    store.setState(
      root({
        externalError: { error: 'x', errorCode: 'auth.external_link_conflict', status: 409 },
      }),
    );
    await settle();
    expect(document.querySelector('[data-testid="google-exists"]')).not.toBeNull();

    const tabs = Array.from(document.querySelectorAll<HTMLElement>('.auth-dialog__tab'));
    tabs[1].click();
    await settle();
    tabs[0].click();
    await settle();

    expect(document.querySelector('[data-testid="google-exists"]')).toBeNull();
  });

  it('disables the tabs while a request is in flight', async () => {
    open('login');
    await settle();
    store.setState(root({ isLoading: true }));
    await settle();

    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.auth-dialog__tab'));
    expect(tabs.every((t) => t.disabled)).toBe(true);
  });

  it('with no Google client id the dialog is exactly the password form (no block, no divider)', async () => {
    config.googleClientId = '';
    open('login');
    await settle();

    expect(document.querySelector('.gsi-block')).toBeNull();
    expect(document.querySelector('.gsi-block__or')).toBeNull();
    expect(nonceCalls).toBe(0);
  });
});
