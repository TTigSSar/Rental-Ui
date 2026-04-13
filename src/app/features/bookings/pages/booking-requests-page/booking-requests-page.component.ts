import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { BookingRequestCardComponent } from '../../components/booking-request-card/booking-request-card.component';
import type { BookingRequest } from '../../models/booking.model';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectBookingRequestActionIds,
  selectBookingRequests,
  selectBookingRequestsError,
  selectBookingRequestsLoading,
} from '../../store/bookings.selectors';

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

  protected readonly viewModel$ = this.store.select(
    selectBookingRequestsPageViewModel,
  );

  ngOnInit(): void {
    this.store.dispatch(BookingsActions.loadBookingRequests());
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

  protected reject(bookingId: string): void {
    this.store.dispatch(BookingsActions.rejectBookingRequest({ bookingId }));
  }
}
