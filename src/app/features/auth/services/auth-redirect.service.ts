import { Injectable } from '@angular/core';

/**
 * Holds the URL a guest was trying to reach when they were redirected to an
 * auth page.  Stored in-memory only (no localStorage) — the auth redirect is
 * an SPA navigation so the reference survives until the user authenticates.
 *
 * Usage pattern:
 *   1. authGuard / guest component calls `set(url)` before navigating away.
 *   2. AuthEffects calls `consume()` after login/register success and
 *      navigates to the returned URL (or falls back to /listings).
 */
@Injectable({ providedIn: 'root' })
export class AuthRedirectService {
  private pendingUrl: string | null = null;

  set(url: string): void {
    this.pendingUrl = url;
  }

  /** Returns and clears the stored URL. */
  consume(): string | null {
    const url = this.pendingUrl;
    this.pendingUrl = null;
    return url;
  }
}
