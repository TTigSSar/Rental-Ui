import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { makeUser } from '../../../../testing/fixtures';
import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthApiService } from '../services/auth-api.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';
import { authReducer } from './auth.reducer';
import { initialAuthState, type AuthState } from './auth.state';

describe('chat emails — reducer', () => {
  const withUser = (enabled: boolean) => ({
    ...initialAuthState,
    user: makeUser({ chatEmailsEnabled: enabled }),
  });

  it('flips the switch optimistically and marks saving', () => {
    const next = authReducer(withUser(true), AuthActions.updateChatEmails({ enabled: false }));
    expect(next.user?.chatEmailsEnabled).toBe(false);
    expect(next.chatEmailsSaveState).toBe('saving');
  });

  it('marks saved on success', () => {
    const next = authReducer(
      withUser(false),
      AuthActions.updateChatEmailsSuccess({ enabled: false }),
    );
    expect(next.user?.chatEmailsEnabled).toBe(false);
    expect(next.chatEmailsSaveState).toBe('saved');
  });

  it('reverts the value and marks failed on failure', () => {
    const next = authReducer(
      withUser(false),
      AuthActions.updateChatEmailsFailure({ revertTo: true }),
    );
    expect(next.user?.chatEmailsEnabled).toBe(true);
    expect(next.chatEmailsSaveState).toBe('failed');
  });

  it('toggle, toggle, fail reverts to the server truth, not to the last flip', () => {
    let state: AuthState = withUser(true); // server says true
    state = authReducer(state, AuthActions.updateChatEmails({ enabled: false }));
    state = authReducer(state, AuthActions.updateChatEmails({ enabled: true }));
    // switchMap cancelled the first request; the second (enabled: true) fails, effect says revert to false.
    state = authReducer(state, AuthActions.updateChatEmailsFailure({ revertTo: false }));
    expect(state.user?.chatEmailsEnabled).toBe(true);
    expect(state.chatEmailsSaveState).toBe('failed');
    expect(state.chatEmailsConfirmed).toBeNull();
  });

  it('clears the feedback on reset', () => {
    const next = authReducer(
      { ...withUser(true), chatEmailsSaveState: 'failed' },
      AuthActions.resetChatEmailsSaveState(),
    );
    expect(next.chatEmailsSaveState).toBe('idle');
  });

  it('tolerates no signed-in user', () => {
    const next = authReducer(initialAuthState, AuthActions.updateChatEmails({ enabled: false }));
    expect(next.user).toBeNull();
  });
});

describe('chat emails — effect', () => {
  function setup(api: Partial<AuthApiService>) {
    const harness = actionsHarness();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        AuthEffects,
        harness.provider,
        provideMockStore(),
        { provide: AuthApiService, useValue: api },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: LanguageService, useValue: { applyFromUser: vi.fn() } },
        { provide: AuthRedirectService, useValue: { consume: vi.fn() } },
      ],
    });
    TestBed.inject(MockStore);
    return { harness, effects: TestBed.inject(AuthEffects) };
  }

  it('maps a successful PUT to updateChatEmailsSuccess', async () => {
    const updateChatEmails = vi.fn().mockReturnValue(of(makeUser({ chatEmailsEnabled: false })));
    const { harness, effects } = setup({ updateChatEmails });
    const result = collect(effects.updateChatEmails$);

    harness.send(AuthActions.updateChatEmails({ enabled: false }));
    harness.complete();

    expect(await result).toEqual([AuthActions.updateChatEmailsSuccess({ enabled: false })]);
    expect(updateChatEmails).toHaveBeenCalledWith(false);
  });

  it('maps a failed PUT to updateChatEmailsFailure reverting to the previous value', async () => {
    const updateChatEmails = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const { harness, effects } = setup({ updateChatEmails });
    const result = collect(effects.updateChatEmails$);

    harness.send(AuthActions.updateChatEmails({ enabled: false }));
    harness.complete();

    expect(await result).toEqual([AuthActions.updateChatEmailsFailure({ revertTo: true })]);
  });
});

describe('chat emails — AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('PUTs { enabled } to the contract endpoint and maps the user', () => {
    let enabled: boolean | null = null;
    service.updateChatEmails(false).subscribe((user) => (enabled = user.chatEmailsEnabled));

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.meChatEmails));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({ id: 'u', email: 'e', chatEmailsEnabled: false });

    expect(enabled).toBe(false);
  });

  it('POSTs { token } to the anonymous unsubscribe endpoint', () => {
    let result: string | null = null;
    service.unsubscribeChatEmails('tok').subscribe((r) => (result = r.result));

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.chatEmailsUnsubscribe));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok' });
    req.flush({ result: 'alreadyOff' });

    expect(result).toBe('alreadyOff');
  });
});
