import type { BookingStatus } from '../../features/bookings/models/booking.model';
import type { BadgeTone } from '../ui/badge/badge.component';

export function mapBookingStatusTone(status: BookingStatus): BadgeTone {
  switch (status) {
    case 'Approved':
      return 'approved';
    case 'Pending':
    case 'PendingApproval':
      return 'pending';
    case 'Rejected':
      return 'rejected';
    case 'Archived':
    case 'Cancelled':
      return 'neutral';
    case 'Completed':
      return 'completed';
    default:
      return 'pending';
  }
}

export function mapBookingStatusLabelKey(status: BookingStatus): string {
  switch (status) {
    case 'Pending':
    case 'PendingApproval':
      return 'bookings.status.pendingApproval';
    case 'Approved':
      return 'bookings.status.approved';
    case 'Rejected':
      return 'bookings.status.rejected';
    case 'Archived':
      return 'bookings.status.archived';
    case 'Cancelled':
      return 'bookings.status.cancelled';
    case 'Completed':
      return 'bookings.status.completed';
    default:
      return 'bookings.status.pendingApproval';
  }
}
