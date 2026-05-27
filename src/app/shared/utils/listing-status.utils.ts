import type { MyListingStatus } from '../../features/my-listings/models/my-listing.model';
import type { BadgeTone } from '../ui/badge/badge.component';

export function mapListingStatusTone(status: MyListingStatus): BadgeTone {
  switch (status) {
    case 'Approved':
      return 'approved';
    case 'Pending':
    case 'PendingApproval':
      return 'pending';
    case 'Rejected':
      return 'rejected';
    case 'Archived':
      return 'neutral';
    default:
      return 'pending';
  }
}

export function mapListingStatusLabelKey(status: MyListingStatus): string {
  switch (status) {
    case 'Pending':
    case 'PendingApproval':
      return 'myListings.status.pendingApproval';
    case 'Approved':
      return 'myListings.status.approved';
    case 'Rejected':
      return 'myListings.status.rejected';
    case 'Archived':
      return 'myListings.status.archived';
    default:
      return 'myListings.status.pendingApproval';
  }
}
