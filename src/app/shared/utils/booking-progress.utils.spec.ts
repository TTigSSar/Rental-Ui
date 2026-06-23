import type { BookingStatus } from '../../features/bookings/models/booking.model';

import { computeBookingProgress } from './booking-progress.utils';

const STEP_KEYS = [
  'bookings.progress.pending',
  'bookings.progress.approved',
  'bookings.progress.active',
  'bookings.progress.completed',
];

describe('computeBookingProgress', () => {
  it('always exposes the four happy-path nodes in order', () => {
    const { steps } = computeBookingProgress('Pending', null);
    expect(steps.map((s) => s.labelKey)).toEqual(STEP_KEYS);
  });

  describe('happy path', () => {
    it('marks the first node current while Pending', () => {
      const { steps, isOffPath, terminalLabelKey } = computeBookingProgress(
        'Pending',
        null,
      );
      expect(steps.map((s) => s.state)).toEqual([
        'current',
        'upcoming',
        'upcoming',
        'upcoming',
      ]);
      expect(isOffPath).toBe(false);
      expect(terminalLabelKey).toBeNull();
    });

    it('treats PendingApproval the same as Pending', () => {
      expect(computeBookingProgress('PendingApproval', null).steps[0].state).toBe(
        'current',
      );
    });

    it('completes the first node and makes Approved current', () => {
      expect(
        computeBookingProgress('Approved', null).steps.map((s) => s.state),
      ).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    });

    it('puts the current marker on the active node for Active and ReturnMarked', () => {
      const active = computeBookingProgress('Active', null).steps.map((s) => s.state);
      const returned = computeBookingProgress('ReturnMarked', null).steps.map(
        (s) => s.state,
      );
      const expected = ['done', 'done', 'current', 'upcoming'];
      expect(active).toEqual(expected);
      expect(returned).toEqual(expected);
    });

    it('marks every node done once Completed', () => {
      const { steps } = computeBookingProgress('Completed', null);
      expect(steps.every((s) => s.state === 'done')).toBe(true);
    });
  });

  describe('off-path terminal statuses', () => {
    it.each(['Rejected', 'Cancelled', 'Archived', 'Expired'] as const)(
      'renders %s as a stopped bar with a terminal label and no current node',
      (status) => {
        const progress = computeBookingProgress(status, null);
        expect(progress.isOffPath).toBe(true);
        expect(progress.terminalLabelKey).not.toBeNull();
        expect(progress.steps.every((s) => s.state === 'upcoming')).toBe(true);
      },
    );
  });

  it('defaults an unknown status to the first node (defensive)', () => {
    const { steps, isOffPath } = computeBookingProgress(
      'Weird' as BookingStatus,
      null,
    );
    expect(isOffPath).toBe(false);
    expect(steps[0].state).toBe('current');
  });
});
