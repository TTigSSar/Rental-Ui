import { Injectable, inject, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';

import type { BookingStatus } from '../models/booking.model';
import { BookingsApiService } from './bookings-api.service';

/** How often the global badge re-polls the pending-requests count (ms). */
const POLL_INTERVAL_MS = 60_000;

/**
 * A request is still awaiting the owner's decision in exactly these two statuses —
 * mirrors `ownerMayDecide()` on the booking-details page, `canDecide` on
 * `booking-request-card`, and `PENDING_STATUSES` on the requests list page. `Pending` is
 * what the backend actually sends today; `PendingApproval` is kept in the count too so an
 * unexpected wire value can't silently zero the badge while those other surfaces still
 * treat it as actionable (they'd otherwise disagree: a full list of Approve buttons behind
 * a badge reading 0).
 */
const ACTIONABLE_REQUEST_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'Pending',
  'PendingApproval',
]);

/**
 * Single source of truth for the *global* count of actionable incoming booking requests
 * that drives the header "Requests" icon badge and the profile dropdown's "Incoming
 * requests" count (Defect B: that dropdown item existed but its `requestsCount` input
 * was never bound from the app shell — see the rental-app task notes).
 *
 * Mirrors {@link NotificationBadgeService} / {@link ChatBadgeService}: there is no
 * realtime transport for bookings yet, so this polls on an interval while the user is
 * authenticated. It lives at the root (not the lazy bookings feature store) because the
 * header is visible on every screen, including ones that never load the bookings
 * feature. `BookingsEffects.syncOwnerRequestsBadge$` also calls {@link refresh} the moment
 * an approve/reject decision lands, so the count doesn't go stale for up to a full poll
 * interval after the user's own action.
 */
@Injectable({ providedIn: 'root' })
export class OwnerRequestsBadgeService {
  private readonly api = inject(BookingsApiService);

  private readonly countSignal = signal(0);
  /** Readonly view for consumers (the app shell). */
  readonly count = this.countSignal.asReadonly();

  private pollSubscription: Subscription | null = null;

  /** Begin polling the pending-requests count. Idempotent. Call once the user signs in. */
  start(): void {
    if (this.pollSubscription !== null) {
      return;
    }
    this.pollSubscription = timer(0, POLL_INTERVAL_MS).subscribe(() => this.refresh());
  }

  /** Stop polling and clear the badge. Call on sign-out. */
  stop(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
    this.countSignal.set(0);
  }

  /** One-off fetch of the authoritative actionable-requests count. */
  refresh(): void {
    this.api.getBookingRequests().subscribe({
      next: (requests) =>
        this.countSignal.set(
          requests.filter((request) => ACTIONABLE_REQUEST_STATUSES.has(request.status)).length,
        ),
      // Swallow errors: a transient failure must not break the shell. The next
      // poll tick retries.
      error: () => {},
    });
  }
}
