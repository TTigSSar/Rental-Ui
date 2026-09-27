import type { BookingStatus } from '../../bookings/models/booking.model';
import { toDecision } from './owner-listing.service';

describe('toDecision', () => {
  it.each<[BookingStatus, ReturnType<typeof toDecision>]>([
    ['Pending', 'pending'],
    ['Approved', 'approved'],
    ['Active', 'active'],
    ['Completed', 'completed'],
    ['Rejected', 'declined'],
    ['Cancelled', 'declined'],
    ['Expired', 'declined'],
  ])('maps backend status %s to decision %s', (status, expected) => {
    expect(toDecision(status)).toBe(expected);
  });

  // 'PendingApproval' and 'ReturnMarked' are stale BookingStatus members the backend never
  // actually sends; toDecision no longer special-cases them and they fall through to the
  // same `default` as any other unrecognized status.
  it.each<BookingStatus>(['PendingApproval', 'ReturnMarked', 'Archived'])(
    'falls back to declined for the stale/unused status %s',
    (status) => {
      expect(toDecision(status)).toBe('declined');
    },
  );
});
