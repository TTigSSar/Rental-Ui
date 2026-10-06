import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import { makeUser } from '../../../../testing/fixtures';
import { LanguageService } from '../../../shared/services/language.service';
import type { HomePoint } from '../models/auth.models';
import { AuthApiService } from '../services/auth-api.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';
import { authReducer } from './auth.reducer';
import {
  selectHasHomePoint,
  selectHomePoint,
  selectHomePointError,
  selectHomePointOutsideYerevan,
  selectHomePointSaving,
} from './auth.selectors';
import { initialAuthState, type AuthState } from './auth.state';

const HOME_POINT: HomePoint = {
  latitude: 40.183332,
  longitude: 44.514999,
  publicLatitude: 40.1835,
  publicLongitude: 44.5152,
  district: {
    id: 'd1111111-1111-1111-1111-111111111111',
    code: 'kentron',
    nameEn: 'Kentron',
    nameHy: 'Կենտրոն',
    nameRu: 'Кентрон',
  },
  updatedAt: '2026-09-27T20:03:21.000Z',
};

function stateWith(overrides: Partial<AuthState>): AuthState {
  return { ...initialAuthState, ...overrides };
}

/** A real `ApiProblemDetails`-shaped failure: the code lives in `errorCode`,
 *  NOT in `type` and NOT in a field-level `errors` map. */
function problem(status: number, errorCode: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    url: 'https://localhost:7241/api/auth/me/home-point',
    error: {
      type: `urn:rental:error:${errorCode}`,
      title: 'Home point must be inside Yerevan',
      status,
      errorCode,
    },
  });
}

describe('authReducer — home point', () => {
  it('marks a save in flight and clears any previous refusal', () => {
    const next = authReducer(
      stateWith({ homePointError: 'old', homePointErrorCode: 'auth.home_point_in_use' }),
      AuthActions.updateHomePoint({ payload: { latitude: 40.19, longitude: 44.51 } }),
    );

    expect(next.homePointSaving).toBe(true);
    expect(next.homePointError).toBeNull();
    expect(next.homePointErrorCode).toBeNull();
  });

  /**
   * Both home-point routes answer with the FULL refreshed `CurrentUserResponse`,
   * so the whole user is replaced. Patching only latitude/longitude locally
   * would leave `publicLatitude`/`publicLongitude`/`district` — all re-derived
   * server-side — stale until the next `/api/auth/me`.
   */
  it('replaces the whole user on success, not just the coordinates', () => {
    const before = stateWith({
      user: makeUser({ homePoint: null }),
      homePointSaving: true,
    });

    const next = authReducer(
      before,
      AuthActions.updateHomePointSuccess({ user: makeUser({ homePoint: HOME_POINT }) }),
    );

    expect(next.user?.homePoint).toEqual(HOME_POINT);
    expect(next.homePointSaving).toBe(false);
    expect(next.homePointError).toBeNull();
  });

  it('clears the point on a successful DELETE', () => {
    const next = authReducer(
      stateWith({ user: makeUser({ homePoint: HOME_POINT }), homePointSaving: true }),
      AuthActions.clearHomePointSuccess({ user: makeUser({ homePoint: null }) }),
    );

    expect(next.user?.homePoint).toBeNull();
    expect(next.homePointSaving).toBe(false);
  });

  it('records a refusal with its code and stops the spinner', () => {
    const next = authReducer(
      stateWith({ homePointSaving: true }),
      AuthActions.updateHomePointFailure({
        error: 'Home point must be inside Yerevan',
        errorCode: 'auth.home_point_outside_yerevan',
      }),
    );

    expect(next.homePointSaving).toBe(false);
    expect(next.homePointError).toBe('Home point must be inside Yerevan');
    expect(next.homePointErrorCode).toBe('auth.home_point_outside_yerevan');
  });

  it('a home-point failure never touches the authentication error — the forms must not react to it', () => {
    const next = authReducer(
      stateWith({ user: makeUser({ homePoint: HOME_POINT }), isAuthenticated: true }),
      AuthActions.clearHomePointFailure({
        error: 'You still own listings',
        errorCode: 'auth.home_point_in_use',
      }),
    );

    expect(next.error).toBeNull();
    expect(next.errorCode).toBeNull();
    expect(next.isLoading).toBe(false);
    expect(next.isAuthenticated).toBe(true);
    expect(next.user?.homePoint).toEqual(HOME_POINT);
  });

  it('clearHomePointError drops the refusal without firing anything', () => {
    const next = authReducer(
      stateWith({
        homePointError: 'nope',
        homePointErrorCode: 'auth.home_point_outside_yerevan',
        user: makeUser({ homePoint: HOME_POINT }),
      }),
      AuthActions.clearHomePointError(),
    );

    expect(next.homePointError).toBeNull();
    expect(next.homePointErrorCode).toBeNull();
    expect(next.user?.homePoint).toEqual(HOME_POINT);
  });

  it('logout wipes the home-point slice along with everything else', () => {
    const next = authReducer(
      stateWith({
        user: makeUser({ homePoint: HOME_POINT }),
        homePointSaving: true,
        homePointError: 'x',
        homePointErrorCode: 'auth.home_point_in_use',
      }),
      AuthActions.logout(),
    );

    expect(next.user).toBeNull();
    expect(next.homePointSaving).toBe(false);
    expect(next.homePointError).toBeNull();
    expect(next.homePointErrorCode).toBeNull();
  });

  /**
   * `registerFailure` is the only one of the three auth failures that carries
   * an `errorCode`; the reducer handles all three in one `on()` and must not
   * choke on the two that do not.
   */
  it('keeps errorCode null for a login failure that carries none', () => {
    const next = authReducer(
      stateWith({ isLoading: true }),
      AuthActions.loginFailure({ error: 'Invalid credentials' }),
    );

    expect(next.error).toBe('Invalid credentials');
    expect(next.errorCode).toBeNull();
  });

  it('records the register failure code the sign-up wizard branches on', () => {
    const next = authReducer(
      stateWith({ isLoading: true }),
      AuthActions.registerFailure({
        error: 'Email already registered',
        errorCode: 'auth.duplicate_email',
      }),
    );

    expect(next.errorCode).toBe('auth.duplicate_email');
  });
});

describe('auth selectors — home point', () => {
  it('reads the point off the current user, and reports absence as false', () => {
    const withPoint = { auth: stateWith({ user: makeUser({ homePoint: HOME_POINT }) }) };
    const without = { auth: stateWith({ user: makeUser({ homePoint: null }) }) };

    expect(selectHomePoint(withPoint)).toEqual(HOME_POINT);
    expect(selectHasHomePoint(withPoint)).toBe(true);
    expect(selectHomePoint(without)).toBeNull();
    expect(selectHasHomePoint(without)).toBe(false);
  });

  it('survives an unloaded auth slice without throwing', () => {
    expect(selectHomePoint({} as Record<string, never>)).toBeNull();
    expect(selectHasHomePoint({} as Record<string, never>)).toBe(false);
    expect(selectHomePointSaving({} as Record<string, never>)).toBe(false);
    expect(selectHomePointError({} as Record<string, never>)).toBeNull();
  });

  it('isolates the one refusal the picker renders inline', () => {
    expect(
      selectHomePointOutsideYerevan({
        auth: stateWith({ homePointErrorCode: 'auth.home_point_outside_yerevan' }),
      }),
    ).toBe(true);
    expect(
      selectHomePointOutsideYerevan({
        auth: stateWith({ homePointErrorCode: 'auth.home_point_in_use' }),
      }),
    ).toBe(false);
  });
});

function setupEffects(api: Partial<AuthApiService> = {}) {
  const harness = actionsHarness();
  TestBed.configureTestingModule({
    providers: [
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
  return { harness, effects: TestBed.inject(AuthEffects) };
}

describe('AuthEffects — home point', () => {
  it('updateHomePoint$ PUTs the coordinates and emits the refreshed user', async () => {
    const user = makeUser({ homePoint: HOME_POINT });
    const updateHomePoint = vi.fn(() => of(user));
    const { harness, effects } = setupEffects({ updateHomePoint } as Partial<AuthApiService>);
    const result = collect(effects.updateHomePoint$);

    harness.send(
      AuthActions.updateHomePoint({ payload: { latitude: 40.19, longitude: 44.51 } }),
    );
    harness.complete();

    expect(updateHomePoint).toHaveBeenCalledWith({ latitude: 40.19, longitude: 44.51 });
    expect(await result).toEqual([AuthActions.updateHomePointSuccess({ user })]);
  });

  /**
   * The code arrives in `errorCode`, not as a field-level validation message —
   * so the effect has to read it with `getApiErrorCode()` and carry it through,
   * or the UI cannot tell "outside Yerevan" from any other 400.
   */
  it('updateHomePoint$ carries auth.home_point_outside_yerevan through from errorCode', async () => {
    const updateHomePoint = vi.fn(() =>
      throwError(() => problem(400, 'auth.home_point_outside_yerevan')),
    );
    const { harness, effects } = setupEffects({ updateHomePoint } as Partial<AuthApiService>);
    const result = collect(effects.updateHomePoint$);

    harness.send(AuthActions.updateHomePoint({ payload: { latitude: 41.5, longitude: 45.9 } }));
    harness.complete();

    const actions = await result;
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe(AuthActions.updateHomePointFailure.type);
    expect(
      (actions[0] as ReturnType<typeof AuthActions.updateHomePointFailure>).errorCode,
    ).toBe('auth.home_point_outside_yerevan');
  });

  it('clearHomePoint$ DELETEs and emits the refreshed user', async () => {
    const user = makeUser({ homePoint: null });
    const clearHomePoint = vi.fn(() => of(user));
    const { harness, effects } = setupEffects({ clearHomePoint } as Partial<AuthApiService>);
    const result = collect(effects.clearHomePoint$);

    harness.send(AuthActions.clearHomePoint());
    harness.complete();

    expect(clearHomePoint).toHaveBeenCalled();
    expect(await result).toEqual([AuthActions.clearHomePointSuccess({ user })]);
  });

  it('clearHomePoint$ carries the 409 auth.home_point_in_use code through', async () => {
    const clearHomePoint = vi.fn(() => throwError(() => problem(409, 'auth.home_point_in_use')));
    const { harness, effects } = setupEffects({ clearHomePoint } as Partial<AuthApiService>);
    const result = collect(effects.clearHomePoint$);

    harness.send(AuthActions.clearHomePoint());
    harness.complete();

    const actions = await result;
    expect(
      (actions[0] as ReturnType<typeof AuthActions.clearHomePointFailure>).errorCode,
    ).toBe('auth.home_point_in_use');
  });

  /**
   * A home-point save is a WRITE whose server-side effect is relocating every
   * listing the owner has. Cancelling an in-flight one because a second was
   * dispatched would leave the first's relocation unobserved rather than
   * undone, so the effect must not `switchMap`.
   */
  it('does not cancel an in-flight save when a second one is dispatched', async () => {
    const first = makeUser({ homePoint: HOME_POINT });
    const second = makeUser({ homePoint: { ...HOME_POINT, latitude: 40.25 } });
    const updateHomePoint = vi
      .fn()
      .mockReturnValueOnce(of(first))
      .mockReturnValueOnce(of(second));
    const { harness, effects } = setupEffects({ updateHomePoint } as Partial<AuthApiService>);
    const result = collect(effects.updateHomePoint$);

    harness.send(AuthActions.updateHomePoint({ payload: { latitude: 40.19, longitude: 44.51 } }));
    harness.send(AuthActions.updateHomePoint({ payload: { latitude: 40.25, longitude: 44.52 } }));
    harness.complete();

    expect(await result).toEqual([
      AuthActions.updateHomePointSuccess({ user: first }),
      AuthActions.updateHomePointSuccess({ user: second }),
    ]);
  });
});
