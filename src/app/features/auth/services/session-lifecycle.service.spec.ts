import { TestBed } from '@angular/core/testing';
import { Store, provideStore } from '@ngrx/store';

import { makeUser } from '../../../../testing/fixtures';
import { OwnerRequestsBadgeService } from '../../bookings/services/owner-requests-badge.service';
import { ChatBadgeService } from '../../chat/services/chat-badge.service';
import { ChatRealtimeService } from '../../chat/services/chat-realtime.service';
import { NotificationBadgeService } from '../../notifications/services/notification-badge.service';
import * as AuthActions from '../store/auth.actions';
import { authFeatureKey, authReducer } from '../store/auth.reducer';
import { sessionResetMetaReducers } from '../store/session-reset.meta-reducer';
import { SessionLifecycleService } from './session-lifecycle.service';

function setup() {
  const calls: string[] = [];
  const fake = (name: string) => ({
    start: vi.fn(() => calls.push(`${name}.start`)),
    stop: vi.fn(() => calls.push(`${name}.stop`)),
  });
  const services = {
    notif: fake('notif'),
    chat: fake('chat'),
    hub: fake('hub'),
    owner: fake('owner'),
  };
  TestBed.configureTestingModule({
    providers: [
      provideStore({ [authFeatureKey]: authReducer }, { metaReducers: sessionResetMetaReducers }),
      { provide: NotificationBadgeService, useValue: services.notif },
      { provide: ChatBadgeService, useValue: services.chat },
      { provide: ChatRealtimeService, useValue: services.hub },
      { provide: OwnerRequestsBadgeService, useValue: services.owner },
    ],
  });
  const store = TestBed.inject(Store);
  const lifecycle = TestBed.inject(SessionLifecycleService);
  lifecycle.sessionUserId$.subscribe((id) => lifecycle.apply(id));
  return { store, services, calls };
}

type Services = ReturnType<typeof setup>['services'];

const signIn = (store: Store, token: string, id: string) => {
  store.dispatch(AuthActions.verifyEmailSuccess({ token }));
  store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id }) }));
};
const started = (s: Services) =>
  [s.notif, s.chat, s.hub, s.owner].map((x) => x.start.mock.calls.length);
const stopped = (s: Services) =>
  [s.notif, s.chat, s.hub, s.owner].map((x) => x.stop.mock.calls.length);

describe('SessionLifecycleService', () => {
  it('starts hub and pollers once /auth/me delivers the user, not before', () => {
    const { store, services } = setup();
    store.dispatch(AuthActions.loginSuccess({ token: 'ta' }));
    expect(started(services)).toEqual([0, 0, 0, 0]);
    store.dispatch(AuthActions.loadCurrentUserSuccess({ user: makeUser({ id: 'a' }) }));
    expect(started(services)).toEqual([1, 1, 1, 1]);
  });

  it('A -> B without logout: stops then restarts everything for B', () => {
    const { store, services, calls } = setup();
    signIn(store, 'ta', 'a');
    calls.length = 0;
    signIn(store, 'tb', 'b');
    expect(started(services)).toEqual([2, 2, 2, 2]);
    expect(calls.indexOf('hub.stop')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('hub.stop')).toBeLessThan(calls.indexOf('hub.start'));
  });

  it('same user re-authenticating does not restart anything', () => {
    const { store, services } = setup();
    signIn(store, 'ta', 'a');
    signIn(store, 'ta2', 'a');
    expect(started(services)).toEqual([1, 1, 1, 1]);
  });

  it('a transient /auth/me failure that keeps the session does not stop anything', () => {
    const { store, services } = setup();
    signIn(store, 'ta', 'a');
    const before = stopped(services);
    store.dispatch(AuthActions.loadCurrentUserFailure({ error: 'x', preserveSession: true }));
    expect(stopped(services)).toEqual(before);
  });

  it('logout stops everything and starts nothing', () => {
    const { store, services } = setup();
    signIn(store, 'ta', 'a');
    const startsBefore = started(services);
    const stopsBefore = stopped(services);
    store.dispatch(AuthActions.logout());
    expect(started(services)).toEqual(startsBefore);
    expect(stopped(services)).toEqual(stopsBefore.map((n) => n + 1));
  });
});
