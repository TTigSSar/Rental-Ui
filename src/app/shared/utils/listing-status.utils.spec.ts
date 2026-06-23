import type { MyListingStatus } from '../../features/my-listings/models/my-listing.model';

import {
  mapListingStatusLabelKey,
  mapListingStatusTone,
} from './listing-status.utils';

describe('mapListingStatusTone', () => {
  it.each([
    ['Approved', 'approved'],
    ['Pending', 'pending'],
    ['PendingApproval', 'pending'],
    ['Rejected', 'rejected'],
    ['Archived', 'neutral'],
  ] as const)('maps %s -> %s tone', (status, tone) => {
    expect(mapListingStatusTone(status)).toBe(tone);
  });

  it('falls back to pending for an unknown status', () => {
    expect(mapListingStatusTone('Weird' as MyListingStatus)).toBe('pending');
  });
});

describe('mapListingStatusLabelKey', () => {
  it.each([
    ['Pending', 'myListings.status.pendingApproval'],
    ['PendingApproval', 'myListings.status.pendingApproval'],
    ['Approved', 'myListings.status.approved'],
    ['Rejected', 'myListings.status.rejected'],
    ['Archived', 'myListings.status.archived'],
  ] as const)('maps %s -> %s', (status, key) => {
    expect(mapListingStatusLabelKey(status)).toBe(key);
  });

  it('falls back to the pending label for an unknown status', () => {
    expect(mapListingStatusLabelKey('Weird' as MyListingStatus)).toBe(
      'myListings.status.pendingApproval',
    );
  });
});
