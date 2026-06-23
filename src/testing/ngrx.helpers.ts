/**
 * Helpers for testing NgRx effects.
 *
 * Effects subscribe to the injected `Actions` stream lazily (on first emission),
 * so the recommended pattern is a hot subject that the test pushes actions into
 * after the effect is subscribed. Use `provideMockActions` from this module to
 * wire that subject into TestBed.
 */
import type { Provider } from '@angular/core';
import { provideMockActions } from '@ngrx/effects/testing';
import { Subject, firstValueFrom, type Observable } from 'rxjs';
import { toArray } from 'rxjs/operators';
import type { Action } from '@ngrx/store';

export interface ActionsHarness {
  /** Provider to register in TestBed so effects receive this stream. */
  readonly provider: Provider;
  /** Push an action into the effect's input stream. */
  send(action: Action): void;
  /** Complete the stream (lets `collect(...)` resolve). */
  complete(): void;
}

export function actionsHarness(): ActionsHarness {
  const subject = new Subject<Action>();
  return {
    provider: provideMockActions(() => subject.asObservable()),
    send: (action) => subject.next(action),
    complete: () => subject.complete(),
  };
}

/**
 * Collects every action an effect emits until its source stream completes.
 * Pair with `harness.send(...)` then `harness.complete()`.
 */
export function collect<T extends Action>(effect$: Observable<T>): Promise<T[]> {
  return firstValueFrom(effect$.pipe(toArray()));
}
