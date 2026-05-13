import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { normalizeListingPreview } from '../../listings/services/listings-api.service';
import type { ListingPreview } from '../../listings/models/listing.model';

@Injectable({ providedIn: 'root' })
export class FavoritesApiService {
  private readonly http = inject(HttpClient);

  getFavorites(): Observable<ListingPreview[]> {
    return this.http
      .get<ListingPreview[]>(toApiUrl(ApiContract.favorites.root))
      .pipe(
        map((items) =>
          Array.isArray(items)
            ? items
                .filter(
                  (item): item is ListingPreview =>
                    item !== null &&
                    item !== undefined &&
                    typeof item.id === 'string',
                )
                .map((item) => ({ ...normalizeListingPreview(item), isFavorite: true }))
            : [],
        ),
      );
  }

  removeFromFavorites(listingId: string): Observable<void> {
    return this.http.delete<void>(toApiUrl(ApiContract.favorites.byListingId(listingId)));
  }
}
