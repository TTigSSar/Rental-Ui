import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { makeBookingRequest } from '../../../../testing/fixtures';
import { BookingsApiService } from './bookings-api.service';
import { OwnerRequestsBadgeService } from './owner-requests-badge.service';

function createService(getBookingRequests: ReturnType<typeof vi.fn>): OwnerRequestsBadgeService {
  TestBed.configureTestingModule({
    providers: [{ provide: BookingsApiService, useValue: { getBookingRequests } }],
  });
  return TestBed.inject(OwnerRequestsBadgeService);
}

describe('OwnerRequestsBadgeService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at zero', () => {
    const service = createService(vi.fn());
    expect(service.count()).toBe(0);
  });

  it('refresh() counts both Pending and PendingApproval requests', () => {
    const getBookingRequests = vi.fn().mockReturnValue(
      of([
        makeBookingRequest({ id: 'a', status: 'Pending' }),
        makeBookingRequest({ id: 'b', status: 'Approved' }),
        makeBookingRequest({ id: 'c', status: 'PendingApproval' }),
        makeBookingRequest({ id: 'd', status: 'Pending' }),
        makeBookingRequest({ id: 'e', status: 'Rejected' }),
      ]),
    );
    const service = createService(getBookingRequests);

    service.refresh();

    // Both actionable statuses count — mirrors `ownerMayDecide()` on the details page and
    // `canDecide` on booking-request-card, so an unexpected 'PendingApproval' wire value
    // can't zero the badge while those surfaces still show it as actionable.
    expect(service.count()).toBe(3);
  });

  it('refresh() swallows errors and leaves the count unchanged', () => {
    const getBookingRequests = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const service = createService(getBookingRequests);

    expect(() => service.refresh()).not.toThrow();
    expect(service.count()).toBe(0);
  });

  it('start() polls immediately, then every 60s, and is idempotent', () => {
    vi.useFakeTimers();
    const getBookingRequests = vi
      .fn()
      .mockReturnValue(of([makeBookingRequest({ status: 'Pending' })]));
    const service = createService(getBookingRequests);

    service.start();
    // `timer(0, ...)` still schedules its first tick through the (fake) macrotask
    // queue rather than emitting synchronously — flush it.
    vi.advanceTimersByTime(0);
    expect(getBookingRequests).toHaveBeenCalledTimes(1);
    expect(service.count()).toBe(1);

    // A second start() must not create a second subscription.
    service.start();
    vi.advanceTimersByTime(60_000);
    expect(getBookingRequests).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(60_000);
    expect(getBookingRequests).toHaveBeenCalledTimes(3);
  });

  it('stop() unsubscribes and clears the count', () => {
    vi.useFakeTimers();
    const getBookingRequests = vi
      .fn()
      .mockReturnValue(of([makeBookingRequest({ status: 'Pending' })]));
    const service = createService(getBookingRequests);

    service.start();
    vi.advanceTimersByTime(0);
    expect(service.count()).toBe(1);

    service.stop();
    expect(service.count()).toBe(0);

    vi.advanceTimersByTime(120_000);
    expect(getBookingRequests).toHaveBeenCalledTimes(1);
  });
});
