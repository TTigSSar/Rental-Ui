import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { ProfileApiService } from './profile-api.service';
import type { UserProfile } from '../models/profile.model';

// GET /api/profile/me was never implemented on the backend (M-0xx, 2026-07-22
// prod 404). ProfileApiService.getMyProfile() now reads from the real,
// working GET /api/auth/me endpoint (CurrentUserResponse), which carries a
// single `role` field rather than a `roles` array — these tests pin that
// mapping so it can't silently regress back to the dead path.
describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests the auth/me endpoint, not the dead profile/me path', () => {
    service.getMyProfile().subscribe();

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'u1',
      firstName: 'Anna',
      lastName: 'Renter',
      email: 'renter@rental.local',
      phoneNumber: '+37400000000',
      preferredLanguage: 'hy',
      role: 'User',
    });
  });

  it('maps avatarUrl, createdAt and isBlocked from CurrentUserResponse', () => {
    let result:
      | { avatarUrl: string | null; createdAt: string | null; isBlocked: boolean }
      | undefined;
    service.getMyProfile().subscribe((profile) => {
      result = profile;
    });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    req.flush({
      id: 'u5',
      firstName: 'Blocked',
      lastName: 'User',
      email: 'blocked@rental.local',
      role: 'User',
      avatarUrl: 'https://cdn.example/avatar.png',
      createdAt: '2026-01-01T00:00:00Z',
      isBlocked: true,
    });

    expect(result?.avatarUrl).toBe('https://cdn.example/avatar.png');
    expect(result?.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(result?.isBlocked).toBe(true);
  });

  it('defaults avatarUrl/createdAt/isBlocked when absent from the response', () => {
    let result:
      | { avatarUrl: string | null; createdAt: string | null; isBlocked: boolean }
      | undefined;
    service.getMyProfile().subscribe((profile) => {
      result = profile;
    });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    req.flush({
      id: 'u6',
      firstName: 'No',
      lastName: 'Extras',
      email: 'user2@rental.local',
      role: 'User',
    });

    expect(result?.avatarUrl).toBeNull();
    expect(result?.createdAt).toBeNull();
    expect(result?.isBlocked).toBe(false);
  });

  it('maps a single string role to a roles array', () => {
    let result: { roles: string[] } | undefined;
    service.getMyProfile().subscribe((profile) => {
      result = profile;
    });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    req.flush({
      id: 'u2',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'admin@rental.local',
      phoneNumber: null,
      preferredLanguage: null,
      role: 'Admin',
    });

    expect(result?.roles).toEqual(['Admin']);
  });

  it('maps a numeric enum role (0 = User, 1 = Admin)', () => {
    let result: { roles: string[] } | undefined;
    service.getMyProfile().subscribe((profile) => {
      result = profile;
    });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    req.flush({
      id: 'u3',
      firstName: 'Owen',
      lastName: 'Owner',
      email: 'owner@rental.local',
      role: 0,
    });

    expect(result?.roles).toEqual([]);
  });

  it('normalises missing phoneNumber/preferredLanguage to null', () => {
    let result: { phoneNumber: string | null; preferredLanguage: string | null } | undefined;
    service.getMyProfile().subscribe((profile) => {
      result = profile;
    });

    const req = httpMock.expectOne(toApiUrl(ApiContract.auth.currentUser));
    req.flush({
      id: 'u4',
      firstName: 'No',
      lastName: 'Phone',
      email: 'user2@rental.local',
      role: 'User',
    });

    expect(result?.phoneNumber).toBeNull();
    expect(result?.preferredLanguage).toBeNull();
  });
});

/**
 * Home-point model: the twin of the `homePoint` block in
 * `auth-api.service.spec.ts`. Both normalisers read the SAME /api/auth/me
 * payload, so this raw-wire test is deliberately duplicated here — that is the
 * only thing that catches a field mapped in one normaliser and forgotten in the
 * other (M-030).
 */
describe('ProfileApiService — homePoint normalisation', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushMe(homePoint: unknown): UserProfile {
    let result: UserProfile | undefined;
    service.getMyProfile().subscribe((profile) => (result = profile));
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

  it('maps a full homePoint onto the profile, exact coordinates included', () => {
    const profile = flushMe({
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

    expect(profile.homePoint).toEqual({
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
    expect(flushMe({ latitude: 40, longitude: 45, district: null }).homePoint).toEqual({
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
