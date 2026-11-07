import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';

import { makeBookingDetail } from '../../../../../testing/fixtures';
import { chatFeatureKey } from '../../../chat/store/chat.reducer';
import { initialChatState } from '../../../chat/store/chat.state';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import type { BookingDetail } from '../../models/booking.model';
import { bookingsFeatureKey } from '../../store/bookings.reducer';
import { initialBookingsState } from '../../store/bookings.state';
import { BookingDetailsPageComponent } from './booking-details-page.component';

function render(overrides: Partial<BookingDetail>): HTMLElement {
  TestBed.configureTestingModule({
    imports: [BookingDetailsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [bookingsFeatureKey]: {
            ...initialBookingsState,
            bookingDetail: makeBookingDetail({ id: 'booking-1', ...overrides }),
          },
          [chatFeatureKey]: initialChatState,
        },
      }),
      { provide: ReviewsApiService, useValue: { getBookingStatus: () => EMPTY } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'booking-1' } } } },
    ],
  });
  const fixture = TestBed.createComponent(BookingDetailsPageComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BookingDetailsPageComponent — deleted counterparty (ADR-056)', () => {
  it.each([['renter'], ['owner']] as const)(
    'renders plain "Deleted user" with no profile link on the %s side',
    (role) => {
      const host = render({
        role,
        counterpartyFirstName: '',
        counterpartyLastName: '',
        counterpartyIsDeleted: true,
      });
      const row = host.querySelector('.booking-details__counterparty');
      expect(row?.tagName).toBe('SPAN');
      expect(row?.querySelector('app-deleted-user-avatar')).not.toBeNull();
      expect(row?.querySelector('app-deleted-user-name')).not.toBeNull();
      expect(host.querySelector('a[href*="/users/"]')).toBeNull();
    },
  );

  it('still links to the profile of a live counterpart', () => {
    const host = render({ counterpartyFirstName: 'Alex', counterpartyIsDeleted: false });
    const row = host.querySelector('.booking-details__counterparty');
    expect(row?.tagName).toBe('A');
    expect(row?.textContent).toContain('Alex');
  });
});
