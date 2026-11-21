import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { makeUser } from '../../../../../testing/fixtures';
import { initialAuthState, type AuthState } from '../../../auth/store/auth.state';
import en from '../../../../../../public/i18n/en.json';
import { ProfileAvatarFeedbackComponent } from './profile-avatar-feedback.component';

function authState(overrides: Partial<AuthState>) {
  return { auth: { ...initialAuthState, user: makeUser(), ...overrides } };
}

function setup(overrides: Partial<AuthState> = {}) {
  TestBed.configureTestingModule({
    imports: [ProfileAvatarFeedbackComponent, TranslateModule.forRoot()],
    providers: [provideMockStore({ initialState: authState(overrides) })],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', { profile: { avatar: en.profile.avatar } });
  translate.use('en');
  const fixture = TestBed.createComponent(ProfileAvatarFeedbackComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, store: TestBed.inject(MockStore) };
}

describe('ProfileAvatarFeedbackComponent (F-U18, error panel)', () => {
  it('idle and clean: the live region exists but is empty, no alert', () => {
    const { host } = setup();
    const status = host.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.textContent?.trim()).toBe('');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('uploading: a role=status caption "Uploading photo…"', () => {
    const { host } = setup({ avatarStatus: 'uploading' });
    expect(host.querySelector('[role="status"]')!.textContent?.trim()).toBe('Uploading photo…');
  });

  it('removing shows no upload caption', () => {
    const { host } = setup({ avatarStatus: 'removing' });
    expect(host.querySelector('[role="status"]')!.textContent?.trim()).toBe('');
  });

  it.each([
    ['profile.avatar.errorUnsupported', 'This photo format isn’t supported. Choose another photo. On iPhone, set Camera → Formats → Most Compatible.'],
    ['profile.avatar.errorTooLarge', 'This photo is too large. Choose another one.'],
    ['profile.avatar.errorBusy', 'We’re busy right now. Try again shortly.'],
    ['profile.avatar.errorGeneric', 'Couldn’t update your photo. Try again.'],
  ])('error %s renders as a role=alert panel with words and an icon', (errorKey, copy) => {
    const { host } = setup({ avatarError: errorKey });
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent?.trim()).toBe(copy);
    expect(alert.querySelector('.pi-exclamation-circle')).not.toBeNull();
  });

  it('the panel clears when the error does (a new request starts)', () => {
    const { fixture, host, store } = setup({ avatarError: 'profile.avatar.errorBusy' });
    store.setState(authState({ avatarError: null, avatarStatus: 'uploading' }));
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
});
