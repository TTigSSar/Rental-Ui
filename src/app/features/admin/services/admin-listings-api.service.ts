import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  PendingListing,
  PendingListingOwner,
  ToyCondition,
} from '../models/pending-listing.model';

const TOY_CONDITIONS = new Set<ToyCondition>(['New', 'LikeNew', 'Good', 'Fair', 'Poor']);

function isToyCondition(value: unknown): value is ToyCondition {
  return typeof value === 'string' && TOY_CONDITIONS.has(value as ToyCondition);
}

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

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizePendingListing(raw: Record<string, unknown> & { id: string }): PendingListing {
  return {
    id: String(raw['id']),
    title: typeof raw['title'] === 'string' ? raw['title'] : '',
    description: typeof raw['description'] === 'string' ? raw['description'] : '',
    city: typeof raw['city'] === 'string' ? raw['city'] : '',
    country: typeof raw['country'] === 'string' ? raw['country'] : '',
    categoryName: toNullableString(raw['categoryName']),
    pricePerDay:
      typeof raw['pricePerDay'] === 'number' && Number.isFinite(raw['pricePerDay'])
        ? raw['pricePerDay']
        : 0,
    depositAmount: toNullableNumber(raw['depositAmount']),
    imageUrl:
      typeof raw['imageUrl'] === 'string' && raw['imageUrl'].length > 0
        ? raw['imageUrl']
        : null,
    createdAt:
      typeof raw['createdAt'] === 'string' && raw['createdAt'].length > 0
        ? raw['createdAt']
        : null,
    owner: normalizePendingOwner(
      (raw['owner'] as Partial<PendingListingOwner> | null | undefined) ?? null,
    ),
    ageFromMonths: toNullableNumber(raw['ageFromMonths']),
    ageToMonths: toNullableNumber(raw['ageToMonths']),
    condition: isToyCondition(raw['condition']) ? raw['condition'] : null,
    hygieneNotes: toNullableString(raw['hygieneNotes']),
    safetyNotes: toNullableString(raw['safetyNotes']),
  };
}

@Injectable({ providedIn: 'root' })
export class AdminListingsApiService {
  private readonly http = inject(HttpClient);

  getPendingListings(): Observable<PendingListing[]> {
    return this.http
      .get<unknown[]>(toApiUrl(ApiContract.adminListings.pending))
      .pipe(
        map((items) =>
          Array.isArray(items)
            ? items
                .filter(
                  (item): item is Record<string, unknown> & { id: string } =>
                    item !== null &&
                    typeof item === 'object' &&
                    typeof (item as Record<string, unknown>)['id'] === 'string',
                )
                .map((item) => normalizePendingListing(item))
            : [],
        ),
      );
  }

  approveListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.adminListings.approve(listingId)), {});
  }

  rejectListing(listingId: string, reason: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.adminListings.reject(listingId)), {
      reason,
    });
  }
}
