import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';

import { actionsHarness } from '../../../../testing/ngrx.helpers';
import { makeAdmin, makeUser } from '../../../../testing/fixtures';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthApiService } from '../services/auth-api.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';
import { selectIsAuthenticated } from './auth.selectors';

function setup(api: Partial<AuthApiService> = {}, authRedirect: Partial<AuthRedirectService> = {}) {
  const harness = actionsHarness();
  const languageService = { applyFromUser: vi.fn() };
  const router = { navigateByUrl: vi.fn() };
  const authRedirectService = { consume: vi.fn().mockReturnValue(null), ...authRedirect };
  TestBed.configureTestingModule({
    providers: [
      AuthEffects,
      harness.provider,
      provideMockStore(),
      { provide: AuthApiService, useValue: api },
      { provide: Router, useValue: router },
      { provide: LanguageService, useValue: languageService },
      { provide: AuthRedirectService, useValue: authRedirectService },
    ],
  });
  const store = TestBed.inject(MockStore);
  return {
    harness,
    store,
    languageService,
    router,
    authRedirectService,
    effects: TestBed.inject(AuthEffects),
  };
}

describe('AuthEffects — per-user language persistence', () => {
  describe('applyServerLanguage$ (inbound: server → UI)', () => {
    it('applies the saved preferredLanguage from a loaded user', () => {
      const { harness, effects, languageService } = setup();
      effects.applyServerLanguage$.subscribe();

      harness.send(
        AuthActions.loadCurrentUserSuccess({ user: makeUser({ preferredLanguage: 'hy' }) }),
      );

      expect(languageService.applyFromUser).toHaveBeenCalledWith('hy');
    });

    it('passes null through unchanged when the user has no saved preference (LanguageService no-ops)', () => {
      const { harness, effects, languageService } = setup();
      effects.applyServerLanguage$.subscribe();

      harness.send(
        AuthActions.loadCurrentUserSuccess({ user: makeUser({ preferredLanguage: null }) }),
      );

      expect(languageService.applyFromUser).toHaveBeenCalledWith(null);
    });

    it('never dispatches — it only calls LanguageService directly', () => {
      const { harness, effects } = setup();
      const emissions: unknown[] = [];
      effects.applyServerLanguage$.subscribe((value) => emissions.push(value));

      harness.send(
        AuthActions.loadCurrentUserSuccess({ user: makeUser({ preferredLanguage: 'ru' }) }),
      );

      // dispatch: false effect — emitted value is the source action, not a new one to dispatch.
      expect(emissions).toEqual([
        AuthActions.loadCurrentUserSuccess({ user: makeUser({ preferredLanguage: 'ru' }) }),
      ]);
    });
  });

  describe('persistPreferredLanguage$ (outbound: user-initiated switch → backend)', () => {
    it('calls the API when the user is authenticated', () => {
      const updatePreferredLanguage = vi.fn().mockReturnValue(of(makeUser()));
      const { harness, store, effects } = setup({ updatePreferredLanguage });
      store.overrideSelector(selectIsAuthenticated, true);
      effects.persistPreferredLanguage$.subscribe();

      harness.send(AuthActions.updatePreferredLanguage({ code: 'ru' }));

      expect(updatePreferredLanguage).toHaveBeenCalledWith('ru');
    });

    it('does not call the API when the user is not authenticated (guest switch stays localStorage-only)', () => {
      const updatePreferredLanguage = vi.fn().mockReturnValue(of(makeUser()));
      const { harness, store, effects } = setup({ updatePreferredLanguage });
      store.overrideSelector(selectIsAuthenticated, false);
      effects.persistPreferredLanguage$.subscribe();

      harness.send(AuthActions.updatePreferredLanguage({ code: 'ru' }));

      expect(updatePreferredLanguage).not.toHaveBeenCalled();
    });

    it('swallows API errors quietly — no throw, no emission', () => {
      const updatePreferredLanguage = vi
        .fn()
        .mockReturnValue(throwError(() => new Error('network down')));
      const { harness, store, effects } = setup({ updatePreferredLanguage });
      store.overrideSelector(selectIsAuthenticated, true);

      const emissions: unknown[] = [];
      let errored = false;
      effects.persistPreferredLanguage$.subscribe({
        next: (value) => emissions.push(value),
        error: () => {
          errored = true;
        },
      });

      expect(() => harness.send(AuthActions.updatePreferredLanguage({ code: 'ru' }))).not.toThrow();
      expect(errored).toBe(false);
      expect(emissions).toEqual([]);
    });
  });
});

describe('AuthEffects — post-auth landing navigation', () => {
  describe('navigateAfterAuthenticated$', () => {
    it('navigates an admin with no pending returnUrl to /admin', () => {
      const { harness, effects, router, authRedirectService } = setup(
        {},
        { consume: vi.fn().mockReturnValue(null) },
      );
      effects.navigateAfterAuthenticated$.subscribe();

      harness.send(AuthActions.loginSuccess({ token: 'tok' }));
      harness.send(AuthActions.loadCurrentUserSuccess({ user: makeAdmin() }));

      expect(authRedirectService.consume).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('navigates an admin with a pending returnUrl to that URL, not /admin', () => {
      const { harness, effects, router } = setup(
        {},
        { consume: vi.fn().mockReturnValue('/listings/42') },
      );
      effects.navigateAfterAuthenticated$.subscribe();

      harness.send(AuthActions.loginSuccess({ token: 'tok' }));
      harness.send(AuthActions.loadCurrentUserSuccess({ user: makeAdmin() }));

      expect(router.navigateByUrl).toHaveBeenCalledWith('/listings/42');
      expect(router.navigateByUrl).not.toHaveBeenCalledWith('/admin');
    });

    it('does not navigate a non-admin login with no pending returnUrl', () => {
      const { harness, effects, router } = setup({}, { consume: vi.fn().mockReturnValue(null) });
      effects.navigateAfterAuthenticated$.subscribe();

      harness.send(AuthActions.loginSuccess({ token: 'tok' }));
      harness.send(AuthActions.loadCurrentUserSuccess({ user: makeUser() }));

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('does not navigate on a bootstrap/session-restore loadCurrentUserSuccess for an admin (not preceded by an explicit login)', () => {
      const { harness, effects, router } = setup({}, { consume: vi.fn().mockReturnValue(null) });
      effects.navigateAfterAuthenticated$.subscribe();

      // Simulates authInitStarted -> initAuth$ -> loadCurrentUser -> loadCurrentUserSuccess,
      // i.e. app bootstrap/session restore, with no loginSuccess/registerSuccess/
      // externalAuthSuccess preceding it.
      harness.send(AuthActions.loadCurrentUserSuccess({ user: makeAdmin() }));

      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
