import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';

import { makeBookingDetail } from '../../../../../testing/fixtures';
import { chatFeatureKey } from '../../../chat/store/chat.reducer';
import { initialChatState } from '../../../chat/store/chat.state';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import type { BookingDetail, BookingStatus } from '../../models/booking.model';
import * as BookingsActions from '../../store/bookings.actions';
import { bookingsFeatureKey } from '../../store/bookings.reducer';
import {
  selectBookingDetail,
  selectBookingRequestActionIds,
} from '../../store/bookings.selectors';
import { initialBookingsState, type BookingsState } from '../../store/bookings.state';
import { BookingDetailsPageComponent } from './booking-details-page.component';

const BOOKING_ID = 'booking-1';

/**
 * Defect A: an owner viewing a Pending request via /bookings/:id had no way to
 * approve/decline it at all — the footer only ever covered markActive/complete/review.
 * These tests cover the added owner decision footer, one transition earlier than M-042.
 */
function createFixture(detail: Partial<BookingDetail>, stateOverrides: Partial<BookingsState> = {}) {
  TestBed.configureTestingModule({
    imports: [BookingDetailsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [bookingsFeatureKey]: {
            ...initialBookingsState,
            bookingDetail: makeBookingDetail({ id: BOOKING_ID, ...detail }),
            ...stateOverrides,
          },
          [chatFeatureKey]: initialChatState,
        },
      }),
      { provide: ReviewsApiService, useValue: { getBookingStatus: () => EMPTY } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => BOOKING_ID } } },
      },
    ],
  });

  const store = TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(BookingDetailsPageComponent);
  fixture.detectChanges();
  return { fixture, store };
}

function decisionFooter(
  fixture: ReturnType<typeof createFixture>['fixture'],
): HTMLElement | null {
  return fixture.nativeElement.querySelector('.booking-details__footer-row');
}

describe('BookingDetailsPageComponent — owner approve/decline (Defect A)', () => {
  it('shows Approve/Decline for the owner on a Pending booking', () => {
    const { fixture } = createFixture({ role: 'owner', status: 'Pending' });
    expect(decisionFooter(fixture)).not.toBeNull();
  });

  it('shows Approve/Decline for the owner on a PendingApproval booking', () => {
    const { fixture } = createFixture({ role: 'owner', status: 'PendingApproval' });
    expect(decisionFooter(fixture)).not.toBeNull();
  });

  it('does not show Approve/Decline for the renter, even on a Pending booking', () => {
    const { fixture } = createFixture({ role: 'renter', status: 'Pending' });
    expect(decisionFooter(fixture)).toBeNull();
  });

  it.each(['Approved', 'Active', 'Completed'] satisfies BookingStatus[])(
    'does not show Approve/Decline for the owner once the booking is %s',
    (status) => {
      const { fixture } = createFixture({ role: 'owner', status });
      expect(decisionFooter(fixture)).toBeNull();
    },
  );

  it('clicking Approve dispatches approveBookingRequest with this booking id', () => {
    const { fixture, store } = createFixture({ role: 'owner', status: 'Pending' });
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.booking-details__footer-row .booking-details__primary--split',
    );
    approveBtn.click();

    expect(dispatchSpy).toHaveBeenCalledWith(
      BookingsActions.approveBookingRequest({ bookingId: BOOKING_ID }),
    );
  });

  it('disables both CTAs while this booking\'s decision is in flight', () => {
    const { fixture, store } = createFixture({ role: 'owner', status: 'Pending' });
    store.overrideSelector(selectBookingRequestActionIds, [BOOKING_ID]);
    store.refreshState();
    fixture.detectChanges();

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '.booking-details__footer-row button',
    );
    expect(buttons.length).toBe(2);
    buttons.forEach((btn) => expect(btn.disabled).toBe(true));
  });

  it('does not disable the CTAs for an unrelated booking\'s in-flight decision', () => {
    const { fixture, store } = createFixture({ role: 'owner', status: 'Pending' });
    store.overrideSelector(selectBookingRequestActionIds, ['some-other-booking']);
    store.refreshState();
    fixture.detectChanges();

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
      '.booking-details__footer-row button',
    );
    buttons.forEach((btn) => expect(btn.disabled).toBe(false));
  });

  it('Decline opens the shared reject dialog, and confirming dispatches rejectBookingRequest', () => {
    const { fixture, store } = createFixture({ role: 'owner', status: 'Pending' });
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    const declineBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.booking-details__footer-row .booking-details__decline',
    );
    declineBtn.click();
    fixture.detectChanges();

    expect(document.querySelector('.booking-reject__options')).not.toBeNull();

    (
      fixture.componentInstance as unknown as {
        confirmRejectDialog(result: { reason: string | null }): void;
      }
    ).confirmRejectDialog({ reason: 'dates_unavailable' });

    expect(dispatchSpy).toHaveBeenCalledWith(
      BookingsActions.rejectBookingRequest({ bookingId: BOOKING_ID, reason: 'dates_unavailable' }),
    );
  });

  it('does not flash a pre-existing bookingRequestsError on load, but shows it once this page attempts a decision', () => {
    // `bookingRequestsError` is shared with /profile/requests (loadBookingRequestsFailure
    // writes it too) — a value left over from that page must not leak into this one just
    // because the booking happens to load into view.
    const { fixture, store } = createFixture(
      { role: 'owner', status: 'Pending' },
      { bookingRequestsError: 'stale error from a different page' },
    );

    expect(fixture.nativeElement.textContent).not.toContain('stale error from a different page');

    const approveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.booking-details__footer-row .booking-details__primary--split',
    );
    approveBtn.click();
    // approveBookingRequest dispatched but MockStore doesn't run the real reducer/effects,
    // so `bookingRequestsError` stays exactly as seeded — standing in for "this page's own
    // approve attempt failed with that error".
    store.refreshState();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('stale error from a different page');
  });

  it(
    'switches to the Approved handover CTA and ticks the timeline immediately off the ' +
      'locally-patched detail, with no reload or skeleton flash',
    () => {
      const { fixture, store } = createFixture({ role: 'owner', status: 'Pending' });
      expect(decisionFooter(fixture)).not.toBeNull();

      // Simulates exactly what the reducer's approveBookingRequestSuccess handler does to
      // `bookingDetail` (asserted directly in bookings.reducer.spec.ts): status AND
      // approvedAt are patched onto the in-view detail synchronously, locally, with no
      // refetch — see bookings.effects.ts's comment above loadBookingDetail$ for why a
      // refetch was tried and reverted.
      store.overrideSelector(
        selectBookingDetail,
        makeBookingDetail({
          id: BOOKING_ID,
          role: 'owner',
          status: 'Approved',
          approvedAt: '2026-07-02T00:00:00.000Z',
        }),
      );
      store.overrideSelector(selectBookingRequestActionIds, []);
      store.refreshState();
      fixture.detectChanges();

      // Decide-footer is gone; the existing markActive ("Mark as handed over") footer takes
      // over — same primary-button element the page already used for that transition.
      expect(decisionFooter(fixture)).toBeNull();
      expect(fixture.nativeElement.querySelector('.booking-details__primary')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.booking-details__skeleton')).toBeNull();

      // The Approved timeline row ticks and gets a date off the patched detail alone.
      const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
        '.booking-timeline__item',
      );
      const approvedItem = items[1];
      expect(approvedItem.classList.contains('booking-timeline__item--done')).toBe(true);
      expect(
        approvedItem.querySelector('.booking-timeline__date')?.textContent?.trim(),
      ).not.toBe('—');
    },
  );

  it(
    'renders the rejection-reason card immediately off the locally-patched detail, with no reload',
    () => {
      const { fixture, store } = createFixture({ role: 'owner', status: 'Pending' });
      expect(fixture.nativeElement.querySelector('.booking-details__rejection')).toBeNull();

      // Simulates the reducer's rejectBookingRequestSuccess handler: status AND
      // rejectionReason (the reason the client itself just submitted) are patched onto the
      // in-view detail synchronously, locally, with no refetch.
      store.overrideSelector(
        selectBookingDetail,
        makeBookingDetail({
          id: BOOKING_ID,
          role: 'owner',
          status: 'Rejected',
          rejectionReason: 'dates_unavailable',
        }),
      );
      store.overrideSelector(selectBookingRequestActionIds, []);
      store.refreshState();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.booking-details__rejection')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.booking-details__skeleton')).toBeNull();
    },
  );
});
