import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  PendingListing,
  PendingListingOwner,
} from '../models/pending-listing.model';

function normalizePendingOwner(
  owner: Partial<PendingListingOwner> | null | undefined,
): PendingListingOwner | null {
  if (owner === null || owner === undefined || typeof owner.id !== 'string') {
    return null;
  }
  return {
    id: owner.id,
    firstName: typeof owner.firstName === 'string' ? owner.firstName : '',
    lastName: typeof owner.lastName === 'string' ? owner.lastName : '',
    email: typeof owner.email === 'string' ? owner.email : '',
  };
}

function normalizePendingListing(
  item: Partial<PendingListing> & { id: string },
): PendingListing {
  return {
    id: String(item.id),
    title: typeof item.title === 'string' ? item.title : '',
    city: typeof item.city === 'string' ? item.city : '',
    pricePerDay:
      typeof item.pricePerDay === 'number' && Number.isFinite(item.pricePerDay)
        ? item.pricePerDay
        : 0,
    imageUrl:
      typeof item.imageUrl === 'string' && item.imageUrl.length > 0
        ? item.imageUrl
        : null,
    createdAt:
      typeof item.createdAt === 'string' && item.createdAt.length > 0
        ? item.createdAt
        : null,
    owner: normalizePendingOwner(item.owner ?? null),
  };
}

@Injectable({ providedIn: 'root' })
export class AdminListingsApiService {
  private readonly http = inject(HttpClient);

  getPendingListings(): Observable<PendingListing[]> {
    return this.http
      .get<PendingListing[]>(toApiUrl(ApiContract.adminListings.pending))
      .pipe(
        map((items) =>
          Array.isArray(items)
            ? items
                .filter(
                  (item): item is PendingListing =>
                    item !== null &&
                    item !== undefined &&
                    typeof item.id === 'string',
                )
                .map((item) => normalizePendingListing(item))
            : [],
        ),
      );
  }

  approveListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.adminListings.approve(listingId)), {});
  }

  rejectListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.adminListings.reject(listingId)), {});
  }
}
