import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { authFeatureKey } from '../app/features/auth/store/auth.reducer';
import { initialAuthState } from '../app/features/auth/store/auth.state';
import { selectAuthUser, selectIsAuthenticated } from '../app/features/auth/store/auth.selectors';
import { makeUser } from './fixtures';

/**
 * Regression coverage for the defect `src/testing/reset-mock-store-selectors.ts` fixes:
 * `MockStore.overrideSelector()` mutates the shared, module-level NgRx selector object, and
 * that mutation survives `TestBed.resetTestingModule()` and outlives the `MockStore` instance
 * that made it. Left unpatched, a spec that calls `overrideSelector()` without a matching
 * `resetSelectors()` — a real, pre-existing pattern in this codebase, see `admin.guard.spec.ts`
 * — poisons the selector for every later test that reads it, anywhere in the run.
 *
 * This spec proves the fix directly: it deliberately reproduces the leaky pattern in the FIRST
 * test (no `resetSelectors()` call, exactly like the real offending specs), then asserts, in a
 * completely separate second test with its own fresh `MockStore`, that the selector is still
 * derived from that test's own `initialState`. This does not depend on Vitest's worker/file
 * sharding to reproduce — within one file, tests always run sequentially against a shared
 * module registry, which is exactly the mechanism that let the bug leak across *files* under
 * Vitest's default `isolate: false` too. Without the harness fix this test fails deterministically;
 * with it, it passes deterministically.
 */
describe('reset-mock-store-selectors harness fix', () => {
  it('(setup) overrides selectIsAuthenticated / selectAuthUser and does not reset them — mirrors admin.guard.spec.ts', () => {
    TestBed.configureTestingModule({ providers: [provideMockStore()] });
    const leakyStore = TestBed.inject(MockStore);
    leakyStore.overrideSelector(selectIsAuthenticated, false);
    leakyStore.overrideSelector(selectAuthUser, makeUser({ id: 'stale-user-from-a-different-spec' }));
    // Deliberately no `resetSelectors()` call here — reproducing the real bug pattern.
    expect(leakyStore.selectSignal(selectIsAuthenticated)()).toBe(false);
  });

  it('derives selectIsAuthenticated / selectAuthUser from this test\'s own initialState, unaffected by the previous test', () => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            [authFeatureKey]: {
              ...initialAuthState,
              isAuthenticated: true,
              user: makeUser({ id: 'this-tests-own-user' }),
            },
          },
        }),
      ],
    });
    const store = TestBed.inject(MockStore);

    expect(store.selectSignal(selectIsAuthenticated)()).toBe(true);
    expect(store.selectSignal(selectAuthUser)()?.id).toBe('this-tests-own-user');
  });
});
