import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type { UserProfile } from '../models/profile.model';

function normalizeUserProfile(
  profile: Partial<UserProfile> & { id: string },
): UserProfile {
  return {
    id: String(profile.id),
    firstName: typeof profile.firstName === 'string' ? profile.firstName : '',
    lastName: typeof profile.lastName === 'string' ? profile.lastName : '',
    email: typeof profile.email === 'string' ? profile.email : '',
    phoneNumber:
      typeof profile.phoneNumber === 'string' && profile.phoneNumber.length > 0
        ? profile.phoneNumber
        : null,
    preferredLanguage:
      typeof profile.preferredLanguage === 'string' &&
      profile.preferredLanguage.length > 0
        ? profile.preferredLanguage
        : null,
    roles: Array.isArray(profile.roles)
      ? profile.roles.filter((role): role is string => typeof role === 'string')
      : [],
  };
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);

  getMyProfile(): Observable<UserProfile> {
    return this.http
      .get<UserProfile>(toApiUrl(ApiContract.profile.me))
      .pipe(map((profile) => normalizeUserProfile(profile)));
  }
}
