import { Injectable, signal } from '@angular/core';

/**
 * Lets a page ask the global header to hide its search pill.
 *
 * Only the Home page uses this: its hero carries the primary search field, so
 * the header search is suppressed until the hero search scrolls out of view.
 * Every other route (Browse, details, profile, …) never touches the service,
 * so the header search stays permanently visible there — on Browse it is the
 * primary control and must not disappear.
 *
 * The app shell additionally gates the flag on "are we on Home", so a page
 * that forgets to reset on destroy can never leak the hidden state.
 */
@Injectable({ providedIn: 'root' })
export class HeaderSearchVisibilityService {
  private readonly hiddenState = signal(false);

  /** True while the header search pill should be faded out and inert. */
  readonly hidden = this.hiddenState.asReadonly();

  setHidden(hidden: boolean): void {
    this.hiddenState.set(hidden);
  }

  /** Restore the always-visible default. Call on page destroy. */
  reset(): void {
    this.hiddenState.set(false);
  }
}
