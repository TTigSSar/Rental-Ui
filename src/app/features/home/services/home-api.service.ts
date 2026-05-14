import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { normalizeListingPreview } from '../../listings/services/listings-api.service';
import type { ListingPreview } from '../../listings/models/listing.model';
import type { HomeSectionResponse, HomeSectionsResponse } from '../models/home-section.model';

@Injectable({ providedIn: 'root' })
export class HomeApiService {
  private readonly http = inject(HttpClient);

  getHomeSections(itemsPerSection = 6): Observable<HomeSectionResponse[]> {
    const params = new HttpParams().set('itemsPerSection', String(itemsPerSection));

    return this.http
      .get<HomeSectionsResponse>(toApiUrl(ApiContract.home.sections), { params })
      .pipe(
        map((response) => {
          if (!Array.isArray(response?.sections)) {
            return [];
          }
          return response.sections.map((section) => ({
            key: typeof section.key === 'string' ? section.key : '',
            title: typeof section.title === 'string' ? section.title : '',
            items: Array.isArray(section.items)
              ? section.items
                  .filter(
                    (item): item is ListingPreview =>
                      item !== null &&
                      item !== undefined &&
                      typeof item.id === 'string',
                  )
                  .map((item) => normalizeListingPreview(item))
              : [],
          }));
        }),
      );
  }
}
