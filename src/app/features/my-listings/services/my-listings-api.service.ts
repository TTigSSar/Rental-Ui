import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { DELIVERY_TYPES } from '../../listings/models/create-listing.model';
import type { DeliveryType } from '../../listings/models/create-listing.model';
import { compressImageFiles } from '../../../shared/utils/image-compression.utils';
import type { ListingImage, MyListing, MyListingStatus, RejectionInfo, UpdateListingRequest } from '../models/my-listing.model';

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

/**
 * The API serializes DeliveryType as a string (global JsonStringEnumConverter).
 * Anything else — including the legacy null on listings created before the
 * field existed — reads as "not set".
 */
function coerceDeliveryType(value: unknown): DeliveryType | null {
  return typeof value === 'string' && (DELIVERY_TYPES as readonly string[]).includes(value)
    ? (value as DeliveryType)
    : null;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRejection(raw: Record<string, unknown>): RejectionInfo | null {
  // Backend may return rejection as a nested object or as flat fields prefixed with 'rejection'
  const nested = raw['rejection'];
  if (nested !== null && typeof nested === 'object') {
    const r = nested as Record<string, unknown>;
    const code = toNullableString(r['reasonCode']);
    if (code) {
      return {
        reasonCode: code,
        reasonLabel: toNullableString(r['reasonLabel']) ?? code,
        note: toNullableString(r['note']),
        moderatorName: toNullableString(r['moderatorName']),
        moderatedAt: toNullableString(r['moderatedAt']),
      };
    }
  }
  // Flat fields fallback: rejectionReasonCode, rejectionNote, rejectionModerator, rejectedAt
  const flatCode = toNullableString(raw['rejectionReasonCode']);
  if (flatCode) {
    return {
      reasonCode: flatCode,
      reasonLabel: toNullableString(raw['rejectionReasonLabel']) ?? flatCode,
      note: toNullableString(raw['rejectionNote']),
      moderatorName: toNullableString(raw['rejectionModerator']),
      moderatedAt: toNullableString(raw['rejectedAt']),
    };
  }
  return null;
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
    rejection: normalizeRejection(raw),
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
    minRentalDays:
      typeof raw['minRentalDays'] === 'number' ? (raw['minRentalDays'] as number) : null,
    deliveryType: coerceDeliveryType(raw['deliveryType']),
  };
}

@Injectable({ providedIn: 'root' })
export class MyListingsApiService {
  private readonly http = inject(HttpClient);

  resubmitListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.listings.resubmit(listingId)), {});
  }

  archiveListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.listings.archive(listingId)), {});
  }

  restoreListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.listings.restore(listingId)), {});
  }

  updateListing(listingId: string, request: UpdateListingRequest): Observable<void> {
    return this.http.patch<void>(toApiUrl(ApiContract.listings.byId(listingId)), request);
  }

  deleteListingImage(listingId: string, imageId: string): Observable<unknown> {
    return this.http.delete(toApiUrl(ApiContract.listings.deleteImage(listingId, imageId)));
  }

  reorderListingImages(listingId: string, imageIds: string[]): Observable<unknown> {
    return this.http.put(toApiUrl(ApiContract.listings.reorderImages(listingId)), { imageIds });
  }

  replaceListingImages(listingId: string, files: File[]): Observable<ListingImage[]> {
    return from(compressImageFiles(files)).pipe(
      switchMap((compressed) => {
        const formData = new FormData();
        compressed.forEach(f => formData.append('files', f));
        return this.http.put<ListingImage[]>(
          toApiUrl(ApiContract.listings.uploadImages(listingId)),
          formData,
        );
      }),
    );
  }

  addListingImages(listingId: string, files: File[]): Observable<ListingImage[]> {
    return from(compressImageFiles(files)).pipe(
      switchMap((compressed) => {
        const formData = new FormData();
        compressed.forEach(f => formData.append('files', f));
        return this.http.post<ListingImage[]>(
          toApiUrl(ApiContract.listings.uploadImages(listingId)),
          formData,
        );
      }),
    );
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
