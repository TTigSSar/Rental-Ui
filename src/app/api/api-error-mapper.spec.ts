import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import en from '../../../public/i18n/en.json';
import hy from '../../../public/i18n/hy.json';
import ru from '../../../public/i18n/ru.json';
import { API_ERROR_MESSAGE_KEYS, ApiErrorMapper, resolveApiErrorKey } from './api-error-mapper';

const STACK_TRACE =
  'System.InvalidOperationException: Sequence contains no elements\n' +
  '   at RentalPlatform.Application.Services.BookingsService.CreateAsync(Guid userId) ' +
  'in C:\\build\\rental-api\\src\\RentalPlatform.Application\\Services\\BookingsService.cs:line 212\n' +
  '   at RentalPlatform.Api.Controllers.BookingsController.Create() ' +
  'in C:\\build\\rental-api\\src\\RentalPlatform.Api\\Controllers\\BookingsController.cs:line 48';

function problem(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

function leaf(bundle: unknown, path: string): string | undefined {
  const value = path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );
  return typeof value === 'string' ? value : undefined;
}

describe('ApiErrorMapper', () => {
  let mapper: ApiErrorMapper;
  let translate: TranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en);
    translate.setTranslation('ru', ru);
    translate.setTranslation('hy', hy);
    translate.use('en');
    mapper = TestBed.inject(ApiErrorMapper);
  });

  describe('known error code', () => {
    it('renders the translated text in en, ru and hy', () => {
      const error = problem(409, { errorCode: 'booking.overlap', title: 'Dates overlap' });

      translate.use('ru');
      expect(mapper.message(error)).toBe(leaf(ru, 'errors.bookingOverlap'));
      expect(mapper.message(error)).toBe('Эти даты уже заняты. Выберите другие даты.');

      translate.use('hy');
      expect(mapper.message(error)).toBe(leaf(hy, 'errors.bookingOverlap'));
      expect(mapper.message(error)).toBe('Այս ամսաթվերն արդեն զբաղված են։ Ընտրեք այլ ամսաթվեր։');

      translate.use('en');
      expect(mapper.message(error)).toBe(
        'These dates are already booked. Please choose different dates.',
      );
    });

    it('prefers the code over the status', () => {
      const error = problem(400, { errorCode: 'auth.invalid_current_password' });
      expect(resolveApiErrorKey(error)).toBe('profile.security.errors.invalidCurrentPassword');
    });

    it('applies the per-key default params', () => {
      const error = problem(400, { errorCode: 'booking.note_too_long' });
      expect(mapper.message(error)).toContain('280');
      expect(mapper.message(error)).not.toContain('{{');
    });

    it('lets a caller-supplied param win over the default', () => {
      const error = problem(400, { errorCode: 'booking.note_too_long' });
      expect(mapper.message(error, { max: 50 })).toContain('50');
    });

    it('never shows the server title for a known code', () => {
      const error = problem(403, { errorCode: 'auth.user_blocked', title: 'User is blocked' });
      expect(mapper.message(error)).not.toContain('User is blocked');
      expect(mapper.message(error)).toBe(leaf(en, 'errors.userBlocked'));
    });
  });

  describe('AI search limit codes (ADR-054)', () => {
    it.each([
      ['ai_search.rate_limited', 'errors.aiSearchRateLimited'],
      ['ai_search.daily_limit', 'errors.aiSearchDailyLimit'],
    ])('maps %s to %s without leaking the server text', (code, key) => {
      const error = problem(429, { errorCode: code, title: 'English server text' });
      expect(resolveApiErrorKey(error)).toBe(key);
      expect(mapper.message(error)).toBe(leaf(en, key));
      expect(mapper.message(error)).not.toContain('English server text');
    });
  });

  describe('meeting point codes (ADR-053)', () => {
    it.each([
      ['chat.meeting_point_owner_only', 'errors.ownerOnly'],
      ['chat.meeting_point_unavailable', 'errors.meetingPointUnavailable'],
      ['chat.home_point_required', 'chat.meetingPoint.noHomePoint'],
      ['chat.meeting_point_invalid', 'errors.validation'],
      ['chat.meeting_point_outside_yerevan', 'chat.meetingPoint.picker.outside'],
    ])('maps %s to %s without leaking the server text', (code, key) => {
      const error = problem(400, { errorCode: code, title: 'English server text' });
      expect(resolveApiErrorKey(error)).toBe(key);
      expect(mapper.message(error)).toBe(leaf(en, key));
      expect(mapper.message(error)).not.toContain('English server text');
    });
  });

  describe('fallbacks', () => {
    it('a 500 with a stack trace in detail and title resolves to errors.server and leaks nothing', () => {
      const body = {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
        title: STACK_TRACE,
        detail: STACK_TRACE,
        status: 500,
      };
      const error = problem(500, body);

      expect(resolveApiErrorKey(error)).toBe('errors.server');
      const message = mapper.message(error);
      expect(message).toBe(leaf(en, 'errors.server'));
      for (const fragment of [
        'InvalidOperationException',
        'BookingsService',
        'BookingsController.cs',
        'C:\\build',
        'line 212',
        'at RentalPlatform',
      ]) {
        expect(message).not.toContain(fragment);
      }
    });

    it('a 500 with a plain-text body does not render the body', () => {
      const error = problem(500, STACK_TRACE);
      expect(mapper.message(error)).toBe(leaf(en, 'errors.server'));
    });

    it('a 400 with an errors{} dictionary and no code resolves to errors.validation', () => {
      const error = problem(400, {
        title: 'One or more validation errors occurred.',
        errors: { Email: ['The Email field is not a valid e-mail address.'] },
      });

      expect(resolveApiErrorKey(error)).toBe('errors.validation');
      const message = mapper.message(error);
      expect(message).toBe(leaf(en, 'errors.validation'));
      expect(message).not.toContain('Email field');
    });

    it('an unknown code with status 409 resolves to errors.conflict', () => {
      const error = problem(409, { errorCode: 'booking.some_future_code', title: 'Future' });
      expect(resolveApiErrorKey(error)).toBe('errors.conflict');
      expect(mapper.message(error)).toBe(leaf(en, 'errors.conflict'));
    });

    it('status 0 resolves to errors.network', () => {
      const error = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
      expect(resolveApiErrorKey(error)).toBe('errors.network');
      expect(mapper.message(error)).toBe(leaf(en, 'errors.network'));
    });

    it('a non-HTTP Error resolves to errors.generic without its message', () => {
      const error = new Error('Cannot read properties of undefined');
      expect(resolveApiErrorKey(error)).toBe('errors.generic');
      const message = mapper.message(error);
      expect(message).toBe(leaf(en, 'errors.generic'));
      expect(message).not.toContain('Cannot read');
    });

    it.each([
      [400, 'errors.validation'],
      [401, 'errors.sessionExpired'],
      [403, 'errors.forbidden'],
      [404, 'errors.notFound'],
      [409, 'errors.conflict'],
      [429, 'errors.tooManyRequests'],
      [500, 'errors.server'],
      [503, 'errors.server'],
      [418, 'errors.generic'],
    ])('status %i with no code resolves to %s', (status, key) => {
      expect(resolveApiErrorKey(new HttpErrorResponse({ status }))).toBe(key);
    });

    it.each([[null], [undefined], ['boom'], [42], [{ message: 'x' }]])(
      'a non-error value (%j) resolves to errors.generic',
      (value) => {
        expect(resolveApiErrorKey(value)).toBe('errors.generic');
      },
    );
  });

  describe('translation coverage', () => {
    const keys = [
      ...new Set([
        ...Object.values(API_ERROR_MESSAGE_KEYS),
        'errors.network',
        'errors.validation',
        'errors.sessionExpired',
        'errors.forbidden',
        'errors.notFound',
        'errors.conflict',
        'errors.tooManyRequests',
        'errors.server',
        'errors.generic',
      ]),
    ];

    it.each([
      ['en', en],
      ['ru', ru],
      ['hy', hy],
    ])('every mapped key exists in %s', (_lang, bundle) => {
      const missing = keys.filter((key) => leaf(bundle, key) === undefined);
      expect(missing).toEqual([]);
    });
  });
});
