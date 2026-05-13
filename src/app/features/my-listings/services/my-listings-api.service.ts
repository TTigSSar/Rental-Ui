import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { MyListing, MyListingStatus } from '../models/my-listing.model';

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

function normalizeMyListing(item: Partial<MyListing> & { id: string }): MyListing {
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
    status: coerceMyListingStatus(item.status),
    createdAt:
      typeof item.createdAt === 'string' && item.createdAt.length > 0
        ? item.createdAt
        : null,
  };
}

@Injectable({ providedIn: 'root' })
export class MyListingsApiService {
  private readonly http = inject(HttpClient);

  getMyListings(): Observable<MyListing[]> {
    return this.http.get<MyListing[]>(toApiUrl(ApiContract.listings.mine)).pipe(
      map((items) =>
        Array.isArray(items)
          ? items
              .filter(
                (item): item is MyListing =>
                  item !== null &&
                  item !== undefined &&
                  typeof item.id === 'string',
              )
              .map((item) => normalizeMyListing(item))
          : [],
      ),
    );
  }
}
