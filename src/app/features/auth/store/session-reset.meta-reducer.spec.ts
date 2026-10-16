import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { Store, createAction, createReducer, on, provideStore } from '@ngrx/store';

import { makeUser } from '../../../../testing/fixtures';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthApiService } from '../services/auth-api.service';
import { AuthRedirectService } from '../services/auth-redirect.service';
import { AuthTokenService } from '../services/auth-token.service';
import { ExternalAuthProviderService } from '../services/external-auth-provider.service';
import * as AuthActions from './auth.actions';
import { AuthEffects } from './auth.effects';
import { authFeatureKey, authReducer } from './auth.reducer';
import { selectAuthUser } from './auth.selectors';
import { sessionResetMetaReducers } from './session-reset.meta-reducer';

const bump = createAction('[T] bump');
const favReducer = createReducer(
  0,
  on(bump, (n) => n + 1),
);

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideStore(
        { [authFeatureKey]: authReducer, fav: favReducer },
        { metaReducers: sessionResetMetaReducers },
      ),
      Actions,
      AuthEffects,
      { provide: AuthApiService, useValue: {} },
      { provide: ExternalAuthProviderService, useValue: {} },
      { provide: AuthTokenService, useValue: {} },
      { provide: AuthRedirectService, useValue: {} },
      { provide: LanguageService, useValue: {} },
      { provide: Router, useValue: {} },
    ],
  });
  return { store: TestBed.inject(Store), effects: TestBed.inject(AuthEffects) };
}

const readFav = (store: Store) => {
  let fav = -1;
  store.select((s) => (s as Record<string, number>)['fav']).subscribe((v) => (fav = v));
  return () => fav;
};

describe('session replacement (A -> B without logout)', () => {
  it('detectSessionReplaced$ fires only for a user id change to another non-null id', () => {
    const { store, effects } = setup();
    const seen: unknown[] = [];
    effects.detectSessionReplaced$.subscribe((a) => seen.push(a));

    store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id: 'a' }) }));
    store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id: 'a' }) }));
    expect(seen).toEqual([]);

    store.dispatch(AuthActions.logout());
    store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id: 'b' }) }));
    expect(seen).toEqual([]);

    store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id: 'c' }) }));
    expect(seen).toEqual([AuthActions.sessionReplaced()]);
  });

  it('the meta-reducer resets every non-auth slice and keeps auth', () => {
    const { store } = setup();
    store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id: 'b' }) }));
    store.dispatch(bump());
    store.dispatch(bump());
    const fav = readFav(store);
    expect(fav()).toBe(2);

    store.dispatch(AuthActions.sessionReplaced());

    expect(fav()).toBe(0);
    let id: string | undefined;
    store.select(selectAuthUser).subscribe((u) => (id = u?.id));
    expect(id).toBe('b');
  });

  it('logout leaves other slices alone (logout behaviour unchanged)', () => {
    const { store } = setup();
    store.dispatch(bump());
    store.dispatch(AuthActions.logout());
    expect(readFav(store)()).toBe(1);
  });
});
