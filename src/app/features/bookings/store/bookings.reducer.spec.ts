import {
  makeBookingDetail,
  makeBookingRequest,
  makeMyBooking,
} from '../../../../testing/fixtures';
import * as BookingsActions from './bookings.actions';
import { bookingsReducer } from './bookings.reducer';
import { initialBookingsState, type BookingsState } from './bookings.state';

function stateWith(overrides: Partial<BookingsState>): BookingsState {
  return { ...initialBookingsState, ...overrides };
}

describe('bookingsReducer', () => {
  describe('request action tracking', () => {
    it('adds the booking id to the pending set on approve and reject', () => {
      const approved = bookingsReducer(
        initialBookingsState,
        BookingsActions.approveBookingRequest({ bookingId: 'b1' }),
      );
      expect(approved.bookingRequestActionIds).toEqual(['b1']);

      const both = bookingsReducer(
        approved,
        BookingsActions.rejectBookingRequest({ bookingId: 'b2', reason: null }),
      );
      expect(both.bookingRequestActionIds).toEqual(['b1', 'b2']);
    });

    it('does not duplicate an id already being acted on', () => {
      const start = stateWith({ bookingRequestActionIds: ['b1'] });
      const next = bookingsReducer(
        start,
        BookingsActions.approveBookingRequest({ bookingId: 'b1' }),
      );
      expect(next.bookingRequestActionIds).toEqual(['b1']);
    });

    it('patches the request status and clears the pending id on success', () => {
      const start = stateWith({
        bookingRequests: [makeBookingRequest({ id: 'b1', status: 'PendingApproval' })],
        bookingRequestActionIds: ['b1'],
      });
      const next = bookingsReducer(
        start,
        BookingsActions.approveBookingRequestSuccess({ bookingId: 'b1', status: 'Approved' }),
      );
      expect(next.bookingRequests[0].status).toBe('Approved');
      expect(next.bookingRequestActionIds).toEqual([]);
    });

    it('clears the pending id and records the error on failure', () => {
      const start = stateWith({ bookingRequestActionIds: ['b1'] });
      const next = bookingsReducer(
        start,
        BookingsActions.approveBookingRequestFailure({ bookingId: 'b1', error: 'boom' }),
      );
      expect(next.bookingRequestActionIds).toEqual([]);
      expect(next.bookingRequestsError).toBe('boom');
    });
  });

  describe('loadBookingDetail', () => {
    it('keeps the in-view detail when re-loading the same booking', () => {
      const detail = makeBookingDetail({ id: 'b1' });
      const start = stateWith({ bookingDetail: detail });
      const next = bookingsReducer(
        start,
        BookingsActions.loadBookingDetail({ bookingId: 'b1' }),
      );
      expect(next.bookingDetail).toBe(detail);
      expect(next.bookingDetailLoading).toBe(true);
    });

    it('drops a stale detail when navigating to a different booking', () => {
      const start = stateWith({ bookingDetail: makeBookingDetail({ id: 'b1' }) });
      const next = bookingsReducer(
        start,
        BookingsActions.loadBookingDetail({ bookingId: 'b2' }),
      );
      expect(next.bookingDetail).toBeNull();
    });
  });

  describe('optimistic lifecycle transitions', () => {
    it('optimistically flips the detail to Active and stamps activeAt on markActive', () => {
      const start = stateWith({
        bookingDetail: makeBookingDetail({ status: 'Approved', activeAt: null }),
      });
      const next = bookingsReducer(
        start,
        BookingsActions.markActive({ bookingId: 'booking-1' }),
      );
      expect(next.bookingDetail?.status).toBe('Active');
      expect(next.bookingDetail?.activeAt).not.toBeNull();
      expect(next.bookingActionPending).toBe(true);
    });

    it('optimistically flips the detail to Completed on completeBooking', () => {
      const start = stateWith({
        bookingDetail: makeBookingDetail({ status: 'Active', completedAt: null }),
      });
      const next = bookingsReducer(
        start,
        BookingsActions.completeBooking({ bookingId: 'booking-1' }),
      );
      expect(next.bookingDetail?.status).toBe('Completed');
      expect(next.bookingDetail?.completedAt).not.toBeNull();
      expect(next.bookingActionPending).toBe(true);
    });

    it('does nothing to a null detail (defensive)', () => {
      const next = bookingsReducer(
        initialBookingsState,
        BookingsActions.markActive({ bookingId: 'booking-1' }),
      );
      expect(next.bookingDetail).toBeNull();
      expect(next.bookingActionPending).toBe(true);
    });

    it('reconciles to the authoritative server detail on success', () => {
      const server = makeBookingDetail({ status: 'Active', activeAt: '2026-07-02T00:00:00.000Z' });
      const start = stateWith({ bookingActionPending: true, bookingActionError: 'stale' });
      const next = bookingsReducer(
        start,
        BookingsActions.bookingActionSuccess({ detail: server }),
      );
      expect(next.bookingDetail).toBe(server);
      expect(next.bookingActionPending).toBe(false);
      expect(next.bookingActionError).toBeNull();
    });

    it('records the action error and stops pending on failure (detail left for reload)', () => {
      const optimistic = makeBookingDetail({ status: 'Completed' });
      const start = stateWith({ bookingDetail: optimistic, bookingActionPending: true });
      const next = bookingsReducer(
        start,
        BookingsActions.bookingActionFailure({ bookingId: 'booking-1', error: 'rejected' }),
      );
      expect(next.bookingActionPending).toBe(false);
      expect(next.bookingActionError).toBe('rejected');
    });
  });

  describe('cancel booking', () => {
    it('marks the matching my-booking Cancelled and records the success id', () => {
      const start = stateWith({
        myBookings: [makeMyBooking({ id: 'b1', status: 'Approved' }), makeMyBooking({ id: 'b2' })],
        cancelBookingPending: true,
      });
      const next = bookingsReducer(
        start,
        BookingsActions.cancelBookingSuccess({ bookingId: 'b1' }),
      );
      expect(next.myBookings.find((b) => b.id === 'b1')?.status).toBe('Cancelled');
      expect(next.myBookings.find((b) => b.id === 'b2')?.status).toBe('Pending');
      expect(next.cancelBookingSuccessId).toBe('b1');
      expect(next.cancelBookingPending).toBe(false);
    });
  });

  describe('createBooking', () => {
    it('records the new booking id on success', () => {
      const next = bookingsReducer(
        stateWith({ createBookingLoading: true }),
        BookingsActions.createBookingSuccess({
          booking: {
            id: 'new-b',
            listingId: 'l1',
            status: 'PendingApproval',
            startDate: '2026-07-01',
            endDate: '2026-07-03',
            totalPrice: 10,
            createdAt: null,
          },
        }),
      );
      expect(next.createBookingSuccessId).toBe('new-b');
      expect(next.createBookingLoading).toBe(false);
    });

    it('resets create state on clear', () => {
      const start = stateWith({
        createBookingSuccessId: 'x',
        createBookingError: 'e',
        createBookingLoading: true,
      });
      const next = bookingsReducer(start, BookingsActions.clearCreateBookingState());
      expect(next.createBookingSuccessId).toBeNull();
      expect(next.createBookingError).toBeNull();
      expect(next.createBookingLoading).toBe(false);
    });
  });
});
