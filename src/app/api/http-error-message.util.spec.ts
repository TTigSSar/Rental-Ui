import { HttpErrorResponse } from '@angular/common/http';

import { toApiErrorMessage } from './http-error-message.util';

function httpError(body: unknown, status = 400): HttpErrorResponse {
  return new HttpErrorResponse({
    error: body,
    status,
    statusText: 'Err',
    url: 'http://api/test',
  });
}

describe('toApiErrorMessage', () => {
  describe('ASP.NET validation problem-details', () => {
    it('returns the first validation message from the errors map', () => {
      const error = httpError({
        errors: {
          Email: ['Email is required', 'Email is invalid'],
          Password: ['Password too short'],
        },
      });
      expect(toApiErrorMessage(error)).toBe('Email is required');
    });

    it('ignores non-string entries and falls through when no strings exist', () => {
      const error = httpError({ errors: { Field: [123, null] }, title: 'Bad Request' });
      expect(toApiErrorMessage(error)).toBe('Bad Request');
    });
  });

  it('prefers `detail` over `title`', () => {
    const error = httpError({ detail: 'The booking has expired', title: 'Conflict' });
    expect(toApiErrorMessage(error)).toBe('The booking has expired');
  });

  it('uses `title` when there is no detail', () => {
    const error = httpError({ title: 'Not Found' }, 404);
    expect(toApiErrorMessage(error)).toBe('Not Found');
  });

  it('uses a plain string body', () => {
    const error = httpError('Something broke');
    expect(toApiErrorMessage(error)).toBe('Something broke');
  });

  it('reports a connection failure for status 0', () => {
    const error = httpError(null, 0);
    expect(toApiErrorMessage(error)).toContain('Unable to connect');
  });

  describe('option overrides', () => {
    it('uses the unauthorized message for a bare 401', () => {
      const error = httpError(null, 401);
      expect(
        toApiErrorMessage(error, { unauthorizedMessage: 'Session expired' }),
      ).toBe('Session expired');
    });

    it('uses the server-error message for 5xx', () => {
      const error = httpError(null, 503);
      expect(
        toApiErrorMessage(error, { serverErrorMessage: 'Try again later' }),
      ).toBe('Try again later');
    });

    it('still prefers a structured body over the option message', () => {
      const error = httpError({ detail: 'Token rejected' }, 401);
      expect(
        toApiErrorMessage(error, { unauthorizedMessage: 'Session expired' }),
      ).toBe('Token rejected');
    });
  });

  it('falls back to the HttpErrorResponse message when nothing structured is present', () => {
    const error = httpError(null, 418);
    expect(toApiErrorMessage(error).length).toBeGreaterThan(0);
  });

  describe('non-HTTP errors', () => {
    it('uses a native Error message', () => {
      expect(toApiErrorMessage(new Error('boom'))).toBe('boom');
    });

    it('returns a generic message for unknown throwables', () => {
      expect(toApiErrorMessage('a string')).toBe('An unexpected error occurred');
      expect(toApiErrorMessage(undefined)).toBe('An unexpected error occurred');
    });
  });
});
