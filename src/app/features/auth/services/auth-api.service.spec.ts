import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { AuthApiService } from './auth-api.service';

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
