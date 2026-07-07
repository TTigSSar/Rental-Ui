import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { AuthRedirectService } from '../services/auth-redirect.service';
import { AuthTokenService } from '../services/auth-token.service';
import { selectAuthInitializing, selectIsAuthenticated } from '../store/auth.selectors';
import { authGuard } from './auth.guard';

const route = {} as ActivatedRouteSnapshot;
const state = { url: '/bookings' } as RouterStateSnapshot;

function setup(opts: {
  isAuthenticated: boolean;
  token: string | null;
  isInitializing?: boolean;
}) {
  const redirect = { set: vi.fn() } as Pick<AuthRedirectService, 'set'>;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore(),
      { provide: AuthTokenService, useValue: { getToken: () => opts.token } },
      { provide: AuthRedirectService, useValue: redirect },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectIsAuthenticated, opts.isAuthenticated);
  store.overrideSelector(selectAuthInitializing, opts.isInitializing ?? false);

  const result = TestBed.runInInjectionContext(() => authGuard(route, state));
  return { result, redirect };
}

describe('authGuard', () => {
  it('allows access when authenticated', () => {
    const { result } = setup({ isAuthenticated: true, token: null });
    expect(result).toBe(true);
  });

  it('allows access during the init window when a token is present', () => {
    // Covers the page-refresh window: token in storage, /auth/me not yet resolved.
    const { result } = setup({ isAuthenticated: false, token: 'jwt', isInitializing: true });
    expect(result).toBe(true);
  });

  it('redirects a guest with a lingering token once auth init has completed', () => {
    // A non-401 /auth/me failure preserves the token, but the guest must not
    // reach protected pages (e.g. listing creation) afterwards.
    const { result } = setup({ isAuthenticated: false, token: 'jwt', isInitializing: false });
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('treats a whitespace-only token as no token', () => {
    const { result } = setup({ isAuthenticated: false, token: '   ', isInitializing: true });
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('redirects to home and records the return url when unauthenticated', () => {
    const { result, redirect } = setup({ isAuthenticated: false, token: null });
    expect((result as UrlTree).toString()).toBe('/');
    expect(redirect.set).toHaveBeenCalledWith('/bookings');
  });
});
