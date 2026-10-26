import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  type OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { BookingProgressComponent } from '../../../../shared/ui/booking-progress/booking-progress.component';
import { BookingStatusBadgeComponent } from '../../../../shared/ui/booking-status-badge/booking-status-badge.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import type { ProgressStepState } from '../../../../shared/utils/booking-progress.utils';
import { todayUtcDateString } from '../../../../shared/utils/date.utils';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import * as ChatActions from '../../../chat/store/chat.actions';
import { selectOpeningConversationFromBooking } from '../../../chat/store/chat.selectors';
import type { BookingReviewStatus } from '../../../reviews/models/review.model';
import { countRentalDays } from '../../../../shared/utils/rental-days.utils';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import {
  BookingRejectDialogComponent,
  type BookingRejectResult,
} from '../../components/booking-reject-dialog/booking-reject-dialog.component';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectBookingActionError,
  selectBookingActionPending,
  selectBookingDetail,
  selectBookingDetailError,
  selectBookingDetailLoading,
  selectBookingRequestActionIds,
  selectBookingRequestsError,
  selectCancelBookingError,
  selectCancelBookingPending,
  selectCancelBookingSuccessId,
} from '../../store/bookings.selectors';
import { UiDatePipe } from '../../../../shared/utils/ui-date.pipe';

type PrimaryAction = 'none' | 'markActive' | 'complete' | 'review';

interface CompletionView {
  readonly kind: PrimaryAction;
  readonly ctaKey?: string;
}

interface TimelineItem {
  readonly labelKey: string;
  readonly date: string | null;
  readonly done: boolean;
  readonly state: ProgressStepState;
  /** Connector below this item is coloured when the next item is reached (done/current). */
  readonly linked: boolean;
}

/** Parses the `YYYY-MM-DD` prefix of an API date as a LOCAL calendar date (no UTC shift). */
function parseLocalIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m === null) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

@Component({
  selector: 'app-booking-details-page',
  standalone: true,
  imports: [
    DramCurrencyPipe,
    UiDatePipe,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    BookingProgressComponent,
    BookingRejectDialogComponent,
    BookingStatusBadgeComponent,
    PageHeaderComponent,
  ],
  templateUrl: './booking-details-page.component.html',
  styleUrl: './booking-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingDetailsPageComponent implements OnInit, OnDestroy {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reviewsApi = inject(ReviewsApiService);

  protected readonly bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';

  protected readonly detail = this.store.selectSignal(selectBookingDetail);
  protected readonly loading = this.store.selectSignal(selectBookingDetailLoading);
  protected readonly loadError = this.store.selectSignal(selectBookingDetailError);
  protected readonly actionPending = this.store.selectSignal(selectBookingActionPending);
  protected readonly actionError = this.store.selectSignal(selectBookingActionError);
  protected readonly cancelPending = this.store.selectSignal(selectCancelBookingPending);
  protected readonly cancelError = this.store.selectSignal(selectCancelBookingError);
  private readonly cancelSuccessId = this.store.selectSignal(selectCancelBookingSuccessId);
  protected readonly openingConversation = this.store.selectSignal(
    selectOpeningConversationFromBooking,
  );

  // Owner approve/decline on a Pending request — same actions/effects as
  // /profile/requests and the My Listings owner-request-card (see bookings.effects.ts);
  // this page only adds the CTAs and reuses selectBookingRequestActionIds to know
  // whether THIS booking's decision is currently in flight.
  private readonly bookingRequestActionIds = this.store.selectSignal(selectBookingRequestActionIds);
  protected readonly requestActionError = this.store.selectSignal(selectBookingRequestsError);
  protected readonly rejectDialogVisible = signal(false);

  // `bookingRequestsError` is a global field shared with the /profile/requests list
  // (it also carries loadBookingRequestsFailure there) — showing it unconditionally here
  // could flash an unrelated, stale error the instant this page loads. This page only
  // shows it once THIS page has actually attempted a decision; reset whenever the page
  // (re)loads a booking so navigating away and back — or retrying — starts clean.
  protected readonly decisionAttempted = signal(false);

  protected readonly reviewStatus = signal<BookingReviewStatus | null>(null);

  protected readonly showSkeleton = computed(() => this.loading() && this.detail() === null);

  protected readonly rentalDays = computed(() => {
    const d = this.detail();
    if (!d) return 0;
    const start = parseLocalIsoDate(d.startDate);
    const end = parseLocalIsoDate(d.endDate);
    if (start === null || end === null) return 0;
    return countRentalDays(start, end);
  });

  // Defect A fix: an owner viewing a Pending request via /bookings/:id (rather than
  // /profile/requests or My Listings) had no way to approve/decline it — the footer
  // only ever covered markActive/complete/review. One transition earlier than M-042.
  protected readonly ownerMayDecide = computed(() => {
    const d = this.detail();
    return (
      d !== null && d.role === 'owner' && (d.status === 'Pending' || d.status === 'PendingApproval')
    );
  });

  protected readonly decisionPending = computed(() =>
    this.bookingRequestActionIds().includes(this.bookingId),
  );

  protected readonly action = computed<PrimaryAction>(() => {
    const d = this.detail();
    if (!d) return 'none';
    const isOwner = d.role === 'owner';
    switch (d.status) {
      case 'Approved':
        return isOwner ? 'markActive' : 'none';
      case 'Active':
        return isOwner ? 'complete' : 'none';
      case 'Completed':
        return 'review';
      default:
        return 'none';
    }
  });

  protected readonly completion = computed<CompletionView | null>(() => {
    const d = this.detail();
    if (!d) return null;
    switch (this.action()) {
      case 'markActive':
        return { kind: 'markActive', ctaKey: 'bookings.completion.markActive' };
      case 'complete':
        return { kind: 'complete', ctaKey: 'bookings.completion.markCompleted' };
      default:
        return { kind: this.action() };
    }
  });

  protected readonly timeline = computed<TimelineItem[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const completed = d.status === 'Completed';
    const active =
      d.status === 'Active' || d.status === 'ReturnMarked' || d.status === 'Completed';
    const raw = [
      { labelKey: 'bookings.timeline.requested', date: d.createdAt, done: true },
      { labelKey: 'bookings.timeline.approved', date: d.approvedAt, done: d.approvedAt !== null },
      { labelKey: 'bookings.timeline.active', date: d.activeAt, done: active },
      { labelKey: 'bookings.timeline.completed', date: d.completedAt, done: completed },
    ];
    // ADR-044: reached steps are ticked; the first unreached one is "awaited" — happy path only.
    const onPath =
      d.status === 'Pending' ||
      d.status === 'PendingApproval' ||
      d.status === 'Approved' ||
      d.status === 'Active' ||
      d.status === 'ReturnMarked';
    const currentIdx = onPath ? raw.findIndex((i) => !i.done) : -1;
    const states = raw.map<ProgressStepState>((i, idx) =>
      i.done ? 'done' : idx === currentIdx ? 'current' : 'upcoming',
    );
    return raw.map((i, idx) => ({
      ...i,
      state: states[idx],
      linked: idx + 1 < raw.length && states[idx + 1] !== 'upcoming',
    }));
  });

  // Rejection reason: known codes map to a localized label, free text shows as-is.
  private static readonly KNOWN_REJECT_REASONS = [
    'dates_unavailable',
    'item_unavailable',
    'not_a_fit',
  ];

  protected readonly rejectionReason = computed<{ key: string | null; raw: string | null } | null>(
    () => {
      const d = this.detail();
      if (!d || d.status !== 'Rejected' || !d.rejectionReason) return null;
      const code = d.rejectionReason;
      return BookingDetailsPageComponent.KNOWN_REJECT_REASONS.includes(code)
        ? { key: 'bookings.rejectReason.' + code, raw: null }
        : { key: null, raw: code };
    },
  );

  // Mirrors the backend cancel rule exactly (rental-api BookingsService.CancelBooking):
  // Pending is always cancellable; Approved is cancellable only while the UTC calendar date
  // is still strictly before the rental's start date. Both `startDate` and the computed
  // "today" are `YYYY-MM-DD` strings, so a lexicographic comparison is a calendar-date
  // comparison — no Date-object timezone arithmetic to get wrong.
  protected readonly canCancel = computed(() => {
    const d = this.detail();
    if (d === null || d.role !== 'renter') return false;
    if (d.status === 'Pending') return true;
    if (d.status === 'Approved') return d.startDate > todayUtcDateString();
    return false;
  });

  // Approved, but the cancel window has already closed (rental starts today-or-earlier in
  // UTC) — show a hint instead of a cancel button that would just 400 from the backend.
  protected readonly showRentalStartedHint = computed(() => {
    const d = this.detail();
    return (
      d !== null &&
      d.role === 'renter' &&
      d.status === 'Approved' &&
      d.startDate <= todayUtcDateString()
    );
  });

  protected readonly cancelLabelKey = computed(() => {
    if (this.cancelPending()) return 'bookings.details.cancelling';
    return this.detail()?.status === 'Approved'
      ? 'bookings.details.cancelBooking'
      : 'bookings.details.cancelRequest';
  });

  protected readonly canLeaveReview = computed(() => {
    const rs = this.reviewStatus();
    if (!rs) return false;
    return rs.role === 'owner' ? rs.canReviewRenter : rs.canReviewToy || rs.canReviewOwner;
  });

  protected readonly reviewSubmitted = computed(() => {
    const rs = this.reviewStatus();
    if (!rs) return false;
    return rs.role === 'owner' ? rs.hasRenterReview : rs.hasToyReview && rs.hasOwnerReview;
  });

  protected readonly reviewLink = computed<string[]>(() => {
    const d = this.detail();
    if (!d) return ['/bookings'];
    return d.role === 'owner'
      ? ['/bookings', d.id, 'review', 'renter']
      : ['/bookings', d.id, 'review'];
  });

  constructor() {
    // Redirect to bookings list after a successful cancel.
    effect(() => {
      if (this.cancelSuccessId() !== null) {
        void this.router.navigate(['/bookings']);
      }
    });

    // Once a booking is completed, load the review eligibility for this caller.
    //
    // `bookingActionPending` is read (and gates the fetch) so this never fires against the
    // optimistic flip in the reducer: `completeBooking` sets `status: 'Completed'` on the
    // detail immediately, before the POST /complete request has actually committed on the
    // server. Without this guard, the effect fired eagerly, `GET
    // /reviews/booking/{id}/status` answered `canReviewRenter: false` for a booking that
    // wasn't really Completed yet, and that `false` got cached under this booking's id
    // forever — the review CTA never appeared without a manual reload. `completeBooking()`
    // below also resets `reviewStatus` at dispatch time, so a failed complete (which reloads
    // the authoritative detail via `bookingActionFailure` → `loadBookingDetail`) can't leave
    // a stale cached status behind either — the next genuine Completed state always finds a
    // clean cache and fetches exactly once.
    effect(() => {
      const d = this.detail();
      const pending = this.actionPending();
      if (!d || d.status !== 'Completed' || pending) return;
      const current = untracked(() => this.reviewStatus());
      if (current?.bookingId === d.id) return;
      this.reviewsApi.getBookingStatus(d.id).subscribe({
        next: (status) => this.reviewStatus.set(status),
        error: () => undefined,
      });
    });
  }

  ngOnInit(): void {
    if (this.bookingId) {
      this.decisionAttempted.set(false);
      this.store.dispatch(BookingsActions.loadBookingDetail({ bookingId: this.bookingId }));
      this.store.dispatch(BookingsActions.clearCancelBookingState());
    }
  }

  ngOnDestroy(): void {
    this.store.dispatch(BookingsActions.clearBookingDetail());
    this.store.dispatch(BookingsActions.clearCancelBookingState());
  }

  protected retry(): void {
    if (this.bookingId) {
      this.decisionAttempted.set(false);
      this.store.dispatch(BookingsActions.loadBookingDetail({ bookingId: this.bookingId }));
    }
  }

  protected activateBooking(): void {
    this.store.dispatch(BookingsActions.markActive({ bookingId: this.bookingId }));
  }

  protected completeBooking(): void {
    // Invalidate any cached review-eligibility result up front — see the constructor's
    // review-eligibility effect for why this matters (the race it fixes and the retry-after-
    // failure case this reset covers).
    this.reviewStatus.set(null);
    this.store.dispatch(BookingsActions.completeBooking({ bookingId: this.bookingId }));
  }

  protected leaveReview(): void {
    void this.router.navigate(this.reviewLink());
  }

  protected cancelBooking(): void {
    if (this.bookingId && !this.cancelPending()) {
      this.store.dispatch(BookingsActions.cancelBooking({ bookingId: this.bookingId }));
    }
  }

  protected approveRequest(): void {
    if (this.bookingId && !this.decisionPending()) {
      this.decisionAttempted.set(true);
      this.store.dispatch(BookingsActions.approveBookingRequest({ bookingId: this.bookingId }));
    }
  }

  protected openRejectDialog(): void {
    this.rejectDialogVisible.set(true);
  }

  protected cancelRejectDialog(): void {
    this.rejectDialogVisible.set(false);
  }

  protected confirmRejectDialog({ reason }: BookingRejectResult): void {
    this.rejectDialogVisible.set(false);
    if (this.bookingId) {
      this.decisionAttempted.set(true);
      this.store.dispatch(
        BookingsActions.rejectBookingRequest({ bookingId: this.bookingId, reason }),
      );
    }
  }

  /** "Message {counterparty}" — opens/creates the booking's conversation via the
   * chat store and lets ChatEffects navigate there. Available to both the renter
   * and the owner (mirrors `onMessageOwner()` on the booking confirmation screen). */
  protected messageCounterparty(): void {
    if (this.bookingId) {
      this.store.dispatch(ChatActions.openConversationFromBooking({ bookingId: this.bookingId }));
    }
  }
}
