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

const T = '2026-01-01T10:00:00Z';

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

function stateOf(li: Element): string {
  if (li.classList.contains('booking-timeline__item--done')) return 'done';
  if (li.classList.contains('booking-timeline__item--current')) return 'current';
  return 'upcoming';
}

describe('BookingDetailsPageComponent timeline (ADR-044)', () => {
  const none = { approvedAt: null, activeAt: null, completedAt: null };
  const cases: [string, Partial<BookingDetail>, string[]][] = [
    ['Pending', { ...none, status: 'Pending' }, ['done', 'current', 'upcoming', 'upcoming']],
    [
      'Approved',
      { ...none, status: 'Approved', approvedAt: T },
      ['done', 'done', 'current', 'upcoming'],
    ],
    [
      'Active',
      { ...none, status: 'Active', approvedAt: T, activeAt: T },
      ['done', 'done', 'done', 'current'],
    ],
    [
      'ReturnMarked',
      { ...none, status: 'ReturnMarked', approvedAt: T, activeAt: T },
      ['done', 'done', 'done', 'current'],
    ],
    [
      'Completed',
      { status: 'Completed', approvedAt: T, activeAt: T, completedAt: T },
      ['done', 'done', 'done', 'done'],
    ],
    ['Rejected', { ...none, status: 'Rejected' }, ['done', 'upcoming', 'upcoming', 'upcoming']],
  ];

  for (const [name, detail, expected] of cases) {
    it(`${name}: ${expected.join('/')}`, () => {
      const el = render(detail);
      const items = Array.from(el.querySelectorAll('.booking-timeline__item'));
      expect(items.map(stateOf)).toEqual(expected);
      items.forEach((li, i) => {
        expect(li.getAttribute('aria-current')).toBe(expected[i] === 'current' ? 'step' : null);
      });
      expect(el.querySelector('.booking-timeline .pi-check')).toBeNull();
    });
  }
});
