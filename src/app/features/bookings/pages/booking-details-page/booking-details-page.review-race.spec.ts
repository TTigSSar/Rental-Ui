import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { makeBookingDetail, makeReviewStatus } from '../../../../../testing/fixtures';
import { chatFeatureKey } from '../../../chat/store/chat.reducer';
import { initialChatState } from '../../../chat/store/chat.state';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import { bookingsFeatureKey } from '../../store/bookings.reducer';
import { selectBookingActionPending, selectBookingDetail } from '../../store/bookings.selectors';
import { initialBookingsState } from '../../store/bookings.state';
import { BookingDetailsPageComponent } from './booking-details-page.component';

const BOOKING_ID = 'booking-1';

/**
 * Reproduces the confirmed race (see rental-app task): `completeBooking` optimistically
 * flips `bookingDetail.status` to 'Completed' the instant it's dispatched, while
 * `bookingActionPending` is still true because the POST /complete hasn't committed on the
 * server yet. The review-eligibility effect must not fetch against that optimistic,
 * unconfirmed state — only once `bookingActionPending` goes back to false with the
 * server-confirmed detail should it fetch, and only once.
 */
function createFixture(getBookingStatus: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [BookingDetailsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [bookingsFeatureKey]: initialBookingsState,
          [chatFeatureKey]: initialChatState,
        },
      }),
      { provide: ReviewsApiService, useValue: { getBookingStatus } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => BOOKING_ID } } },
      },
    ],
  });

  const store = TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(BookingDetailsPageComponent);
  return { fixture, store };
}

function setState(
  store: MockStore,
  fixture: ComponentFixture<BookingDetailsPageComponent>,
  state: { status: 'Active' | 'Completed'; actionPending: boolean },
): void {
  store.overrideSelector(
    selectBookingDetail,
    makeBookingDetail({ id: BOOKING_ID, role: 'owner', status: state.status }),
  );
  store.overrideSelector(selectBookingActionPending, state.actionPending);
  store.refreshState();
  fixture.detectChanges();
}

describe('BookingDetailsPageComponent — review-eligibility race (owner completes a rental)', () => {
  it('does not fetch review eligibility while the optimistic Completed flip is still pending', () => {
    const getBookingStatus = vi.fn().mockReturnValue(of(makeReviewStatus()));
    const { fixture, store } = createFixture(getBookingStatus);

    // Booking genuinely Active on load.
    setState(store, fixture, { status: 'Active', actionPending: false });
    expect(getBookingStatus).not.toHaveBeenCalled();

    // completeBooking() dispatched: reducer optimistically flips status to 'Completed' but
    // bookingActionPending is still true — POST /complete hasn't resolved yet.
    setState(store, fixture, { status: 'Completed', actionPending: true });
    expect(getBookingStatus).not.toHaveBeenCalled();
  });

  it('fetches exactly once once the server-confirmed Completed detail lands', () => {
    const getBookingStatus = vi.fn().mockReturnValue(of(makeReviewStatus()));
    const { fixture, store } = createFixture(getBookingStatus);

    setState(store, fixture, { status: 'Active', actionPending: false });
    setState(store, fixture, { status: 'Completed', actionPending: true }); // optimistic
    expect(getBookingStatus).not.toHaveBeenCalled();

    // bookingActionSuccess lands: actionPending clears, detail is the real server response.
    setState(store, fixture, { status: 'Completed', actionPending: false });
    expect(getBookingStatus).toHaveBeenCalledOnce();
    expect(getBookingStatus).toHaveBeenCalledWith(BOOKING_ID);

    // A further, unrelated re-render must not refetch — the cache guard still holds.
    fixture.detectChanges();
    expect(getBookingStatus).toHaveBeenCalledOnce();
  });

  it('fetches exactly once on a genuine page load of an already-Completed booking', () => {
    const getBookingStatus = vi.fn().mockReturnValue(of(makeReviewStatus()));
    const { fixture, store } = createFixture(getBookingStatus);

    setState(store, fixture, { status: 'Completed', actionPending: false });

    expect(getBookingStatus).toHaveBeenCalledOnce();
  });
});
