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

import { BookingProgressComponent } from '../../../../shared/ui/booking-progress/booking-progress.component';
import { BookingStatusBadgeComponent } from '../../../../shared/ui/booking-status-badge/booking-status-badge.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import type { BookingReviewStatus } from '../../../reviews/models/review.model';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectBookingActionError,
  selectBookingActionPending,
  selectBookingDetail,
  selectBookingDetailError,
  selectBookingDetailLoading,
  selectCancelBookingError,
  selectCancelBookingPending,
  selectCancelBookingSuccessId,
} from '../../store/bookings.selectors';

type PrimaryAction = 'none' | 'markActive' | 'complete' | 'review';

interface CompletionView {
  readonly kind: PrimaryAction;
  readonly ctaKey?: string;
}

interface TimelineItem {
  readonly labelKey: string;
  readonly date: string | null;
  readonly done: boolean;
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
    BookingProgressComponent,
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

  protected readonly reviewStatus = signal<BookingReviewStatus | null>(null);

  protected readonly showSkeleton = computed(() => this.loading() && this.detail() === null);

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
    const active = d.status === 'Active' || d.status === 'Completed';
    return [
      { labelKey: 'bookings.timeline.requested', date: d.createdAt, done: true },
      {
        labelKey: 'bookings.timeline.approved',
        date: d.approvedAt,
        done: d.approvedAt !== null,
      },
      {
        labelKey: 'bookings.timeline.active',
        date: d.activeAt,
        done: active,
      },
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

  protected readonly canCancel = computed(() => {
    const d = this.detail();
    return d !== null && d.role === 'renter' &&
      (d.status === 'Pending' || d.status === 'Approved');
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
    // Redirect to bookings list after a successful cancel.
    effect(() => {
      if (this.cancelSuccessId() !== null) {
        void this.router.navigate(['/bookings']);
      }
    });

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
      this.store.dispatch(BookingsActions.clearCancelBookingState());
    }
  }

  ngOnDestroy(): void {
    this.store.dispatch(BookingsActions.clearBookingDetail());
    this.store.dispatch(BookingsActions.clearCancelBookingState());
  }

  protected retry(): void {
    if (this.bookingId) {
      this.store.dispatch(BookingsActions.loadBookingDetail({ bookingId: this.bookingId }));
    }
  }

  protected activateBooking(): void {
    this.store.dispatch(BookingsActions.markActive({ bookingId: this.bookingId }));
  }

  protected completeBooking(): void {
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
}
