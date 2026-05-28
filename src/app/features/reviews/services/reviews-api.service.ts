import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { CreateReviewRequest, RatingSummary, Review } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewsApiService {
  private readonly http = inject(HttpClient);

  submit(request: CreateReviewRequest): Observable<Review> {
    return this.http.post<Review>(toApiUrl(ApiContract.reviews.submit), request);
  }

  getByListing(listingId: string): Observable<Review[]> {
    return this.http.get<Review[]>(toApiUrl(ApiContract.reviews.byListing(listingId)));
  }

  getByUser(userId: string): Observable<Review[]> {
    return this.http.get<Review[]>(toApiUrl(ApiContract.reviews.byUser(userId)));
  }

  getListingSummary(listingId: string): Observable<RatingSummary> {
    return this.http.get<RatingSummary>(toApiUrl(ApiContract.reviews.listingSummary(listingId)));
  }

  getUserSummary(userId: string): Observable<RatingSummary> {
    return this.http.get<RatingSummary>(toApiUrl(ApiContract.reviews.userSummary(userId)));
  }
}
