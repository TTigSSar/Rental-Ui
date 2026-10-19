import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap, tap } from 'rxjs';

import { ApiErrorMapper } from '../../../api/api-error-mapper';
import { getApiErrorCode } from '../../../api/api-error.model';
import { BookingsApiService } from '../services/bookings-api.service';
import { OwnerRequestsBadgeService } from '../services/owner-requests-badge.service';
import * as BookingsActions from './bookings.actions';

@Injectable()
export class BookingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly bookingsApi = inject(BookingsApiService);
  private readonly ownerRequestsBadge = inject(OwnerRequestsBadgeService);

  readonly createBooking$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.createBooking),
      concatMap(({ payload }) =>
        this.bookingsApi.createBooking(payload).pipe(
          map((booking) => BookingsActions.createBookingSuccess({ booking })),
          catchError((error: unknown) =>
            of(
              BookingsActions.createBookingFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
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
                error: this.apiErrors.message(error),
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
                error: this.apiErrors.message(error),
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
                error: this.apiErrors.message(error),
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
      concatMap(({ bookingId, reason }) =>
        this.bookingsApi.rejectBookingRequest(bookingId, reason).pipe(
          map(() =>
            BookingsActions.rejectBookingRequestSuccess({
              bookingId,
              status: 'Rejected',
              reason,
            }),
          ),
          catchError((error: unknown) =>
            of(
              BookingsActions.rejectBookingRequestFailure({
                bookingId,
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  // Keep the global header "Requests" badge in sync the moment a decision lands, rather
  // than waiting up to 60s for OwnerRequestsBadgeService's poll — most visible now that
  // approve/reject can happen from the booking-details page. Mirrors
  // NotificationsEffects.syncBadgeMarkRead$ / ChatEffects.syncNavBadge$: badge refresh
  // logic for this feature lives in exactly one place, here.
  readonly syncOwnerRequestsBadge$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          BookingsActions.approveBookingRequestSuccess,
          BookingsActions.rejectBookingRequestSuccess,
        ),
        tap(() => this.ownerRequestsBadge.refresh()),
      ),
    { dispatch: false },
  );

  // A decision made from /bookings/:id patches the in-view detail locally instead of
  // refetching — see bookings.reducer.ts. A refetch was tried first and reverted:
  // `e2e/booking-details-mobile-tap.spec.ts` asserts the footer flips with no reload,
  // and a follow-up GET raced the mocked tier's static fixture back to Pending.

  readonly loadBookingDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.loadBookingDetail),
      switchMap(({ bookingId }) =>
        this.bookingsApi.getBookingById(bookingId).pipe(
          map((detail) => BookingsActions.loadBookingDetailSuccess({ detail })),
          catchError((error: unknown) =>
            of(
              BookingsActions.loadBookingDetailFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly markActive$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.markActive),
      concatMap(({ bookingId }) =>
        this.bookingsApi.markActive(bookingId).pipe(
          map((detail) => BookingsActions.bookingActionSuccess({ detail })),
          catchError((error: unknown) =>
            of(
              BookingsActions.bookingActionFailure({
                bookingId,
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly completeBooking$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.completeBooking),
      concatMap(({ bookingId }) =>
        this.bookingsApi.complete(bookingId).pipe(
          map((detail) => BookingsActions.bookingActionSuccess({ detail })),
          catchError((error: unknown) =>
            of(
              BookingsActions.bookingActionFailure({
                bookingId,
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  // A failed action reloads authoritative state from the server.
  readonly reloadAfterActionFailure$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.bookingActionFailure),
      map(({ bookingId }) => BookingsActions.loadBookingDetail({ bookingId })),
    ),
  );

  readonly cancelBooking$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.cancelBooking),
      concatMap(({ bookingId }) =>
        this.bookingsApi.cancelBooking(bookingId).pipe(
          map(() => BookingsActions.cancelBookingSuccess({ bookingId })),
          catchError((error: unknown) =>
            of(
              BookingsActions.cancelBookingFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly refreshAfterCancelBooking$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BookingsActions.cancelBookingSuccess),
      map(() => BookingsActions.loadMyBookings()),
    ),
  );
}
