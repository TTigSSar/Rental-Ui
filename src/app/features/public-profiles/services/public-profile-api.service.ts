import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { PublicUserProfile } from '../models/public-profile.model';

@Injectable({ providedIn: 'root' })
export class PublicProfileApiService {
  private readonly http = inject(HttpClient);

  getPublicProfile(userId: string): Observable<PublicUserProfile> {
    return this.http.get<PublicUserProfile>(
      toApiUrl(ApiContract.users.publicProfile(userId)),
    );
  }
}
