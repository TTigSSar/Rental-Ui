import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { BookingsApiService } from '../services/bookings-api.service';
import * as BookingsActions from './bookings.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

@Injectable()
export class BookingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly bookingsApi = inject(BookingsApiService);

  readonly createBooking$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.createBooking),
      concatMap(({ payload }) =>
        this.bookingsApi.createBooking(payload).pipe(
          map((booking) => BookingsActions.createBookingSuccess({ booking })),
          catchError((error: unknown) =>
            of(
              BookingsActions.createBookingFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly refreshAfterCreateBookingSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.createBookingSuccess),
      map(() => BookingsActions.loadMyBookings()),
    ),
  );

  readonly loadMyBookings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.loadMyBookings),
      switchMap(() =>
        this.bookingsApi.getMyBookings().pipe(
          map((bookings) => BookingsActions.loadMyBookingsSuccess({ bookings })),
          catchError((error: unknown) =>
            of(
              BookingsActions.loadMyBookingsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadBookingRequests$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.loadBookingRequests),
      switchMap(() =>
        this.bookingsApi.getBookingRequests().pipe(
          map((requests) =>
            BookingsActions.loadBookingRequestsSuccess({ requests }),
          ),
          catchError((error: unknown) =>
            of(
              BookingsActions.loadBookingRequestsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly approveBookingRequest$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.approveBookingRequest),
      concatMap(({ bookingId }) =>
        this.bookingsApi.approveBookingRequest(bookingId).pipe(
          map(() =>
            BookingsActions.approveBookingRequestSuccess({
              bookingId,
              status: 'Approved',
            }),
          ),
          catchError((error: unknown) =>
            of(
              BookingsActions.approveBookingRequestFailure({
                bookingId,
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly rejectBookingRequest$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.rejectBookingRequest),
      concatMap(({ bookingId }) =>
        this.bookingsApi.rejectBookingRequest(bookingId).pipe(
          map(() =>
            BookingsActions.rejectBookingRequestSuccess({
              bookingId,
              status: 'Rejected',
            }),
          ),
          catchError((error: unknown) =>
            of(
              BookingsActions.rejectBookingRequestFailure({
                bookingId,
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
