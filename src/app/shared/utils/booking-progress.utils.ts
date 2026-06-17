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

// The four happy-path nodes. The last node is relabelled "Completion" while a return
// is awaiting confirmation, and "Completed" once the booking is done.
const STEP_LABEL_KEYS = [
  'bookings.progress.pending',
  'bookings.progress.approved',
  'bookings.progress.active',
  'bookings.progress.completed',
] as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function offPath(status: BookingStatus): BookingProgress {
  return {
    steps: STEP_LABEL_KEYS.map((labelKey) => ({ labelKey, state: 'upcoming' as const })),
    isOffPath: true,
    terminalLabelKey: mapBookingStatusLabelKey(status),
  };
}

/**
 * Maps a booking's stored status (+ start date, since "Active" is derived from dates,
 * not stored) onto the four-node progress bar shared by cards and the details page.
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

  let currentIndex = 0;
  let allDone = false;
  let returnInProgress = false;

  switch (status) {
    case 'Pending':
    case 'PendingApproval':
      currentIndex = 0;
      break;
    case 'Approved':
      currentIndex = startDate && startDate <= todayIso() ? 2 : 1;
      break;
    case 'ReturnMarked':
      currentIndex = 3;
      returnInProgress = true;
      break;
    case 'Completed':
      currentIndex = 3;
      allDone = true;
      break;
    default:
      currentIndex = 0;
  }

  const steps: ProgressStep[] = STEP_LABEL_KEYS.map((labelKey, index) => {
    const isLast = index === 3;
    const resolvedLabel = isLast && returnInProgress ? 'bookings.progress.completion' : labelKey;

    let state: ProgressStepState;
    if (allDone) {
      state = 'done';
    } else if (index < currentIndex) {
      state = 'done';
    } else if (index === currentIndex) {
      state = 'current';
    } else {
      state = 'upcoming';
    }

    return { labelKey: resolvedLabel, state };
  });

  return { steps, isOffPath: false, terminalLabelKey: null };
}
