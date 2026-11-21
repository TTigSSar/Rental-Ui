import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject, of, throwError } from 'rxjs';

import { actionsHarness } from '../../../../testing/ngrx.helpers';
import { makeUser } from '../../../../testing/fixtures';
import { LanguageService } from '../../../shared/services/language.service';
import { AvatarImageError } from '../../../shared/utils/avatar-image.utils';
import type { CurrentUser } from '../models/auth.models';
import { AuthApiService } from '../services/auth-api.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import { Router } from '@angular/router';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';
import { authReducer } from './auth.reducer';
import {
  selectAvatarError,
  selectAvatarStatus,
  selectCurrentUserAvatarUrl,
} from './auth.selectors';
import { initialAuthState, type AuthState } from './auth.state';
import { avatarErrorKey } from './avatar-error-key';

const PHOTO = '/uploads/avatars/u1/abc.jpg';

function stateWith(overrides: Partial<AuthState>): AuthState {
  return { ...initialAuthState, ...overrides };
}

function problem(status: number, errorCode?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    url: 'https://localhost:7241/api/auth/me/avatar',
    error: errorCode === undefined ? null : { title: 'English server text', status, errorCode },
  });
}

describe('authReducer - avatar (F-U22, F-U25..27)', () => {
  const file = new Blob(['x'], { type: 'image/png' });

  it('uploadAvatar marks uploading and clears the previous error', () => {
    const next = authReducer(
      stateWith({ avatarError: 'profile.avatar.errorGeneric' }),
      AuthActions.uploadAvatar({ file }),
    );
    expect(next.avatarStatus).toBe('uploading');
    expect(next.avatarError).toBeNull();
  });

  it('removeAvatar marks removing', () => {
    const next = authReducer(stateWith({}), AuthActions.removeAvatar());
    expect(next.avatarStatus).toBe('removing');
  });

  it('ignores a new request while a mutation is running (reducer guard)', () => {
    const busy = stateWith({ avatarStatus: 'uploading' });
    expect(authReducer(busy, AuthActions.removeAvatar())).toBe(busy);
    expect(authReducer(busy, AuthActions.uploadAvatar({ file }))).toBe(busy);
  });

  it.each([
    ['upload', AuthActions.uploadAvatarSuccess],
    ['remove', AuthActions.removeAvatarSuccess],
  ] as const)('%s success replaces the whole user and returns to idle', (_name, success) => {
    const refreshed: CurrentUser = makeUser({ avatarUrl: PHOTO, firstName: 'Server' });
    const next = authReducer(
      stateWith({ user: makeUser({ avatarUrl: null }), avatarStatus: 'uploading' }),
      success({ user: refreshed }),
    );
    expect(next.user).toBe(refreshed);
    expect(next.avatarStatus).toBe('idle');
    expect(next.avatarError).toBeNull();
  });

  it.each([
    ['upload', AuthActions.uploadAvatarFailure],
    ['remove', AuthActions.removeAvatarFailure],
  ] as const)('%s failure returns to idle, keeps the old face and stores the error key', (_n, failure) => {
    const user = makeUser({ avatarUrl: PHOTO });
    const next = authReducer(
      stateWith({ user, avatarStatus: 'uploading' }),
      failure({ errorKey: 'profile.avatar.errorBusy' }),
    );
    expect(next.avatarStatus).toBe('idle');
    expect(next.avatarError).toBe('profile.avatar.errorBusy');
    expect(next.user).toBe(user);
  });

  it('logout during an upload resets to idle (F-U27)', () => {
    const next = authReducer(
      stateWith({ user: makeUser(), avatarStatus: 'uploading', avatarError: 'x' }),
      AuthActions.logout(),
    );
    expect(next.avatarStatus).toBe('idle');
    expect(next.avatarError).toBeNull();
    expect(next.user).toBeNull();
  });

  it('clearAvatarError drops only the error', () => {
    const next = authReducer(
      stateWith({ avatarError: 'profile.avatar.errorGeneric' }),
      AuthActions.clearAvatarError(),
    );
    expect(next.avatarError).toBeNull();
  });
});

describe('avatar selectors', () => {
  it('selectCurrentUserAvatarUrl is the single source: null without a user or a picture', () => {
    const root = (auth: AuthState) => ({ auth });
    expect(selectCurrentUserAvatarUrl(root(stateWith({})))).toBeNull();
    expect(selectCurrentUserAvatarUrl(root(stateWith({ user: makeUser({ avatarUrl: null }) })))).toBeNull();
    expect(selectCurrentUserAvatarUrl(root(stateWith({ user: makeUser({ avatarUrl: PHOTO }) })))).toBe(PHOTO);
  });

  it('exposes status and error', () => {
    const root = { auth: stateWith({ avatarStatus: 'removing', avatarError: 'profile.avatar.errorBusy' }) };
    expect(selectAvatarStatus(root)).toBe('removing');
    expect(selectAvatarError(root)).toBe('profile.avatar.errorBusy');
  });

  it('header / profile / admin shell sync: one upload success moves every reader of the selector', () => {
    const before = stateWith({ user: makeUser({ avatarUrl: null }) });
    const after = authReducer(before, AuthActions.uploadAvatarSuccess({ user: makeUser({ avatarUrl: PHOTO }) }));
    expect(selectCurrentUserAvatarUrl({ auth: before })).toBeNull();
    expect(selectCurrentUserAvatarUrl({ auth: after })).toBe(PHOTO);
    const removed = authReducer(after, AuthActions.removeAvatarSuccess({ user: makeUser({ avatarUrl: null }) }));
    expect(selectCurrentUserAvatarUrl({ auth: removed })).toBeNull();
  });
});

describe('avatarErrorKey (F-U29)', () => {
  it.each([
    ['auth.avatar_invalid_type', 400, 'profile.avatar.errorUnsupported'],
    ['auth.avatar_too_large', 400, 'profile.avatar.errorTooLarge'],
    ['auth.avatar_busy', 503, 'profile.avatar.errorBusy'],
    ['auth.avatar_conflict', 409, 'profile.avatar.errorGeneric'],
    ['auth.avatar_missing', 400, 'profile.avatar.errorGeneric'],
    ['auth.avatar_empty', 400, 'profile.avatar.errorGeneric'],
  ])('code %s (%i) -> %s', (code, status, key) => {
    expect(avatarErrorKey(problem(status, code))).toBe(key);
  });

  it('a non-avatar code (blocked user) falls to generic, never a server string', () => {
    expect(avatarErrorKey(problem(403, 'auth.user_blocked'))).toBe('profile.avatar.errorGeneric');
  });

  it('413 without a code (Kestrel/nginx) is "too large"', () => {
    expect(avatarErrorKey(problem(413))).toBe('profile.avatar.errorTooLarge');
  });

  it('400 without a code (multipart limit) is "too large" on this endpoint', () => {
    expect(avatarErrorKey(problem(400))).toBe('profile.avatar.errorTooLarge');
  });

  it.each([415, 429, 0, 401, 500, 502])('%i without a code is generic', (status) => {
    expect(avatarErrorKey(problem(status))).toBe('profile.avatar.errorGeneric');
  });

  it('client-side preparation errors map to unsupported / too large', () => {
    expect(avatarErrorKey(new AvatarImageError('unsupported'))).toBe('profile.avatar.errorUnsupported');
    expect(avatarErrorKey(new AvatarImageError('tooLarge'))).toBe('profile.avatar.errorTooLarge');
  });

  it('an unexpected throw is generic', () => {
    expect(avatarErrorKey(new Error('boom'))).toBe('profile.avatar.errorGeneric');
  });
});

describe('AuthEffects.mutateAvatar$ (F-U22, F-U25..27)', () => {
  const file = new Blob(['x'], { type: 'image/png' });
  const jpeg = new Blob(['j'], { type: 'image/jpeg' });
  const refreshed = makeUser({ avatarUrl: PHOTO });

  function setup(api: Partial<AuthApiService>) {
    const harness = actionsHarness();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        AuthEffects,
        harness.provider,
        provideMockStore(),
        { provide: AuthApiService, useValue: api },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: LanguageService, useValue: { applyFromUser: vi.fn() } },
        { provide: AuthRedirectService, useValue: { consume: vi.fn().mockReturnValue(null) } },
      ],
    });
    TestBed.inject(MockStore);
    const effects = TestBed.inject(AuthEffects);
    const emitted: unknown[] = [];
    effects.mutateAvatar$.subscribe((a) => emitted.push(a));
    return { harness, emitted };
  }

  // The real `prepareAvatarImage` runs (vi.mock of a relative module is unsupported by the Angular
  // unit-test builder): the browser primitives it needs are stubbed instead.
  let createBitmap: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createBitmap = vi.fn(() =>
      Promise.resolve({ width: 800, height: 600, close: vi.fn() } as unknown as ImageBitmap),
    );
    vi.stubGlobal('createImageBitmap', createBitmap);
    const context = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (cb: BlobCallback) => cb(jpeg),
    };
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : realCreate(tag)) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  it('upload: prepares the JPEG, PUTs it and emits success with the refreshed user', async () => {
    const uploadAvatar = vi.fn(() => of(refreshed));
    const { harness, emitted } = setup({ uploadAvatar });

    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();

    expect(createBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(uploadAvatar).toHaveBeenCalledWith(jpeg);
    expect(emitted).toEqual([AuthActions.uploadAvatarSuccess({ user: refreshed })]);
  });

  it('remove: DELETEs without any image processing', async () => {
    const removeAvatar = vi.fn(() => of(makeUser({ avatarUrl: null })));
    const { harness, emitted } = setup({ removeAvatar });

    harness.send(AuthActions.removeAvatar());
    await flush();

    expect(createBitmap).not.toHaveBeenCalled();
    expect(removeAvatar).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([AuthActions.removeAvatarSuccess({ user: makeUser({ avatarUrl: null }) })]);
  });

  it('exhaustMap drops a remove issued during an upload (F-U22)', async () => {
    const pending = new Subject<CurrentUser>();
    const uploadAvatar = vi.fn(() => pending);
    const removeAvatar = vi.fn(() => of(makeUser({ avatarUrl: null })));
    const { harness, emitted } = setup({ uploadAvatar, removeAvatar });

    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();
    harness.send(AuthActions.removeAvatar());
    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();

    expect(removeAvatar).not.toHaveBeenCalled();
    expect(uploadAvatar).toHaveBeenCalledTimes(1);

    pending.next(refreshed);
    pending.complete();
    await flush();
    expect(emitted).toEqual([AuthActions.uploadAvatarSuccess({ user: refreshed })]);

    // once idle again, a new request goes through
    harness.send(AuthActions.removeAvatar());
    await flush();
    expect(removeAvatar).toHaveBeenCalledTimes(1);
  });

  it('a processing error (decode fails) ends in uploadAvatarFailure and never calls the API (F-U25)', async () => {
    createBitmap.mockRejectedValueOnce(new DOMException('cannot decode', 'InvalidStateError'));
    const uploadAvatar = vi.fn();
    const { harness, emitted } = setup({ uploadAvatar });

    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();

    expect(uploadAvatar).not.toHaveBeenCalled();
    expect(emitted).toEqual([
      AuthActions.uploadAvatarFailure({ errorKey: 'profile.avatar.errorUnsupported' }),
    ]);
    // and the effect is still alive: the next request is served
    uploadAvatar.mockReturnValue(of(refreshed));
    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();
    expect(emitted).toHaveLength(2);
  });

  it.each([
    ['an HTTP error with a code', () => throwError(() => problem(503, 'auth.avatar_busy')), 'profile.avatar.errorBusy'],
    ['a status-0 network error', () => throwError(() => problem(0)), 'profile.avatar.errorGeneric'],
    ['413 from nginx', () => throwError(() => problem(413)), 'profile.avatar.errorTooLarge'],
    [
      'an unexpected synchronous throw inside the effect',
      () => {
        throw new Error('boom');
      },
      'profile.avatar.errorGeneric',
    ],
  ])('%s still ends as a failure (status can return to idle) (F-U26)', async (_name, apiCall, errorKey) => {
    const { harness, emitted } = setup({ uploadAvatar: vi.fn(apiCall) });

    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();

    expect(emitted).toEqual([AuthActions.uploadAvatarFailure({ errorKey })]);
    // the reducer takes it back to idle
    const state = authReducer(
      authReducer(initialAuthState, AuthActions.uploadAvatar({ file })),
      emitted[0] as ReturnType<typeof AuthActions.uploadAvatarFailure>,
    );
    expect(state.avatarStatus).toBe('idle');
  });

  it('a failed remove emits removeAvatarFailure', async () => {
    const { harness, emitted } = setup({
      removeAvatar: vi.fn(() => throwError(() => problem(409, 'auth.avatar_conflict'))),
    });
    harness.send(AuthActions.removeAvatar());
    await flush();
    expect(emitted).toEqual([AuthActions.removeAvatarFailure({ errorKey: 'profile.avatar.errorGeneric' })]);
  });

  it('logout during an upload ends the inner observable: the late response is ignored (F-U27)', async () => {
    const pending = new Subject<CurrentUser>();
    const { harness, emitted } = setup({ uploadAvatar: vi.fn(() => pending) });

    harness.send(AuthActions.uploadAvatar({ file }));
    await flush();
    harness.send(AuthActions.logout());
    pending.next(refreshed);
    pending.complete();
    await flush();

    expect(emitted).toEqual([]);
    // the reducer's logout reset leaves the status idle
    const state = authReducer(
      authReducer(initialAuthState, AuthActions.uploadAvatar({ file })),
      AuthActions.logout(),
    );
    expect(state.avatarStatus).toBe('idle');
  });
});
