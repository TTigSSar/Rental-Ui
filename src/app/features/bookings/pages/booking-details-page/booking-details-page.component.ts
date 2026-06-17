import { CurrencyPipe, DatePipe } from '@angular/common';
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

import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { BookingProgressComponent } from '../../../../shared/ui/booking-progress/booking-progress.component';
import {
  mapBookingStatusLabelKey,
  mapBookingStatusTone,
} from '../../../../shared/utils/booking-status.utils';
import type { BookingReviewStatus } from '../../../reviews/models/review.model';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectBookingActionError,
  selectBookingActionPending,
  selectBookingDetail,
  selectBookingDetailError,
  selectBookingDetailLoading,
} from '../../store/bookings.selectors';

type PrimaryAction = 'none' | 'mark' | 'confirm' | 'awaiting' | 'review';

interface CompletionView {
  readonly kind: PrimaryAction;
  readonly ctaKey?: string;
  readonly titleKey?: string;
  readonly showAutoNote?: boolean;
}

interface TimelineItem {
  readonly labelKey: string;
  readonly date: string | null;
  readonly done: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-booking-details-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TranslatePipe,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    BadgeComponent,
    BookingProgressComponent,
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

  protected readonly reviewStatus = signal<BookingReviewStatus | null>(null);

  protected readonly showSkeleton = computed(() => this.loading() && this.detail() === null);

  protected readonly statusLabelKey = computed(() => {
    const d = this.detail();
    return d ? mapBookingStatusLabelKey(d.status) : '';
  });

  protected readonly statusTone = computed(() => {
    const d = this.detail();
    return d ? mapBookingStatusTone(d.status) : 'neutral';
  });

  protected readonly rentalDays = computed(() => {
    const d = this.detail();
    if (!d) return 0;
    const start = Date.parse(d.startDate);
    const end = Date.parse(d.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) return 0;
    return Math.round((end - start) / 86_400_000) + 1;
  });

  protected readonly action = computed<PrimaryAction>(() => {
    const d = this.detail();
    if (!d) return 'none';
    switch (d.status) {
      case 'Approved':
        return 'mark';
      case 'ReturnMarked': {
        const me = d.role === 'owner' ? 'Owner' : 'Renter';
        return d.returnInitiatedBy === me ? 'awaiting' : 'confirm';
      }
      case 'Completed':
        return 'review';
      default:
        return 'none';
    }
  });

  protected readonly completion = computed<CompletionView | null>(() => {
    const d = this.detail();
    if (!d) return null;
    const owner = d.role === 'owner';
    switch (this.action()) {
      case 'mark':
        return {
          kind: 'mark',
          ctaKey: owner
            ? 'bookings.completion.markCompleted'
            : 'bookings.completion.iReturned',
        };
      case 'confirm':
        return {
          kind: 'confirm',
          titleKey: owner
            ? 'bookings.completion.renterMarked'
            : 'bookings.completion.ownerMarked',
          ctaKey: owner
            ? 'bookings.completion.confirmReceipt'
            : 'bookings.completion.confirmCompletion',
        };
      case 'awaiting':
        return {
          kind: 'awaiting',
          titleKey: owner
            ? 'bookings.completion.awaitingRenter'
            : 'bookings.completion.awaitingOwner',
          // Only owner-initiated returns auto-complete after 48h.
          showAutoNote: owner,
        };
      default:
        return { kind: this.action() };
    }
  });

  protected readonly timeline = computed<TimelineItem[]>(() => {
    const d = this.detail();
    if (!d) return [];
    const completed = d.status === 'Completed';
    const marked = d.returnMarkedAt !== null || completed;
    return [
      { labelKey: 'bookings.timeline.requested', date: d.createdAt, done: true },
      {
        labelKey: 'bookings.timeline.approved',
        date: d.approvedAt,
        done: d.approvedAt !== null || d.status !== 'Pending',
      },
      {
        labelKey: 'bookings.timeline.started',
        date: d.startDate,
        done: !!d.startDate && d.startDate <= todayIso(),
      },
      { labelKey: 'bookings.timeline.completionRequested', date: d.returnMarkedAt, done: marked },
      { labelKey: 'bookings.timeline.completed', date: d.completedAt, done: completed },
    ];
  });

  // Rejection reason: known codes map to a localized label, free text shows as-is.
  private static readonly KNOWN_REJECT_REASONS = ['dates_unavailable', 'item_unavailable', 'not_a_fit'];

  protected readonly rejectionReason = computed<{ key: string | null; raw: string | null } | null>(() => {
    const d = this.detail();
    if (!d || d.status !== 'Rejected' || !d.rejectionReason) return null;
    const code = d.rejectionReason;
    return BookingDetailsPageComponent.KNOWN_REJECT_REASONS.includes(code)
      ? { key: 'bookings.rejectReason.' + code, raw: null }
      : { key: null, raw: code };
  });

  protected readonly canLeaveReview = computed(() => {
    const rs = this.reviewStatus();
    if (!rs) return false;
    return rs.role === 'owner'
      ? rs.canReviewRenter
      : rs.canReviewToy || rs.canReviewOwner;
  });

  protected readonly reviewSubmitted = computed(() => {
    const rs = this.reviewStatus();
    if (!rs) return false;
    return rs.role === 'owner'
      ? rs.hasRenterReview
      : rs.hasToyReview && rs.hasOwnerReview;
  });

  protected readonly reviewLink = computed<string[]>(() => {
    const d = this.detail();
    if (!d) return ['/bookings'];
    return d.role === 'owner'
      ? ['/bookings', d.id, 'review', 'renter']
      : ['/bookings', d.id, 'review'];
  });

  constructor() {
    // Once a booking is completed, load the review eligibility for this caller.
    effect(() => {
      const d = this.detail();
      if (!d || d.status !== 'Completed') return;
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
      this.store.dispatch(BookingsActions.loadBookingDetail({ bookingId: this.bookingId }));
    }
  }

  ngOnDestroy(): void {
    this.store.dispatch(BookingsActions.clearBookingDetail());
  }

  protected back(): void {
    void this.router.navigate(['/bookings']);
  }

  protected retry(): void {
    if (this.bookingId) {
      this.store.dispatch(BookingsActions.loadBookingDetail({ bookingId: this.bookingId }));
    }
  }

  protected mark(): void {
    this.store.dispatch(BookingsActions.markReturned({ bookingId: this.bookingId }));
  }

  protected confirm(): void {
    this.store.dispatch(BookingsActions.confirmReturn({ bookingId: this.bookingId }));
  }

  protected undo(): void {
    this.store.dispatch(BookingsActions.undoReturn({ bookingId: this.bookingId }));
  }

  protected leaveReview(): void {
    void this.router.navigate(this.reviewLink());
  }
}
