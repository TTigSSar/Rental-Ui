import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';

import { makeBookingDetail } from '../../../../../testing/fixtures';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import type { BookingDetail } from '../../models/booking.model';
import { selectBookingDetail, selectCancelBookingPending } from '../../store/bookings.selectors';
import { BookingDetailsPageComponent } from './booking-details-page.component';

/**
 * Tests the cancel-button label/visibility computeds directly, the same isolated style
 * `booking-details-page.eligibility.spec.ts` uses (no `detectChanges()`, so the effects
 * and template never run — just the signal-based business rules).
 */
interface Internals {
  canCancel(): boolean;
  showRentalStartedHint(): boolean;
  cancelLabelKey(): string;
}

function createComponent(detail: Partial<BookingDetail>, cancelPending = false): Internals {
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
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectBookingDetail, makeBookingDetail({ role: 'renter', ...detail }));
  store.overrideSelector(selectCancelBookingPending, cancelPending);
  const fixture = TestBed.createComponent(BookingDetailsPageComponent);
  return fixture.componentInstance as unknown as Internals;
}

describe('BookingDetailsPageComponent — cancel button (renter)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Pending, any start date: shows "Cancel request", cancellable', () => {
    // Start date far in the past — Pending must stay cancellable regardless of date.
    const c = createComponent({ status: 'Pending', startDate: '2020-01-01' });
    expect(c.canCancel()).toBe(true);
    expect(c.cancelLabelKey()).toBe('bookings.details.cancelRequest');
    expect(c.showRentalStartedHint()).toBe(false);
  });

  it('Approved, start date in the future: shows "Cancel booking", cancellable', () => {
    const c = createComponent({ status: 'Approved', startDate: '2099-01-01' });
    expect(c.canCancel()).toBe(true);
    expect(c.cancelLabelKey()).toBe('bookings.details.cancelBooking');
    expect(c.showRentalStartedHint()).toBe(false);
  });

  it('Approved, start date today (UTC): no cancel button, hint shown instead', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T10:00:00.000Z'));
    const c = createComponent({ status: 'Approved', startDate: '2026-09-18' });
    expect(c.canCancel()).toBe(false);
    expect(c.showRentalStartedHint()).toBe(true);
  });

  it('Approved, start date already past: no cancel button, hint shown instead', () => {
    const c = createComponent({ status: 'Approved', startDate: '2020-01-01' });
    expect(c.canCancel()).toBe(false);
    expect(c.showRentalStartedHint()).toBe(true);
  });

  // UTC-boundary case: Armenia is UTC+4, so 23:30 UTC on the 18th is already 03:30 on the
  // 19th locally — but the backend compares against the UTC calendar date, so a booking
  // starting on the 19th must still read as cancellable at this instant.
  it('UTC boundary: booking starting "tomorrow" stays cancellable while UTC is still today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T23:30:00.000Z')); // 03:30 on the 19th in Yerevan
    const c = createComponent({ status: 'Approved', startDate: '2026-09-19' });
    expect(c.canCancel()).toBe(true);
    expect(c.cancelLabelKey()).toBe('bookings.details.cancelBooking');
    expect(c.showRentalStartedHint()).toBe(false);
  });

  it('shows the "Cancelling..." label while a cancel is in flight', () => {
    const c = createComponent({ status: 'Pending' }, true);
    expect(c.cancelLabelKey()).toBe('bookings.details.cancelling');
  });

  it('does not show the cancel button or hint to the owner', () => {
    const c = createComponent({ role: 'owner', status: 'Approved', startDate: '2099-01-01' });
    expect(c.canCancel()).toBe(false);
    expect(c.showRentalStartedHint()).toBe(false);
  });
});
