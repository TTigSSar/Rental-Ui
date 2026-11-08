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
    chatEmailsEnabled: true,
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

  it('renders the Password row as a button that opens the password sheet', () => {
    const { fixture, el } = setup();

    const row = el.querySelector<HTMLButtonElement>('[data-password-row]')!;
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    expect(row.querySelector('app-icon[name="chevron-right"]')).not.toBeNull();
    expect(el.ownerDocument.querySelector('app-settings-sheet')).toBeNull();

    row.click();
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('app-settings-sheet [role="dialog"]')).not.toBeNull();

    // The sheet is portalled to document.body, so query the document.
    el.ownerDocument.querySelector<HTMLElement>('app-settings-sheet .ns__close')!.click();
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('app-settings-sheet')).toBeNull();
  });

  it('shows the current language name on the Language row', () => {
    const { el } = setup();

    expect(el.querySelector('.settings-page__value')?.textContent?.trim()).toBe('English');
  });

  it('opens the language sheet, applies the tapped language through LanguageService and closes', () => {
    const { fixture, el, use } = setup();
    const doc = el.ownerDocument;

    const row = el.querySelector<HTMLButtonElement>('[data-language-row]')!;
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    row.click();
    fixture.detectChanges();
    const options = doc.querySelectorAll<HTMLButtonElement>('app-settings-sheet [role="option"]');
    expect(options.length).toBe(3);

    options[1].click();
    fixture.detectChanges();

    expect(use).toHaveBeenCalledWith('ru');
    expect(doc.querySelector('app-settings-sheet')).toBeNull();
  });

  it('renders Notifications as an active row with a chevron that opens the notifications sheet', () => {
    const { fixture, el } = setup();

    const row = el.querySelector<HTMLButtonElement>('[data-notifications-row]')!;
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    expect(row.querySelector('app-icon[name="chevron-right"]')).not.toBeNull();
    expect(row.querySelector('.settings-page__badge')).toBeNull();
    expect(el.ownerDocument.querySelector('app-settings-sheet')).toBeNull();

    row.click();
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('app-settings-sheet [role="dialog"]')).not.toBeNull();

    el.ownerDocument.querySelector<HTMLElement>('app-settings-sheet .ns__close')!.click();
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('app-settings-sheet')).toBeNull();
  });

  it('renders the Password row inactive when the account is managed by Google', () => {
    const { el } = setup(user({ hasPassword: false }));

    expect(el.querySelectorAll('[aria-disabled="true"]').length).toBe(1);
    expect(el.querySelector('[data-password-row]')).toBeNull();
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

  it('redirects /profile/security to /profile/settings', () => {
    const route = children.find((r) => r.path === 'security');
    expect(route?.redirectTo).toBe('settings');
    expect(route?.pathMatch).toBe('full');
  });

  it('redirects /profile/settings/password to /profile/settings (the form is a sheet now)', () => {
    const route = children.find((r) => r.path === 'settings/password');
    expect(route?.redirectTo).toBe('settings');
    expect(route?.pathMatch).toBe('full');
  });

  it('registers settings as a child of the profile shell', () => {
    expect(children.some((r) => r.path === 'settings' && r.loadComponent !== undefined)).toBe(true);
  });
});
