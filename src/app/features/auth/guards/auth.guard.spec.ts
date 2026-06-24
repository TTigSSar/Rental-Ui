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
import { selectIsAuthenticated } from '../store/auth.selectors';
import { authGuard } from './auth.guard';

const route = {} as ActivatedRouteSnapshot;
const state = { url: '/bookings' } as RouterStateSnapshot;

function setup(opts: { isAuthenticated: boolean; token: string | null }) {
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

  const result = TestBed.runInInjectionContext(() => authGuard(route, state));
  return { result, redirect };
}

describe('authGuard', () => {
  it('allows access when authenticated', () => {
    const { result } = setup({ isAuthenticated: true, token: null });
    expect(result).toBe(true);
  });

  it('allows access when a token is present even if the store says not authenticated', () => {
    // Covers the page-refresh window: token in storage, /auth/me not yet resolved.
    const { result } = setup({ isAuthenticated: false, token: 'jwt' });
    expect(result).toBe(true);
  });

  it('treats a whitespace-only token as no token', () => {
    const { result } = setup({ isAuthenticated: false, token: '   ' });
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('redirects to home and records the return url when unauthenticated', () => {
    const { result, redirect } = setup({ isAuthenticated: false, token: null });
    expect((result as UrlTree).toString()).toBe('/');
    expect(redirect.set).toHaveBeenCalledWith('/bookings');
  });
});
