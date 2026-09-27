import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';

import { makeBookingDetail } from '../../../../../testing/fixtures';
import * as ChatActions from '../../../chat/store/chat.actions';
import { chatFeatureKey } from '../../../chat/store/chat.reducer';
import { initialChatState } from '../../../chat/store/chat.state';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import type { BookingDetail } from '../../models/booking.model';
import { bookingsFeatureKey } from '../../store/bookings.reducer';
import { initialBookingsState } from '../../store/bookings.state';
import { BookingDetailsPageComponent } from './booking-details-page.component';

const BOOKING_ID = 'booking-1';

/** Reaches the component's message handler (protected on the class). */
interface Internals {
  messageCounterparty(): void;
}

/**
 * Renders the page with a full-detail booking for the given role and returns
 * the fixture, store, and a typed handle onto the protected handler — mirrors
 * the setup style already used by `ListingBookingPageComponent`'s spec for the
 * same cross-feature "Message {name}" CTA.
 */
function createFixture(role: BookingDetail['role']) {
  TestBed.configureTestingModule({
    imports: [BookingDetailsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [bookingsFeatureKey]: {
            ...initialBookingsState,
            bookingDetail: makeBookingDetail({
              id: BOOKING_ID,
              role,
              counterpartyFirstName: 'Alex',
            }),
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
  // Load just the one string so the translate pipe actually interpolates
  // {{name}} (the real i18n bundle isn't wired into unit tests).
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', { bookings: { details: { message: 'Message {{name}}' } } }, true);
  translate.use('en');
  const fixture = TestBed.createComponent(BookingDetailsPageComponent);
  fixture.detectChanges();
  return {
    fixture,
    store,
    api: fixture.componentInstance as unknown as Internals,
  };
}

function messageButton(fixture: ReturnType<typeof createFixture>['fixture']): HTMLElement | null {
  return fixture.nativeElement.querySelector('.booking-details__message-btn');
}

describe('BookingDetailsPageComponent — message counterparty', () => {
  it.each([['renter'], ['owner']] as const)(
    'renders a "Message Alex" button for the %s view',
    (role) => {
      const { fixture } = createFixture(role);
      const btn = messageButton(fixture);
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toContain('Message Alex');
    },
  );

  it.each([['renter'], ['owner']] as const)(
    'dispatches openConversationFromBooking with the booking id from the %s view',
    (role) => {
      const { store, api } = createFixture(role);
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      api.messageCounterparty();

      expect(dispatchSpy).toHaveBeenCalledWith(
        ChatActions.openConversationFromBooking({ bookingId: BOOKING_ID }),
      );
    },
  );
});
