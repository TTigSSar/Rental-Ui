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

function render(detail: Partial<BookingDetail>): HTMLElement {
  TestBed.configureTestingModule({
    imports: [BookingDetailsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [bookingsFeatureKey]: {
            ...initialBookingsState,
            bookingDetail: makeBookingDetail({ id: 'booking-1', ...detail }),
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

describe('BookingDetailsPageComponent renter note (ADR-013)', () => {
  it('shows the owner the "noteFromRenter" title and the text', () => {
    const el = render({ role: 'owner', status: 'Pending', note: 'Bring the box' });
    const card = el.querySelector('.booking-details__note');
    expect(card).not.toBeNull();
    expect(card?.querySelector('h2')?.textContent).toContain('bookings.details.noteFromRenter');
    expect(card?.textContent).toContain('Bring the box');
  });

  it('shows the renter the "yourNote" title and the text', () => {
    const el = render({ role: 'renter', status: 'Completed', note: 'Bring the box' });
    const card = el.querySelector('.booking-details__note');
    expect(card?.querySelector('h2')?.textContent).toContain('bookings.details.yourNote');
    expect(card?.textContent).toContain('Bring the box');
  });

  it('renders no note card when the note is null', () => {
    expect(render({ note: null }).querySelector('.booking-details__note')).toBeNull();
  });
});
