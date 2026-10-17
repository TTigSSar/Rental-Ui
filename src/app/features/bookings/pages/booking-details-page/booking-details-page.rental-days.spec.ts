import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';

import { makeBookingDetail } from '../../../../../testing/fixtures';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import { selectBookingDetail } from '../../store/bookings.selectors';
import { BookingDetailsPageComponent } from './booking-details-page.component';

function rentalDaysFor(startDate: string, endDate: string): number {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore(),
      { provide: ReviewsApiService, useValue: { getBookingStatus: () => EMPTY } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => 'booking-1' } } },
      },
    ],
  });
  TestBed.inject(MockStore).overrideSelector(
    selectBookingDetail,
    makeBookingDetail({ startDate, endDate }),
  );
  const cmp = TestBed.createComponent(BookingDetailsPageComponent)
    .componentInstance as unknown as { rentalDays(): number };
  return cmp.rentalDays();
}

describe('BookingDetailsPageComponent rental days (ADR-043)', () => {
  it('counts a same-day booking as 1', () => {
    expect(rentalDaysFor('2026-09-10', '2026-09-10')).toBe(1);
  });
  it('counts +1 day as 1', () => {
    expect(rentalDaysFor('2026-09-10', '2026-09-11')).toBe(1);
  });
  it('counts +7 days as 7', () => {
    expect(rentalDaysFor('2026-09-10', '2026-09-17')).toBe(7);
  });
  it('accepts ISO strings with a time part', () => {
    expect(rentalDaysFor('2026-09-10T00:00:00', '2026-09-17T00:00:00')).toBe(7);
  });
});
