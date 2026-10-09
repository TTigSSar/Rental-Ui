import { HttpErrorResponse } from '@angular/common/http';

/** ADR-028: resend/register cooldown is 60 s server-side. */
export const DEFAULT_COOLDOWN_SECONDS = 60;

const MAX_COOLDOWN_SECONDS = 3600;

/**
 * Seconds to wait after a 429. The backend sends `Retry-After` (seconds), but it is
 * not CORS-exposed in dev, so the header is usually unreadable from the browser —
 * then (or when it is missing / not a plain number) fall back to the 60 s cooldown.
 */
export function retryAfterSeconds(error: unknown): number {
  if (error instanceof HttpErrorResponse) {
    const raw = error.headers?.get('Retry-After') ?? null;
    if (raw !== null && /^\d+$/.test(raw.trim())) {
      const seconds = Number(raw.trim());
      if (seconds > 0) {
        return Math.min(seconds, MAX_COOLDOWN_SECONDS);
      }
    }
  }
  return DEFAULT_COOLDOWN_SECONDS;
}
