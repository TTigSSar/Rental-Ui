import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { BookingsApiService } from '../../bookings/services/bookings-api.service';
import type { BookingRequest, BookingStatus } from '../../bookings/models/booking.model';
import { PublicProfileApiService } from '../../public-profiles/services/public-profile-api.service';
import { MyListingsApiService } from './my-listings-api.service';
import type {
  OwnerBookingRequest,
  OwnerListingStatus,
  OwnerRequestDecision,
} from '../models/owner-listing.model';

/**
 * Owner-view data for the item-details page. Every value is fetched from a real
 * backend endpoint:
 *   - status      ← GET  /api/listings/mine          (Archived ⇒ Paused)
 *   - requests    ← GET  /api/bookings/requests       (filtered by listing)
 *   - renter info ← GET  /api/users/:id/public-profile (avatar, rating, rentals)
 *   - setStatus   ← POST /api/listings/:id/{archive,restore}
 *   - accept      ← POST /api/bookings/:id/approve
 *   - decline     ← POST /api/bookings/:id/reject
 */
@Injectable({ providedIn: 'root' })
export class OwnerListingService {
  private readonly bookingsApi = inject(BookingsApiService);
  private readonly myListingsApi = inject(MyListingsApiService);
  private readonly publicProfileApi = inject(PublicProfileApiService);

  /** Current Active/Paused status for a listing, derived from /listings/mine. */
  getStatus(listingId: string): Observable<OwnerListingStatus> {
    return this.myListingsApi.getMyListings().pipe(
      map((listings) => {
        const match = listings.find((listing) => listing.id === listingId);
        return match?.status === 'Archived' ? 'Paused' : 'Active';
      }),
    );
  }

  /**
   * Incoming booking requests for a single listing, enriched with each renter's
   * public-profile data (avatar, rating, completed-rentals count).
   */
  getRequestsForListing(listingId: string): Observable<OwnerBookingRequest[]> {
    return this.bookingsApi.getBookingRequests().pipe(
      map((requests) => requests.filter((request) => request.listingId === listingId)),
      switchMap((requests) =>
        requests.length === 0
          ? of<OwnerBookingRequest[]>([])
          : forkJoin(requests.map((request) => this.enrichRequest(request))),
      ),
    );
  }

  /** Persists the Active/Paused status via archive (Paused) / restore (Active). */
  setStatus(listingId: string, status: OwnerListingStatus): Observable<void> {
    return status === 'Paused'
      ? this.myListingsApi.archiveListing(listingId)
      : this.myListingsApi.restoreListing(listingId);
  }

  /** Approves an incoming booking request. */
  acceptRequest(bookingId: string): Observable<void> {
    return this.bookingsApi.approveBookingRequest(bookingId);
  }

  /** Declines an incoming booking request. */
  declineRequest(bookingId: string): Observable<void> {
    return this.bookingsApi.rejectBookingRequest(bookingId, null);
  }

  private enrichRequest(request: BookingRequest): Observable<OwnerBookingRequest> {
    return this.publicProfileApi.getPublicProfile(request.renterId).pipe(
      // A missing/failed profile must not drop the request — fall back to the
      // identity already present on the booking request.
      catchError(() => of(null)),
      map((profile): OwnerBookingRequest => ({
        id: request.id,
        renter: {
          id: request.renterId,
          firstName: request.renterFirstName,
          lastName: request.renterLastName,
          avatarUrl: profile?.avatarUrl ?? null,
          rating: profile?.renterRating ?? null,
          rentalsCount: profile?.completedRentalsAsRenter ?? 0,
        },
        requestedAt: request.createdAt ?? '',
        startDate: request.startDate,
        endDate: request.endDate,
        ownerEarnings: request.totalPrice,
        decision: toDecision(request.status),
      })),
    );
  }
}

function toDecision(status: BookingStatus): OwnerRequestDecision {
  switch (status) {
    case 'PendingApproval':
    case 'Pending':
      return 'pending';
    case 'Approved':
    case 'Active':
    case 'ReturnMarked':
    case 'Completed':
      return 'accepted';
    default:
      return 'declined';
  }
}
