import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { throwError } from 'rxjs';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import { makeUser } from '../../../../testing/fixtures';
import * as AuthActions from '../../auth/store/auth.actions';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type { UserProfile } from '../models/profile.model';
import { ProfileApiService } from '../services/profile-api.service';
import * as ProfileActions from './profile.actions';
import { ProfileEffects } from './profile.effects';
import { profileReducer } from './profile.reducer';
import { initialProfileState } from './profile.state';

const PHOTO = '/uploads/avatars/u1/abc.jpg';

function profile(avatarUrl: string | null): UserProfile {
  return {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'user@example.com',
    phoneNumber: null,
    preferredLanguage: null,
    avatarUrl,
    createdAt: null,
    isBlocked: false,
    roles: ['User'],
    homePoint: null,
  };
}

describe('profileReducer - avatar patch (ADR-070)', () => {
  it('patches profile.avatarUrl from the refreshed user on upload and remove success', () => {
    const loaded = profileReducer(initialProfileState, ProfileActions.loadProfileSuccess({ profile: profile(null) }));

    const uploaded = profileReducer(loaded, AuthActions.uploadAvatarSuccess({ user: makeUser({ avatarUrl: PHOTO }) }));
    expect(uploaded.profile?.avatarUrl).toBe(PHOTO);

    const removed = profileReducer(uploaded, AuthActions.removeAvatarSuccess({ user: makeUser({ avatarUrl: null }) }));
    expect(removed.profile?.avatarUrl).toBeNull();
  });

  it('leaves a not-yet-loaded profile alone', () => {
    const next = profileReducer(initialProfileState, AuthActions.uploadAvatarSuccess({ user: makeUser({ avatarUrl: PHOTO }) }));
    expect(next.profile).toBeNull();
  });
});

describe('ProfileEffects - fallback mapping carries the avatar (ADR-070)', () => {
  it('maps user.avatarUrl (not a hardcoded null) when GET /auth/me fails', async () => {
    const harness = actionsHarness();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        ProfileEffects,
        harness.provider,
        provideMockStore({ selectors: [{ selector: selectAuthUser, value: makeUser({ avatarUrl: PHOTO }) }] }),
        { provide: ProfileApiService, useValue: { getMyProfile: () => throwError(() => new Error('down')) } },
      ],
    });
    TestBed.inject(MockStore);
    const effects = TestBed.inject(ProfileEffects);
    const result = collect(effects.loadProfile$);

    harness.send(ProfileActions.loadProfile());
    harness.complete();

    const [action] = await result;
    expect(action).toMatchObject({ type: ProfileActions.loadProfileSuccess.type });
    expect((action as ReturnType<typeof ProfileActions.loadProfileSuccess>).profile.avatarUrl).toBe(PHOTO);
  });
});
