import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import { AuthApiService } from '../../services/auth-api.service';
import { ExternalAuthConfigService } from '../../services/external-auth-config.service';
import {
  ExternalAuthProviderService,
  type GoogleRenderOptions,
} from '../../services/external-auth-provider.service';
import * as AuthActions from '../../store/auth.actions';
import { selectAuthExternalError, selectAuthLoading } from '../../store/auth.selectors';
import type { ExternalAuthError } from '../../store/auth.state';
import {
  GoogleSignInBlockComponent,
  NONCE_STALE_AFTER_MS,
} from './google-sign-in-block.component';

function credential(claims: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `h.${b64}.s`;
}

interface Render {
  options: GoogleRenderOptions;
  onCredential: (idToken: string) => void;
}

describe('GoogleSignInBlockComponent — nonce lifecycle (ADR-030 §3)', () => {
  let fixture: ComponentFixture<GoogleSignInBlockComponent>;
  let store: MockStore;
  let renders: Render[];
  let nonceCalls: number;
  let nonceResponses: (() => Observable<{ nonce: string; expiresAt: string }>)[];
  let currentLang: ReturnType<typeof signal<{ code: 'en' | 'hy' | 'ru' }>>;
  let now: number;
  const config = { googleClientId: 'client-id' };
  const provider = {
    renderGoogleButton: vi.fn(),
    releaseGoogleButton: vi.fn(),
  };

  function nextNonce(value: string): void {
    nonceResponses.push(() => of({ nonce: value, expiresAt: '2099-01-01T00:00:00Z' }));
  }

  function create(clientId = 'client-id'): GoogleSignInBlockComponent {
    config.googleClientId = clientId;
    fixture = TestBed.createComponent(GoogleSignInBlockComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setLoading(value: boolean): void {
    store.overrideSelector(selectAuthLoading, value);
    store.refreshState();
  }

  function setExternalError(value: ExternalAuthError | null): void {
    store.overrideSelector(selectAuthExternalError, value);
    store.refreshState();
  }

  beforeEach(() => {
    renders = [];
    nonceCalls = 0;
    nonceResponses = [];
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    currentLang = signal<{ code: 'en' | 'hy' | 'ru' }>({ code: 'en' });
    provider.renderGoogleButton.mockReset().mockImplementation(
      (_el: HTMLElement, onCredential: (t: string) => void, options: GoogleRenderOptions) => {
        renders.push({ options, onCredential });
        return Promise.resolve();
      },
    );
    provider.releaseGoogleButton.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            { selector: selectAuthLoading, value: false },
            { selector: selectAuthExternalError, value: null },
          ],
        }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: ExternalAuthConfigService, useValue: config },
        { provide: ExternalAuthProviderService, useValue: provider },
        { provide: LanguageService, useValue: { current: currentLang } },
        {
          provide: AuthApiService,
          useValue: {
            externalNonce: () => {
              nonceCalls++;
              const next = nonceResponses.shift();
              return next === undefined ? new Subject() : next();
            },
          },
        },
      ],
    });
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing and asks for no nonce when no Google client id is configured', async () => {
    create('');
    await settle();

    expect(fixture.nativeElement.querySelector('.gsi-block')).toBeNull();
    expect(nonceCalls).toBe(0);
    expect(renders).toHaveLength(0);
  });

  it('on open: fetches a nonce, then renders it with the pill/continue_with config and the UI locale', async () => {
    nextNonce('n1');
    currentLang.set({ code: 'hy' });
    create();
    await settle();

    expect(nonceCalls).toBe(1);
    expect(renders).toHaveLength(1);
    expect(renders[0].options).toMatchObject({
      nonce: 'n1',
      locale: 'hy',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
    });
    // 0 px wide under jsdom -> falls back to the maximum, always inside 200-400
    expect(renders[0].options.width).toBeGreaterThanOrEqual(200);
    expect(renders[0].options.width).toBeLessThanOrEqual(400);
  });

  it('a credential dispatches externalAuth and covers the button; a second credential while in flight is ignored', async () => {
    nextNonce('n1');
    create();
    await settle();

    renders[0].onCredential('tok-1');
    setLoading(true); // the real store flips this synchronously on dispatch
    renders[0].onCredential('tok-2');
    await settle();

    const externalAuthCalls = (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]) => a.type === AuthActions.externalAuth.type,
    );
    expect(externalAuthCalls).toHaveLength(1);
    expect(externalAuthCalls[0][0]).toEqual(
      AuthActions.externalAuth({ provider: 'google', idToken: 'tok-1' }),
    );
    expect(fixture.nativeElement.querySelector('.gsi-block__wrap--busy')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-live="polite"]').textContent).toContain(
      'auth.google.busy',
    );
  });

  it('after EVERY server answer fetches a fresh nonce and re-renders with it', async () => {
    nextNonce('n1');
    create();
    await settle();

    renders[0].onCredential('tok');
    setLoading(true);
    await settle();
    expect(nonceCalls).toBe(1); // nothing while the request is in flight

    nextNonce('n2');
    setLoading(false); // the answer (success or error — the block cannot tell and need not)
    await settle();

    expect(nonceCalls).toBe(2);
    expect(renders).toHaveLength(2);
    expect(renders[1].options.nonce).toBe('n2');
    expect(fixture.nativeElement.querySelector('.gsi-block__wrap--busy')).toBeNull();
  });

  it('never re-renders while the window is blurred (a Google popup is open); renders once focus returns', async () => {
    nextNonce('n1');
    create();
    await settle();
    expect(renders).toHaveLength(1);

    window.dispatchEvent(new Event('blur'));
    // the answer to an earlier attempt lands while the popup is open
    renders[0].onCredential('tok');
    setLoading(true);
    await settle();
    nextNonce('n2');
    setLoading(false);
    await settle();

    expect(nonceCalls).toBe(2); // the nonce is fetched ...
    expect(renders).toHaveLength(1); // ... but the button is left alone

    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(renders).toHaveLength(2);
    expect(renders[1].options.nonce).toBe('n2');
  });

  it('focus: a nonce younger than 4 minutes is kept', async () => {
    nextNonce('n1');
    create();
    await settle();

    window.dispatchEvent(new Event('blur'));
    now += NONCE_STALE_AFTER_MS - 1000;
    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(nonceCalls).toBe(1);
    expect(renders).toHaveLength(1);
  });

  it('focus: a nonce older than 4 minutes is replaced (and the button re-rendered with the new one)', async () => {
    nextNonce('n1');
    create();
    await settle();

    window.dispatchEvent(new Event('blur'));
    now += NONCE_STALE_AFTER_MS + 1000;
    nextNonce('n2');
    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(nonceCalls).toBe(2);
    expect(renders).toHaveLength(2);
    expect(renders[1].options.nonce).toBe('n2');
  });

  it('focus: a stale nonce is NOT replaced while an /external request is in flight', async () => {
    nextNonce('n1');
    create();
    await settle();

    renders[0].onCredential('tok');
    setLoading(true);
    await settle();
    window.dispatchEvent(new Event('blur'));
    now += NONCE_STALE_AFTER_MS + 1000;
    window.dispatchEvent(new Event('focus'));
    await settle();

    expect(nonceCalls).toBe(1);
  });

  it('language switch re-renders with the SAME nonce and fetches no new one', async () => {
    nextNonce('n1');
    create();
    await settle();

    currentLang.set({ code: 'ru' });
    await settle();

    expect(nonceCalls).toBe(1);
    expect(renders).toHaveLength(2);
    expect(renders[1].options).toMatchObject({ nonce: 'n1', locale: 'ru' });
  });

  it('a nonce endpoint 503 hides the block and the divider', async () => {
    nonceResponses.push(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    create();
    await settle();

    expect(fixture.nativeElement.querySelector('.gsi-block')).toBeNull();
    expect(fixture.nativeElement.querySelector('.gsi-block__or')).toBeNull();
    expect(renders).toHaveLength(0);
  });

  it('a 503 from /external removes the block and divider and says why', async () => {
    nextNonce('n1');
    create();
    await settle();

    renders[0].onCredential('tok');
    setExternalError({ error: 'x', errorCode: 'auth.external_provider_unavailable', status: 503 });
    setLoading(false);
    await settle();

    expect(fixture.nativeElement.querySelector('.gsi-block')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="google-off"]').textContent).toContain(
      'auth.google.eOff',
    );
  });

  it('a 409 link conflict emits the email claim of the credential (display only)', async () => {
    nextNonce('n1');
    const block = create();
    const emitted: (string | null)[] = [];
    block.linkConflict.subscribe((e) => emitted.push(e));
    await settle();

    renders[0].onCredential(credential({ email: 'anna.p@yahoo.com' }));
    setExternalError({ error: 'x', errorCode: 'auth.external_link_conflict', status: 409 });
    await settle();

    expect(emitted).toEqual(['anna.p@yahoo.com']);
    // not a message under the button — the dialog switches tabs
    expect(fixture.nativeElement.querySelector('[data-testid="google-error"]')).toBeNull();
  });

  it('a 409 conflict with an undecodable credential still emits (no prefill)', async () => {
    nextNonce('n1');
    const block = create();
    const emitted: (string | null)[] = [];
    block.linkConflict.subscribe((e) => emitted.push(e));
    await settle();

    renders[0].onCredential('not-a-jwt');
    setExternalError({ error: 'x', errorCode: 'auth.external_link_conflict', status: 409 });
    await settle();

    expect(emitted).toEqual([null]);
  });

  it.each([
    ['auth.external_pending_registration', 409, 'auth.google.ePending', 'info'],
    ['auth.user_blocked', 403, 'auth.google.eBlocked', 'error'],
    ['auth.external_invalid_token', 400, 'auth.google.eFail', 'error'],
    ['auth.external_email_missing', 400, 'auth.google.eFail', 'error'],
    ['auth.external_provider_unsupported', 400, 'auth.google.eFail', 'error'],
    ['something.unknown', 500, 'auth.google.eFail', 'error'],
    [null, 429, 'auth.google.eRate', 'warn'],
  ] as const)('%s (HTTP %s) shows the right message and tone', async (code, status, text, tone) => {
    nextNonce('n1');
    create();
    await settle();

    setExternalError({ error: 'raw server text', errorCode: code, status });
    await settle();

    const message = fixture.nativeElement.querySelector('[data-testid="google-error"]');
    expect(message).not.toBeNull();
    expect(message.textContent).toContain(text);
    expect(message.className).toContain(`p-message-${tone}`);
    expect(message.getAttribute('role')).toBe('alert');
    // the raw server string is never echoed
    expect(message.textContent).not.toContain('raw server text');
  });

  it('stops delivering credentials when the dialog (and so the block) is destroyed', async () => {
    nextNonce('n1');
    create();
    await settle();

    fixture.destroy();

    expect(provider.releaseGoogleButton).toHaveBeenCalledWith(renders[0].onCredential);
  });
});
