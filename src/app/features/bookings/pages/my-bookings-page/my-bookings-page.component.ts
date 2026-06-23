import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { MyBookingCardComponent } from '../../components/my-booking-card/my-booking-card.component';
import type { MyBooking } from '../../models/booking.model';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectMyBookings,
  selectMyBookingsError,
  selectMyBookingsLoading,
} from '../../store/bookings.selectors';

// ── Filter tabs (mirrors My Toys pattern) ─────────────────
type BookingFilter = 'all' | 'active' | 'upcoming' | 'past';

interface FilterTab {
  readonly key: BookingFilter;
  readonly labelKey: string;
}

const ACTIVE_STATUSES   = new Set(['Active', 'ReturnMarked']);
const UPCOMING_STATUSES = new Set(['Approved', 'PendingApproval', 'Pending']);
const PAST_STATUSES     = new Set(['Completed', 'Rejected', 'Cancelled', 'Expired', 'Archived']);

// ── View model ────────────────────────────────────────────
interface MyBookingsPageViewModel {
  readonly bookings: MyBooking[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectMyBookingsPageViewModel = createSelector(
  selectMyBookings,
  selectMyBookingsLoading,
  selectMyBookingsError,
  (bookings, loading, error): MyBookingsPageViewModel => {
    const hasError = error !== null;
    return {
      bookings,
      loading,
      error,
      showInitialSkeleton: loading && bookings.length === 0,
      showEmpty: !loading && bookings.length === 0 && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-my-bookings-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    EmptyStateComponent,
    PageHeaderComponent,
    MessageModule,
    MyBookingCardComponent,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './my-bookings-page.component.html',
  styleUrl: './my-bookings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookingsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly vm = toSignal(
    this.store.select(selectMyBookingsPageViewModel),
    { requireSync: true },
  );

  protected readonly activeFilter = signal<BookingFilter>('all');

  protected readonly FILTER_TABS: ReadonlyArray<FilterTab> = [
    { key: 'all',      labelKey: 'bookings.myBookings.tab.all' },
    { key: 'active',   labelKey: 'bookings.myBookings.tab.active' },
    { key: 'upcoming', labelKey: 'bookings.myBookings.tab.upcoming' },
    { key: 'past',     labelKey: 'bookings.myBookings.tab.past' },
  ];

  protected readonly tabCounts = computed(() => {
    const all = this.vm().bookings;
    return new Map<BookingFilter, number>([
      ['all',      all.length],
      ['active',   all.filter(b => ACTIVE_STATUSES.has(b.status)).length],
      ['upcoming', all.filter(b => UPCOMING_STATUSES.has(b.status)).length],
      ['past',     all.filter(b => PAST_STATUSES.has(b.status)).length],
    ]);
  });

  protected readonly filteredBookings = computed((): MyBooking[] => {
    const filter = this.activeFilter();
    const all = this.vm().bookings;
    if (filter === 'all')      return all;
    if (filter === 'active')   return all.filter(b => ACTIVE_STATUSES.has(b.status));
    if (filter === 'upcoming') return all.filter(b => UPCOMING_STATUSES.has(b.status));
    return all.filter(b => PAST_STATUSES.has(b.status));
  });

  ngOnInit(): void {
    this.store.dispatch(BookingsActions.loadMyBookings());
  }

  protected setFilter(filter: BookingFilter): void {
    this.activeFilter.set(filter);
  }

  protected retry(): void {
    this.store.dispatch(BookingsActions.loadMyBookings());
  }
}
