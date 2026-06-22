import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { BookingRequestCardComponent } from '../../components/booking-request-card/booking-request-card.component';
import type { BookingRequest } from '../../models/booking.model';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectBookingRequestActionIds,
  selectBookingRequests,
  selectBookingRequestsError,
  selectBookingRequestsLoading,
} from '../../store/bookings.selectors';

type RequestTab = 'pending' | 'accepted' | 'declined';

const PENDING_STATUSES = new Set(['PendingApproval', 'Pending']);
const ACCEPTED_STATUSES = new Set(['Approved', 'Active', 'ReturnMarked', 'Completed']);
const DECLINED_STATUSES = new Set(['Rejected', 'Cancelled', 'Expired', 'Archived']);

function tabFor(status: string): RequestTab {
  if (PENDING_STATUSES.has(status)) return 'pending';
  if (ACCEPTED_STATUSES.has(status)) return 'accepted';
  return 'declined';
}

interface BookingRequestsPageViewModel {
  readonly requests: BookingRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly actionIds: string[];
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectBookingRequestsPageViewModel = createSelector(
  selectBookingRequests,
  selectBookingRequestsLoading,
  selectBookingRequestsError,
  selectBookingRequestActionIds,
  (requests, loading, error, actionIds): BookingRequestsPageViewModel => {
    const hasError = error !== null;
    return {
      requests,
      loading,
      error,
      actionIds,
      showInitialSkeleton: loading && requests.length === 0,
      showEmpty: !loading && requests.length === 0 && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-booking-requests-page',
  standalone: true,
  imports: [
    AsyncPipe,
    BookingRequestCardComponent,
    ButtonModule,
    EmptyStateComponent,
    PageHeaderComponent,
    MessageModule,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './booking-requests-page.component.html',
  styleUrl: './booking-requests-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRequestsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly vm = toSignal(
    this.store.select(selectBookingRequestsPageViewModel),
    { requireSync: true },
  );

  protected readonly activeTab = signal<RequestTab>('pending');

  protected readonly tabCounts = computed(() => {
    const all = this.vm().requests;
    return {
      pending: all.filter(r => PENDING_STATUSES.has(r.status)).length,
      accepted: all.filter(r => ACCEPTED_STATUSES.has(r.status)).length,
      declined: all.filter(r => DECLINED_STATUSES.has(r.status)).length,
    };
  });

  protected readonly filteredRequests = computed(() => {
    const tab = this.activeTab();
    return this.vm().requests.filter(r => tabFor(r.status) === tab);
  });

  protected readonly TABS: ReadonlyArray<RequestTab> = ['pending', 'accepted', 'declined'];

  ngOnInit(): void {
    this.store.dispatch(BookingsActions.loadBookingRequests());
  }

  protected setTab(tab: RequestTab): void {
    this.activeTab.set(tab);
  }

  protected retry(): void {
    this.store.dispatch(BookingsActions.loadBookingRequests());
  }

  protected isActionLoading(bookingId: string, actionIds: string[]): boolean {
    return actionIds.includes(bookingId);
  }

  protected approve(bookingId: string): void {
    this.store.dispatch(BookingsActions.approveBookingRequest({ bookingId }));
  }

  protected reject(event: { bookingId: string; reason: string | null }): void {
    this.store.dispatch(BookingsActions.rejectBookingRequest(event));
  }
}
