import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { MyListing, MyListingStatus, UpdateListingRequest } from '../models/my-listing.model';

const KNOWN_MY_LISTING_STATUSES: ReadonlySet<MyListingStatus> = new Set([
  'PendingApproval',
  'Pending',
  'Approved',
  'Rejected',
  'Archived',
]);

function coerceMyListingStatus(value: unknown): MyListingStatus {
  if (typeof value === 'string' && KNOWN_MY_LISTING_STATUSES.has(value as MyListingStatus)) {
    return value as MyListingStatus;
  }
  return 'PendingApproval';
}

function normalizeMyListing(raw: Record<string, unknown> & { id: string }): MyListing {
  const rawImageUrl = raw['primaryImageUrl'] ?? raw['imageUrl'];
  return {
    id: String(raw['id']),
    title: typeof raw['title'] === 'string' ? raw['title'] : '',
    city: typeof raw['city'] === 'string' ? raw['city'] : '',
    pricePerDay:
      typeof raw['pricePerDay'] === 'number' && Number.isFinite(raw['pricePerDay'])
        ? (raw['pricePerDay'] as number)
        : 0,
    imageUrl:
      typeof rawImageUrl === 'string' && rawImageUrl.length > 0 ? rawImageUrl : null,
    status: coerceMyListingStatus(raw['status']),
    createdAt:
      typeof raw['createdAt'] === 'string' && raw['createdAt'].length > 0
        ? raw['createdAt']
        : null,
    description: typeof raw['description'] === 'string' ? raw['description'] : null,
    categoryId: typeof raw['categoryId'] === 'string' ? raw['categoryId'] : '',
    ageFromMonths:
      typeof raw['ageFromMonths'] === 'number' ? (raw['ageFromMonths'] as number) : null,
    ageToMonths:
      typeof raw['ageToMonths'] === 'number' ? (raw['ageToMonths'] as number) : null,
    condition: typeof raw['condition'] === 'string' && raw['condition'].length > 0
      ? raw['condition']
      : null,
    hygieneNotes: typeof raw['hygieneNotes'] === 'string' && raw['hygieneNotes'].length > 0
      ? raw['hygieneNotes']
      : null,
    safetyNotes: typeof raw['safetyNotes'] === 'string' && raw['safetyNotes'].length > 0
      ? raw['safetyNotes']
      : null,
    depositAmount:
      typeof raw['depositAmount'] === 'number' ? (raw['depositAmount'] as number) : null,
  };
}

@Injectable({ providedIn: 'root' })
export class MyListingsApiService {
  private readonly http = inject(HttpClient);

  archiveListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.listings.archive(listingId)), {});
  }

  restoreListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.listings.restore(listingId)), {});
  }

  updateListing(listingId: string, request: UpdateListingRequest): Observable<void> {
    return this.http.patch<void>(toApiUrl(ApiContract.listings.byId(listingId)), request);
  }

  getMyListings(): Observable<MyListing[]> {
    return this.http.get<unknown[]>(toApiUrl(ApiContract.listings.mine)).pipe(
      map((items) =>
        Array.isArray(items)
          ? items
              .filter(
                (item): item is Record<string, unknown> & { id: string } =>
                  item !== null &&
                  typeof item === 'object' &&
                  typeof (item as Record<string, unknown>)['id'] === 'string',
              )
              .map((item) => normalizeMyListing(item))
          : [],
      ),
    );
  }
}
