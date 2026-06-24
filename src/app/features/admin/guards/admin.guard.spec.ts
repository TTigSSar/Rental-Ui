import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, type Observable } from 'rxjs';

import { makeAdmin, makeUser } from '../../../../testing/fixtures';
import type { CurrentUser } from '../../auth/models/auth.models';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import {
  selectAuthError,
  selectAuthLoading,
  selectAuthUser,
  selectIsAuthenticated,
} from '../../auth/store/auth.selectors';
import * as AuthActions from '../../auth/store/auth.actions';
import { adminGuard } from './admin.guard';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

interface AuthSnapshot {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CurrentUser | null;
  error: string | null;
  token: string | null;
}

function setup(snapshot: AuthSnapshot) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore(),
      { provide: AuthTokenService, useValue: { getToken: () => snapshot.token } },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectIsAuthenticated, snapshot.isAuthenticated);
  store.overrideSelector(selectAuthLoading, snapshot.isLoading);
  store.overrideSelector(selectAuthUser, snapshot.user);
  store.overrideSelector(selectAuthError, snapshot.error);
  const dispatch = vi.spyOn(store, 'dispatch');
  const run = () => TestBed.runInInjectionContext(() => adminGuard(route, state));
  return { store, dispatch, run };
}

describe('adminGuard', () => {
  it('redirects to home when neither authenticated nor holding a token', () => {
    const { run } = setup({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      token: null,
    });
    expect((run() as UrlTree).toString()).toBe('/');
  });

  describe('user already loaded', () => {
    it('allows an Admin through', () => {
      const { run } = setup({
        isAuthenticated: true,
        isLoading: false,
        user: makeAdmin(),
        error: null,
        token: 'jwt',
      });
      expect(run()).toBe(true);
    });

    it('redirects a non-admin to /listings', () => {
      const { run } = setup({
        isAuthenticated: true,
        isLoading: false,
        user: makeUser(),
        error: null,
        token: 'jwt',
      });
      expect((run() as UrlTree).toString()).toBe('/listings');
    });
  });

  describe('token present, user not yet hydrated', () => {
    it('dispatches loadCurrentUser when no load is in flight', () => {
      // loading=false means the guard must kick off the hydration request itself.
      const { dispatch, run } = setup({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        token: 'jwt',
      });
      run();
      expect(dispatch).toHaveBeenCalledWith(AuthActions.loadCurrentUser());
    });

    it('allows an Admin once an in-flight hydration completes', async () => {
      // loading=true means a load is already running; the guard waits, does not dispatch.
      const { store, dispatch, run } = setup({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
        token: 'jwt',
      });

      const result = run() as Observable<boolean | UrlTree>;
      expect(dispatch).not.toHaveBeenCalled();

      const settled = firstValueFrom(result);
      store.overrideSelector(selectAuthUser, makeAdmin());
      store.overrideSelector(selectAuthLoading, false);
      store.refreshState();

      expect(await settled).toBe(true);
    });

    it('does not re-dispatch loadCurrentUser when a load is already in flight', () => {
      const { dispatch, run } = setup({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
        token: 'jwt',
      });
      run();
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('redirects to home when hydration fails with an auth error', async () => {
      const { store, run } = setup({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
        token: 'jwt',
      });

      const result = run() as Observable<boolean | UrlTree>;
      const settled = firstValueFrom(result);
      store.overrideSelector(selectAuthError, 'Unauthorized');
      store.overrideSelector(selectAuthLoading, false);
      store.refreshState();

      expect(((await settled) as UrlTree).toString()).toBe('/');
    });

    it('redirects a hydrated non-admin (no error) to /listings', async () => {
      const { store, run } = setup({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
        token: 'jwt',
      });

      const result = run() as Observable<boolean | UrlTree>;
      const settled = firstValueFrom(result);
      store.overrideSelector(selectAuthUser, makeUser());
      store.overrideSelector(selectAuthLoading, false);
      store.refreshState();

      expect(((await settled) as UrlTree).toString()).toBe('/listings');
    });
  });
});
