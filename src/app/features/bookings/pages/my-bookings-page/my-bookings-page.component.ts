import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { MyBookingCardComponent } from '../../components/my-booking-card/my-booking-card.component';
import type { MyBooking } from '../../models/booking.model';
import * as BookingsActions from '../../store/bookings.actions';
import {
  selectMyBookings,
  selectMyBookingsError,
  selectMyBookingsLoading,
} from '../../store/bookings.selectors';

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

  protected readonly viewModel$ = this.store.select(selectMyBookingsPageViewModel);

  ngOnInit(): void {
    this.store.dispatch(BookingsActions.loadMyBookings());
  }

  protected retry(): void {
    this.store.dispatch(BookingsActions.loadMyBookings());
  }
}
