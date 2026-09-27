/**
 * Global harness fix for a systemic NgRx test-double defect (see `knowledge/mistakes.md`).
 *
 * `MockStore.overrideSelector(selector, value)` (from `@ngrx/store/testing`) calls
 * `selector.setResult(value)` directly on the selector FUNCTION OBJECT that `createSelector()`
 * produced — a module-level singleton exported once from a file like `auth.selectors.ts` and
 * imported, unchanged, by every spec and every component that uses it. That mutation lives
 * entirely outside Angular's TestBed: `TestBed.resetTestingModule()` has no effect on it, and
 * `MockStore.resetSelectors()` only releases the selectors tracked on the ONE `MockStore`
 * instance that made the call — a later, unrelated `MockStore` instance created by a different
 * spec (or a different test in the same spec) has no way to know the override exists, and no
 * way to undo it.
 *
 * Several specs in this codebase call `overrideSelector()` and never call `resetSelectors()`
 * (e.g. `admin.guard.spec.ts`, `auth.guard.spec.ts`, `guest.guard.spec.ts`). Under Vitest's
 * default `isolate: false` (the Angular CLI's deliberate Karma/Jasmine-parity default — see
 * `@angular/build`'s `unit-test` builder schema), spec files execute without a guaranteed fresh
 * module registry between them, so a dangling override leaks into ANY later test — in the same
 * file, or a completely different one that happens to share a Vitest worker — that reads the
 * same selector. That test then silently gets a frozen, stale value instead of one derived from
 * its own `initialState`, however careful its own setup is.
 *
 * This file closes the whole class of bug in one place instead of requiring every spec that
 * calls `overrideSelector()` to remember a matching `resetSelectors()`: it wraps
 * `MockStore.prototype.overrideSelector` so every override, from every `MockStore` instance,
 * anywhere in the run, is tracked in one process-wide registry, and releases every tracked
 * selector after every test, everywhere. See `reset-mock-store-selectors.spec.ts` in this same
 * directory for the regression coverage, and `knowledge/mistakes.md` for the incident this
 * closes out.
 *
 * Wired in as a global Vitest setup file via `angular.json`
 * (`projects.angular-app.architect.test.options.setupFiles`), so — like Angular's own
 * `init-testbed` setup file — it is bundled into every spec file's entry point and this module
 * body runs once per spec file. The one-time monkey-patch is guarded via a `globalThis` symbol
 * (mirroring the guard the Angular CLI's own generated setup file uses for the same reason:
 * this file can legitimately execute more than once per worker process under `isolate: false`),
 * while the `afterEach` registration below runs on every execution so it is always attached to
 * whichever spec file is currently loading it.
 */
import { afterEach } from 'vitest';
import { MockStore } from '@ngrx/store/testing';
import type { MemoizedSelector, MemoizedSelectorWithProps } from '@ngrx/store';

type ReleasableSelector =
  | MemoizedSelector<unknown, unknown>
  | MemoizedSelectorWithProps<unknown, unknown, unknown>;

type PatchableOverrideSelector = (
  this: MockStore,
  selector: unknown,
  value: unknown,
) => unknown;

const REGISTRY_KEY = Symbol.for('@dorent/qa:overridden-mock-store-selectors');

type GlobalWithRegistry = typeof globalThis & {
  [REGISTRY_KEY]?: Set<ReleasableSelector>;
};

function isReleasable(value: unknown): value is ReleasableSelector {
  return (
    !!value &&
    typeof (value as Partial<ReleasableSelector>).release === 'function' &&
    typeof (value as Partial<ReleasableSelector>).clearResult === 'function'
  );
}

function getOrCreateRegistry(): Set<ReleasableSelector> {
  const globalWithRegistry = globalThis as GlobalWithRegistry;
  if (!globalWithRegistry[REGISTRY_KEY]) {
    const registry = new Set<ReleasableSelector>();
    globalWithRegistry[REGISTRY_KEY] = registry;

    const proto = MockStore.prototype as unknown as {
      overrideSelector: PatchableOverrideSelector;
    };
    const originalOverrideSelector = proto.overrideSelector;
    proto.overrideSelector = function (
      this: MockStore,
      selector: unknown,
      value: unknown,
    ): unknown {
      const result = originalOverrideSelector.call(this, selector, value);
      if (isReleasable(result)) {
        registry.add(result);
      }
      return result;
    };
  }
  return globalWithRegistry[REGISTRY_KEY];
}

const overriddenSelectors = getOrCreateRegistry();

afterEach(() => {
  for (const selector of overriddenSelectors) {
    selector.release();
    selector.clearResult();
  }
  overriddenSelectors.clear();
});
