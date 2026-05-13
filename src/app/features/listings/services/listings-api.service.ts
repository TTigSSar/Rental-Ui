import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  CreateListingRequest,
  CreateListingResponse,
  ListingCategoryOption,
  ListingImageUploadResponse,
} from '../models/create-listing.model';
import type { ListingDetails } from '../models/listing-details.model';
import type {
  BookedDateRange,
  ListingImage,
  ListingOwner,
  ListingPreview,
} from '../models/listing.model';
import type { ListingsFilter } from '../models/listings-filter.model';
import type { PagedResult } from '../models/paged-result.model';

export function normalizeListingPreview(
  item: Partial<ListingPreview> & { id: string },
): ListingPreview {
  return {
    id: String(item.id),
    title: typeof item.title === 'string' ? item.title : '',
    city: typeof item.city === 'string' ? item.city : '',
    pricePerDay:
      typeof item.pricePerDay === 'number' && Number.isFinite(item.pricePerDay)
        ? item.pricePerDay
        : 0,
    mainImageUrl:
      typeof item.mainImageUrl === 'string' && item.mainImageUrl.length > 0
        ? item.mainImageUrl
        : null,
    isFavorite: item.isFavorite === true,
  };
}

@Injectable({ providedIn: 'root' })
export class ListingsApiService {
  private readonly http = inject(HttpClient);

  getListings(
    filter: ListingsFilter,
    page: number,
    pageSize: number,
  ): Observable<PagedResult<ListingPreview>> {
    const params = this.buildListingsQueryParams(filter, page, pageSize);
    return this.http.get<PagedResult<ListingPreview>>(
      toApiUrl(ApiContract.listings.root),
      { params },
    ).pipe(
      map((result) => this.normalizePagedResult(result, page, pageSize)),
      map((result) => ({
        ...result,
        items: (result.items ?? []).map((item) => normalizeListingPreview(item)),
      })),
    );
  }

  getListingById(id: string): Observable<ListingDetails> {
    return this.http
      .get<ListingDetails>(toApiUrl(ApiContract.listings.byId(id)))
      .pipe(map((listing) => this.normalizeListingDetails(listing)));
  }

  createListing(payload: CreateListingRequest): Observable<CreateListingResponse> {
    return this.http.post<CreateListingResponse>(
      toApiUrl(ApiContract.listings.root),
      payload,
    );
  }

  uploadListingImages(
    listingId: string,
    files: File[],
  ): Observable<ListingImageUploadResponse[]> {
    const formData = new FormData();

    for (const file of files) {
      formData.append('files', file, file.name);
    }

    return this.http.post<ListingImageUploadResponse[]>(
      toApiUrl(ApiContract.listings.uploadImages(listingId)),
      formData,
    );
  }

  getListingCategories(): Observable<ListingCategoryOption[]> {
    return this.http
      .get<ListingCategoryOption[]>(toApiUrl(ApiContract.categories.root))
      .pipe(
        map((categories) =>
          Array.isArray(categories)
            ? categories
                .filter(
                  (category): category is ListingCategoryOption =>
                    category !== null &&
                    category !== undefined &&
                    typeof category.id === 'string',
                )
                .map((category) => ({
                  id: category.id,
                  name: typeof category.name === 'string' ? category.name : '',
                  slug: typeof category.slug === 'string' ? category.slug : '',
                }))
            : [],
        ),
      );
  }

  addToFavorites(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.favorites.byListingId(listingId)), {});
  }

  removeFromFavorites(listingId: string): Observable<void> {
    return this.http.delete<void>(toApiUrl(ApiContract.favorites.byListingId(listingId)));
  }

  private buildListingsQueryParams(
    filter: ListingsFilter,
    page: number,
    pageSize: number,
  ): HttpParams {
    let params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    const city = filter.city?.trim();
    if (city) {
      params = params.set('city', city);
    }

    const categoryId = filter.categoryId?.trim();
    if (categoryId) {
      params = params.set('categoryId', categoryId);
    }

    if (filter.minPrice !== null) {
      params = params.set('minPrice', String(filter.minPrice));
    }
    if (filter.maxPrice !== null) {
      params = params.set('maxPrice', String(filter.maxPrice));
    }

    return params;
  }

  private normalizePagedResult<T>(
    result: PagedResult<T>,
    requestedPage: number,
    requestedPageSize: number,
  ): PagedResult<T> {
    const items = Array.isArray(result.items) ? result.items : [];
    const totalCount =
      typeof result.totalCount === 'number' && Number.isFinite(result.totalCount)
        ? result.totalCount
        : items.length;
    const page =
      typeof result.page === 'number' && Number.isFinite(result.page)
        ? result.page
        : requestedPage;
    const pageSize =
      typeof result.pageSize === 'number' && Number.isFinite(result.pageSize)
        ? result.pageSize
        : requestedPageSize;
    const hasMore =
      typeof result.hasMore === 'boolean'
        ? result.hasMore
        : page * pageSize < totalCount;

    return {
      items,
      totalCount,
      page,
      pageSize,
      hasMore,
    };
  }

  private normalizeListingDetails(listing: ListingDetails): ListingDetails {
    const rawOwner = listing.owner;
    const owner: ListingOwner = {
      id: typeof rawOwner?.id === 'string' ? rawOwner.id : '',
      firstName: typeof rawOwner?.firstName === 'string' ? rawOwner.firstName : '',
      lastName: typeof rawOwner?.lastName === 'string' ? rawOwner.lastName : '',
      phoneNumber:
        typeof rawOwner?.phoneNumber === 'string' && rawOwner.phoneNumber.length > 0
          ? rawOwner.phoneNumber
          : null,
    };

    const images: ListingImage[] = Array.isArray(listing.images)
      ? listing.images
          .filter((image): image is ListingImage => image !== null && image !== undefined)
          .map((image) => ({
            id: typeof image.id === 'string' ? image.id : '',
            url: typeof image.url === 'string' ? image.url : '',
            isPrimary: image.isPrimary === true,
            sortOrder:
              typeof image.sortOrder === 'number' && Number.isFinite(image.sortOrder)
                ? image.sortOrder
                : 0,
          }))
          .filter((image) => image.url.length > 0)
      : [];

    const bookedDates: BookedDateRange[] = Array.isArray(listing.bookedDates)
      ? listing.bookedDates.filter(
          (range): range is BookedDateRange =>
            range !== null &&
            range !== undefined &&
            typeof range.startDate === 'string' &&
            typeof range.endDate === 'string',
        )
      : [];

    return {
      ...listing,
      id: String(listing.id),
      owner,
      images,
      bookedDates,
      isFavorite: listing.isFavorite === true,
      city: typeof listing.city === 'string' ? listing.city : '',
      description: typeof listing.description === 'string' ? listing.description : '',
      title: typeof listing.title === 'string' ? listing.title : '',
      pricePerDay:
        typeof listing.pricePerDay === 'number' && Number.isFinite(listing.pricePerDay)
          ? listing.pricePerDay
          : 0,
      ageFromMonths: normalizeFiniteNumber(listing.ageFromMonths),
      ageToMonths: normalizeFiniteNumber(listing.ageToMonths),
      condition: normalizeNonEmptyString(listing.condition),
      hygieneNotes: normalizeNonEmptyString(listing.hygieneNotes),
      safetyNotes: normalizeNonEmptyString(listing.safetyNotes),
      depositAmount: normalizeFiniteNumber(listing.depositAmount),
    };
  }
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
