import type { BookingStatus } from '../../features/bookings/models/booking.model';

import {
  mapBookingStatusLabelKey,
  mapBookingStatusTone,
} from './booking-status.utils';

describe('mapBookingStatusTone', () => {
  it.each([
    ['Approved', 'approved'],
    ['Active', 'booked'],
    ['ReturnMarked', 'booked'],
    ['Pending', 'pending'],
    ['PendingApproval', 'pending'],
    ['Rejected', 'rejected'],
    ['Archived', 'neutral'],
    ['Cancelled', 'neutral'],
    ['Expired', 'neutral'],
    ['Completed', 'completed'],
  ] as const)('maps %s -> %s tone', (status, tone) => {
    expect(mapBookingStatusTone(status)).toBe(tone);
  });

  it('falls back to pending for an unknown status', () => {
    expect(mapBookingStatusTone('Weird' as BookingStatus)).toBe('pending');
  });
});

describe('mapBookingStatusLabelKey', () => {
  it('collapses Pending and PendingApproval onto the same label key', () => {
    expect(mapBookingStatusLabelKey('Pending')).toBe(
      'bookings.status.pendingApproval',
    );
    expect(mapBookingStatusLabelKey('PendingApproval')).toBe(
      'bookings.status.pendingApproval',
    );
  });

  it.each([
    ['Approved', 'bookings.status.approved'],
    ['Active', 'bookings.status.active'],
    ['ReturnMarked', 'bookings.status.returnMarked'],
    ['Rejected', 'bookings.status.rejected'],
    ['Archived', 'bookings.status.archived'],
    ['Cancelled', 'bookings.status.cancelled'],
    ['Expired', 'bookings.status.expired'],
    ['Completed', 'bookings.status.completed'],
  ] as const)('maps %s -> %s', (status, key) => {
    expect(mapBookingStatusLabelKey(status)).toBe(key);
  });

  it('falls back to the pending label for an unknown status', () => {
    expect(mapBookingStatusLabelKey('Weird' as BookingStatus)).toBe(
      'bookings.status.pendingApproval',
    );
  });
});
