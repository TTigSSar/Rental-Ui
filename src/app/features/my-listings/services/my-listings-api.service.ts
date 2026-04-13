import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { MyListing } from '../models/my-listing.model';

@Injectable({ providedIn: 'root' })
export class MyListingsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/listings/mine';

  getMyListings(): Observable<MyListing[]> {
    return this.http.get<MyListing[]>(this.baseUrl);
  }
}
