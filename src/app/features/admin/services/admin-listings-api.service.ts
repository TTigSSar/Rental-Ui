import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { PendingListing } from '../models/pending-listing.model';

@Injectable({ providedIn: 'root' })
export class AdminListingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/listings';

  getPendingListings(): Observable<PendingListing[]> {
    return this.http.get<PendingListing[]>(`${this.baseUrl}/pending`);
  }

  approveListing(listingId: string): Observable<void> {
    const url = `${this.baseUrl}/${encodeURIComponent(listingId)}/approve`;
    return this.http.post<void>(url, {});
  }

  rejectListing(listingId: string): Observable<void> {
    const url = `${this.baseUrl}/${encodeURIComponent(listingId)}/reject`;
    return this.http.post<void>(url, {});
  }
}
