import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { MyListing } from '../models/my-listing.model';

@Injectable({ providedIn: 'root' })
export class MyListingsApiService {
  private readonly http = inject(HttpClient);

  getMyListings(): Observable<MyListing[]> {
    return this.http.get<MyListing[]>(toApiUrl(ApiContract.listings.mine));
  }
}
