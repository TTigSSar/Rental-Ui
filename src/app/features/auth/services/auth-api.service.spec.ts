import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { AuthApiService } from './auth-api.service';
import type { CurrentUser } from '../models/auth.models';

describe('AuthApiService.updatePreferredLanguage', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('PUTs to the contract endpoint with the code wrapped in { preferredLanguage }', () => {
    service.updatePreferredLanguage('hy').subscribe();

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.updatePreferredLanguage));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ preferredLanguage: 'hy' });

    req.flush({
      id: 'u1',
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      preferredLanguage: 'hy',
      roles: ['User'],
    });
  });

  it('normalizes the updated CurrentUser from the response, same as getCurrentUser', () => {
    let result: unknown;
    service.updatePreferredLanguage('ru').subscribe((user) => {
      result = user;
    });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.updatePreferredLanguage));
    req.flush({
      id: 'u2',
      email: 'renter@rental.local',
      firstName: 'Anna',
      lastName: 'Renter',
      preferredLanguage: 'ru',
      roles: ['User'],
    });

    expect(result).toEqual({
      id: 'u2',
      email: 'renter@rental.local',
      firstName: 'Anna',
      lastName: 'Renter',
      preferredLanguage: 'ru',
      roles: ['User'],
      // A payload with no `homePoint` member maps to null — the same state as a
      // user who has not set one (home-point model).
      homePoint: null,
    });
  });

  it('passes null through when clearing the preference', () => {
    service.updatePreferredLanguage(null).subscribe();

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.updatePreferredLanguage));
    expect(req.request.body).toEqual({ preferredLanguage: null });
    req.flush({
      id: 'u3',
      email: 'user2@rental.local',
      firstName: 'No',
      lastName: 'Pref',
      preferredLanguage: null,
      roles: ['User'],
    });
  });
});

describe('AuthApiService.changePassword', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('PUTs { currentPassword, newPassword } to the contract endpoint and flushes a 204', () => {
    let completed = false;
    service
      .changePassword({ currentPassword: 'OldPass123', newPassword: 'NewPass456' })
      .subscribe({ complete: () => (completed = true) });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.changePassword));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
    });

    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(true);
  });
});

/**
 * Home-point model: `CurrentUserResponse.homePoint` is the SELF-ONLY payload the
 * exact coordinates travel on. It is mapped by two independent hand-written
 * normalisers (`normalizeCurrentUser` here, `normalizeUserProfile` in
 * profile-api.service.ts); a field mapped in only one of them is silently
 * dropped in the other (M-030), so both get the same raw-wire test.
 *
 * The payloads below are the backend's actual wire shape: camelCase JSON from the
 * PascalCase `HomePointResponse`, nulls emitted rather than omitted (no
 * DefaultIgnoreCondition is configured on the API's JsonSerializerOptions).
 */
describe('AuthApiService — homePoint normalisation (GET /api/auth/me)', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushMe(homePoint: unknown): CurrentUser {
    let result: CurrentUser | undefined;
    service.getCurrentUser().subscribe((user) => (result = user));
    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    req.flush({
      id: 'u1',
      email: 'owner@rental.local',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '+37400000000',
      preferredLanguage: 'hy',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      isBlocked: false,
      role: 'User',
      homePoint,
    });
    return result!;
  }

  it('maps a full homePoint, keeping the exact coordinates distinct from the public pair', () => {
    const user = flushMe({
      latitude: 40.183332,
      longitude: 44.514999,
      publicLatitude: 40.1835,
      publicLongitude: 44.5152,
      district: {
        id: 'd0000007-0000-4000-9000-000000000007',
        code: 'kentron',
        nameEn: 'Kentron',
        nameHy: 'Կենտրոն',
        nameRu: 'Кентрон',
      },
      updatedAt: '2026-09-27T20:03:21.000Z',
    });

    expect(user.homePoint).toEqual({
      latitude: 40.183332,
      longitude: 44.514999,
      publicLatitude: 40.1835,
      publicLongitude: 44.5152,
      district: {
        id: 'd0000007-0000-4000-9000-000000000007',
        code: 'kentron',
        nameEn: 'Kentron',
        nameHy: 'Կենտրոն',
        nameRu: 'Кентрон',
      },
      updatedAt: '2026-09-27T20:03:21.000Z',
    });
  });

  it('keeps district null and tolerates missing optional members', () => {
    // A point the backend accepted before the Yerevan-only rule (existing rows
    // are not re-validated — M-038) resolves to no district.
    const user = flushMe({ latitude: 40.0, longitude: 45.0, district: null });

    expect(user.homePoint).toEqual({
      latitude: 40,
      longitude: 45,
      publicLatitude: null,
      publicLongitude: null,
      district: null,
      updatedAt: null,
    });
  });

  it('maps homePoint to null when the user has not set one', () => {
    expect(flushMe(null).homePoint).toBeNull();
  });
});

// Home-point model: the two write routes. Both are [Authorize] and both answer
// with the full CurrentUserResponse, so the same normaliser runs on the result.
describe('AuthApiService — home-point write routes', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('PUTs { latitude, longitude } to the contract path and normalises the returned user', () => {
    let result: CurrentUser | undefined;
    service
      .updateHomePoint({ latitude: 40.183332, longitude: 44.514999 })
      .subscribe((user) => (result = user));

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.homePoint));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ latitude: 40.183332, longitude: 44.514999 });

    req.flush({
      id: 'u1',
      email: 'owner@rental.local',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'User',
      homePoint: {
        latitude: 40.183332,
        longitude: 44.514999,
        publicLatitude: 40.1835,
        publicLongitude: 44.5152,
        district: null,
        updatedAt: '2026-09-27T20:03:21.000Z',
      },
    });

    expect(result!.homePoint?.latitude).toBe(40.183332);
  });

  it('DELETEs the same path and maps the cleared point back to null', () => {
    let result: CurrentUser | undefined;
    service.clearHomePoint().subscribe((user) => (result = user));

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.homePoint));
    expect(req.request.method).toBe('DELETE');

    req.flush({
      id: 'u1',
      email: 'owner@rental.local',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'User',
      homePoint: null,
    });

    expect(result!.homePoint).toBeNull();
  });
});
