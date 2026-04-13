import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  CreateListingRequest,
  CreateListingResponse,
  ListingCategoryOption,
  ListingImageUploadResponse,
} from '../models/create-listing.model';
import type { ListingDetails } from '../models/listing-details.model';
import type { ListingPreview } from '../models/listing.model';
import type { ListingsFilter } from '../models/listings-filter.model';
import type { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class ListingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/listings';
  private readonly favoritesUrl = '/api/favorites';
  private readonly categoriesUrl = '/api/categories';

  getListings(
    filter: ListingsFilter,
    page: number,
    pageSize: number,
  ): Observable<PagedResult<ListingPreview>> {
    const params = this.buildListingsQueryParams(filter, page, pageSize);
    return this.http.get<PagedResult<ListingPreview>>(this.baseUrl, { params });
  }

  getListingById(id: string): Observable<ListingDetails> {
    const url = `${this.baseUrl}/${encodeURIComponent(id)}`;
    return this.http.get<ListingDetails>(url);
  }

  createListing(payload: CreateListingRequest): Observable<CreateListingResponse> {
    return this.http.post<CreateListingResponse>(this.baseUrl, payload);
  }

  uploadListingImages(
    listingId: string,
    files: File[],
  ): Observable<ListingImageUploadResponse[]> {
    const url = `${this.baseUrl}/${encodeURIComponent(listingId)}/images`;
    const formData = new FormData();

    for (const file of files) {
      formData.append('files', file, file.name);
    }

    return this.http.post<ListingImageUploadResponse[]>(url, formData);
  }

  getListingCategories(): Observable<ListingCategoryOption[]> {
    return this.http.get<ListingCategoryOption[]>(this.categoriesUrl);
  }

  addToFavorites(listingId: string): Observable<void> {
    const url = `${this.favoritesUrl}/${encodeURIComponent(listingId)}`;
    return this.http.post<void>(url, {});
  }

  removeFromFavorites(listingId: string): Observable<void> {
    const url = `${this.favoritesUrl}/${encodeURIComponent(listingId)}`;
    return this.http.delete<void>(url);
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
}
