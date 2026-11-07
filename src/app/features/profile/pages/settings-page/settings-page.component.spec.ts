import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import type { CurrentUser } from '../../../auth/models/auth.models';
import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';

import { LanguageService } from '../../../../shared/services/language.service';
import { profileRoutes } from '../../routes';
import { SettingsPageComponent } from './settings-page.component';

const LANGUAGES = [
  { code: 'en', flag: '', native: 'English', label: 'English' },
  { code: 'ru', flag: '', native: 'Русский', label: 'Russian' },
  { code: 'hy', flag: '', native: 'Հայերեն', label: 'Armenian' },
];

function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'u1',
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    phoneNumber: null,
    roles: [],
    hasPassword: true,
    homePoint: null,
    ...overrides,
  };
}

function setup(current: CurrentUser | null = user()) {
  const use = vi.fn();
  TestBed.configureTestingModule({
    imports: [SettingsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      MessageService,
      provideMockStore({
        initialState: { [authFeatureKey]: { ...initialAuthState, user: current, isAuthenticated: current !== null } },
      }),
      { provide: LanguageService, useValue: { languages: LANGUAGES, current: signal(LANGUAGES[0]), use } },
    ],
  });
  const fixture: ComponentFixture<SettingsPageComponent> = TestBed.createComponent(SettingsPageComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, use };
}

describe('SettingsPageComponent', () => {
  it('renders a list with Password, Language and Notifications rows', () => {
    const { el } = setup();

    expect(el.querySelector('[role="list"]')).not.toBeNull();
    expect(el.querySelectorAll('[role="list"]')[0].querySelectorAll(':scope > [role="listitem"]').length).toBe(3);
  });

  it('links the Password row to /profile/settings/password', () => {
    const { el } = setup();

    const link = el.querySelector<HTMLAnchorElement>('a[role="listitem"]');
    expect(link?.getAttribute('href')).toBe('/profile/settings/password');
  });

  it('shows the current language name on the Language row', () => {
    const { el } = setup();

    expect(el.querySelector('.settings-page__value')?.textContent?.trim()).toBe('English');
  });

  it('expands the language list and switches language through LanguageService', () => {
    const { fixture, el, use } = setup();

    el.querySelector<HTMLButtonElement>('[data-lang-section] button')!.click();
    fixture.detectChanges();
    const options = el.querySelectorAll<HTMLButtonElement>('.settings-page__lang-option');
    expect(options.length).toBe(3);

    options[1].click();
    fixture.detectChanges();

    expect(use).toHaveBeenCalledWith('ru');
    expect(el.querySelector('.settings-page__lang-option')).toBeNull();
  });

  it('renders Notifications as an inactive, non-interactive row with a Coming soon badge and no chevron', () => {
    const { el } = setup();

    const inactive = el.querySelector<HTMLElement>('[aria-disabled="true"]')!;
    expect(inactive.tagName).toBe('DIV');
    expect(inactive.getAttribute('role')).toBe('listitem');
    expect(inactive.querySelector('button, a')).toBeNull();
    expect(inactive.querySelector('app-icon[name="chevron-right"]')).toBeNull();
    expect(inactive.querySelector('.settings-page__badge')).not.toBeNull();
  });

  it('renders the Password row inactive when the account is managed by Google', () => {
    const { el } = setup(user({ hasPassword: false }));

    expect(el.querySelectorAll('[aria-disabled="true"]').length).toBe(2);
    expect(el.querySelector('a[role="listitem"]')).toBeNull();
  });
});

describe('SettingsPageComponent — Delete account (AD-4)', () => {
  it('renders the Delete account row in its own card, below the first card', () => {
    const { el } = setup();

    const lists = el.querySelectorAll('[role="list"]');
    expect(lists.length).toBe(2);
    const row = lists[1].querySelector<HTMLButtonElement>('[data-testid="delete-account-row"]');
    expect(row?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(row?.textContent).toContain('profile.settings.deleteAccount');
  });

  it('hides the Delete account row for an admin', () => {
    const { el } = setup(user({ roles: ['Admin'] }));

    expect(el.querySelector('[data-testid="delete-account-row"]')).toBeNull();
    expect(el.querySelectorAll('[role="list"]').length).toBe(1);
  });

  it('opens the delete dialog from the row', () => {
    const { fixture, el } = setup();

    el.querySelector<HTMLButtonElement>('[data-testid="delete-account-row"]')!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['deleteDialogOpen']()).toBe(true);
  });
});

describe('profileRoutes', () => {
  const children = profileRoutes[0].children ?? [];

  it('redirects /profile/security to /profile/settings/password', () => {
    const route = children.find((r) => r.path === 'security');
    expect(route?.redirectTo).toBe('settings/password');
    expect(route?.pathMatch).toBe('full');
  });

  it('registers settings and settings/password as children of the profile shell', () => {
    expect(children.some((r) => r.path === 'settings')).toBe(true);
    expect(children.some((r) => r.path === 'settings/password')).toBe(true);
  });
});
