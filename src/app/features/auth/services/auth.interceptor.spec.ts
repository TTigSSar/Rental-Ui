import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthTokenService } from './auth-token.service';

const API = 'https://api.test';

function configure(token: string | null): {
  http: HttpClient;
  httpMock: HttpTestingController;
} {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthTokenService, useValue: { getToken: () => token } },
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('authInterceptor', () => {
  it('attaches a Bearer header to an authenticated request when a token exists', () => {
    const { http, httpMock } = configure('jwt-123');
    http.get(`${API}/api/bookings/mine`).subscribe();

    const req = httpMock.expectOne(`${API}/api/bookings/mine`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({});
    httpMock.verify();
  });

  it('does not attach a header when there is no token', () => {
    const { http, httpMock } = configure(null);
    http.get(`${API}/api/bookings/mine`).subscribe();

    const req = httpMock.expectOne(`${API}/api/bookings/mine`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it('treats a whitespace-only token as no token', () => {
    const { http, httpMock } = configure('   ');
    http.get(`${API}/api/bookings/mine`).subscribe();

    const req = httpMock.expectOne(`${API}/api/bookings/mine`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it.each([
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/external',
  ])('never attaches a token to the unauthenticated endpoint %s', (path) => {
    const { http, httpMock } = configure('jwt-123');
    http.post(`${API}${path}`, {}).subscribe();

    const req = httpMock.expectOne(`${API}${path}`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it('DOES attach a token to /api/auth/me (an authenticated auth endpoint)', () => {
    const { http, httpMock } = configure('jwt-123');
    http.get(`${API}/api/auth/me`).subscribe();

    const req = httpMock.expectOne(`${API}/api/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
    req.flush({});
    httpMock.verify();
  });
});
