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
    ).pipe(map((result) => this.normalizePagedResult(result, page, pageSize)));
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
    return this.http.get<ListingCategoryOption[]>(toApiUrl(ApiContract.categories.root));
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
    const totalCount = Number.isFinite(result.totalCount)
      ? result.totalCount
      : result.items.length;
    const page = Number.isFinite(result.page) ? result.page : requestedPage;
    const pageSize = Number.isFinite(result.pageSize)
      ? result.pageSize
      : requestedPageSize;
    const hasMore =
      typeof result.hasMore === 'boolean'
        ? result.hasMore
        : page * pageSize < totalCount;

    return {
      ...result,
      totalCount,
      page,
      pageSize,
      hasMore,
    };
  }

  private normalizeListingDetails(listing: ListingDetails): ListingDetails {
    const owner: ListingOwner = listing.owner ?? {
      id: '',
      firstName: '',
      lastName: '',
      phoneNumber: null,
    };
    const images: ListingImage[] = Array.isArray(listing.images) ? listing.images : [];
    const bookedDates: BookedDateRange[] = Array.isArray(listing.bookedDates)
      ? listing.bookedDates
      : [];

    return {
      ...listing,
      owner,
      images,
      bookedDates,
      isFavorite: listing.isFavorite ?? false,
      city: listing.city ?? '',
      description: listing.description ?? '',
      title: listing.title ?? '',
      pricePerDay: Number.isFinite(listing.pricePerDay) ? listing.pricePerDay : 0,
    };
  }
}
