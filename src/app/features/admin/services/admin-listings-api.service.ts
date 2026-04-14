import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { PendingListing } from '../models/pending-listing.model';

@Injectable({ providedIn: 'root' })
export class AdminListingsApiService {
  private readonly http = inject(HttpClient);

  getPendingListings(): Observable<PendingListing[]> {
    return this.http.get<PendingListing[]>(toApiUrl(ApiContract.adminListings.pending));
  }

  approveListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.adminListings.approve(listingId)), {});
  }

  rejectListing(listingId: string): Observable<void> {
    return this.http.post<void>(toApiUrl(ApiContract.adminListings.reject(listingId)), {});
  }
}
