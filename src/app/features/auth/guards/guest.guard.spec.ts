import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { firstValueFrom, isObservable, type Observable } from 'rxjs';

import {
  selectAuthInitializing,
  selectIsAuthenticated,
} from '../store/auth.selectors';
import { guestGuard } from './guest.guard';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

function configureStore(opts: { isAuthenticated: boolean; isInitializing: boolean }) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideMockStore()],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectIsAuthenticated, opts.isAuthenticated);
  store.overrideSelector(selectAuthInitializing, opts.isInitializing);
  return store;
}

describe('guestGuard', () => {
  describe('initialization already settled', () => {
    it('redirects an authenticated user to /listings', () => {
      configureStore({ isAuthenticated: true, isInitializing: false });
      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
      expect((result as UrlTree).toString()).toBe('/listings');
    });

    it('lets a guest through', () => {
      configureStore({ isAuthenticated: false, isInitializing: false });
      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
      expect(result).toBe(true);
    });
  });

  describe('initialization in progress', () => {
    it('waits for hydration, then redirects if the user turns out authenticated', async () => {
      const store = configureStore({ isAuthenticated: false, isInitializing: true });
      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));
      expect(isObservable(result)).toBe(true);

      const settled = firstValueFrom(result as Observable<boolean | UrlTree>);
      store.overrideSelector(selectIsAuthenticated, true);
      store.overrideSelector(selectAuthInitializing, false);
      store.refreshState();

      expect(((await settled) as UrlTree).toString()).toBe('/listings');
    });

    it('waits for hydration, then lets an anonymous user through', async () => {
      const store = configureStore({ isAuthenticated: false, isInitializing: true });
      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

      const settled = firstValueFrom(result as Observable<boolean | UrlTree>);
      store.overrideSelector(selectAuthInitializing, false);
      store.refreshState();

      expect(await settled).toBe(true);
    });
  });
});
