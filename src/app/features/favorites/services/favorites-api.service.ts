import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type { ListingPreview } from '../../listings/models/listing.model';

@Injectable({ providedIn: 'root' })
export class FavoritesApiService {
  private readonly http = inject(HttpClient);
  private readonly favoritesUrl = '/api/favorites';

  getFavorites(): Observable<ListingPreview[]> {
    return this.http.get<ListingPreview[]>(this.favoritesUrl);
  }

  removeFromFavorites(listingId: string): Observable<void> {
    const url = `${this.favoritesUrl}/${encodeURIComponent(listingId)}`;
    return this.http.delete<void>(url);
  }
}
