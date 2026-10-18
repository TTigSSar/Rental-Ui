import type { BookingStatus } from '../../features/bookings/models/booking.model';

import { mapBookingStatusLabelKey } from './booking-status.utils';

export type ProgressStepState = 'done' | 'current' | 'upcoming';

export interface ProgressStep {
  readonly labelKey: string;
  readonly state: ProgressStepState;
}

export interface BookingProgress {
  readonly steps: readonly ProgressStep[];
  // Terminal statuses that fall off the happy path (rejected / cancelled / archived):
  // the bar is rendered in a neutral "stopped" state with this label instead of step nodes.
  readonly isOffPath: boolean;
  readonly terminalLabelKey: string | null;
}

// The four happy-path nodes. Every step the booking has reached (including the one it
// is in now) is `done`; the next step being waited for is `current`; the rest are
// `upcoming`. A Completed booking has all four done and no current step.
const STEP_LABEL_KEYS = [
  'bookings.progress.pending',
  'bookings.progress.approved',
  'bookings.progress.active',
  'bookings.progress.completed',
] as const;

function offPath(status: BookingStatus): BookingProgress {
  return {
    steps: STEP_LABEL_KEYS.map((labelKey) => ({ labelKey, state: 'upcoming' as const })),
    isOffPath: true,
    terminalLabelKey: mapBookingStatusLabelKey(status),
  };
}

/**
 * Maps a booking's stored status onto the four-node progress bar.
 * Active is now a real stored status (not date-derived).
 */
export function computeBookingProgress(
  status: BookingStatus,
  startDate: string | null | undefined,
): BookingProgress {
  switch (status) {
    case 'Rejected':
    case 'Cancelled':
    case 'Archived':
    case 'Expired':
      return offPath(status);
    default:
      break;
  }

  // Index of the last step the booking has reached (inclusive).
  let reachedIndex = 0;

  switch (status) {
    case 'Pending':
    case 'PendingApproval':
      reachedIndex = 0;
      break;
    case 'Approved':
      reachedIndex = 1;
      break;
    case 'Active':
    case 'ReturnMarked':
      reachedIndex = 2;
      break;
    case 'Completed':
      reachedIndex = 3;
      break;
    default:
      reachedIndex = 0;
  }

  // Reached steps are done; the next step (the one awaited) is current.
  const steps: ProgressStep[] = STEP_LABEL_KEYS.map((labelKey, index) => {
    let state: ProgressStepState;
    if (index <= reachedIndex) {
      state = 'done';
    } else if (index === reachedIndex + 1) {
      state = 'current';
    } else {
      state = 'upcoming';
    }

    return { labelKey, state };
  });

  return { steps, isOffPath: false, terminalLabelKey: null };
}
