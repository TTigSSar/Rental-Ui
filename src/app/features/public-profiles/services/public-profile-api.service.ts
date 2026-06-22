import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { normalizeListingPreview } from '../../listings/services/listings-api.service';
import type { ListingPreview } from '../../listings/models/listing.model';
import type { PublicUserProfile } from '../models/public-profile.model';

@Injectable({ providedIn: 'root' })
export class PublicProfileApiService {
  private readonly http = inject(HttpClient);

  getPublicProfile(userId: string): Observable<PublicUserProfile> {
    return this.http.get<PublicUserProfile>(
      toApiUrl(ApiContract.users.publicProfile(userId)),
    );
  }

  getUserListings(userId: string): Observable<ListingPreview[]> {
    return this.http
      .get<unknown[]>(toApiUrl(ApiContract.users.listings(userId)))
      .pipe(
        map((items) =>
          Array.isArray(items)
            ? items
                .filter((item): item is Record<string, unknown> & { id: string } =>
                  item !== null &&
                  typeof item === 'object' &&
                  typeof (item as Record<string, unknown>)['id'] === 'string',
                )
                .map((item) => {
                  const preview = normalizeListingPreview(item as Parameters<typeof normalizeListingPreview>[0]);
                  const rawStatus = item['listingStatus'];
                  if (rawStatus === 'available' || rawStatus === 'rented') {
                    return { ...preview, listingStatus: rawStatus };
                  }
                  return preview;
                })
            : [],
        ),
      );
  }
}
