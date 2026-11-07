import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';

import { authFeatureKey, authReducer } from '../../../auth/store/auth.reducer';
import { LanguageService } from '../../../../shared/services/language.service';
import { profileRoutes } from '../../routes';
import { SettingsPageComponent } from './settings-page.component';

const LANGUAGES = [
  { code: 'en', flag: '', native: 'English', label: 'English' },
  { code: 'ru', flag: '', native: 'Русский', label: 'Russian' },
  { code: 'hy', flag: '', native: 'Հայերեն', label: 'Armenian' },
];

function setup() {
  const use = vi.fn();
  TestBed.configureTestingModule({
    imports: [SettingsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideStore({ [authFeatureKey]: authReducer }),
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
    expect(el.querySelectorAll('[role="list"] > [role="listitem"]').length).toBe(3);
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

  it('renders Notifications as an active row with a chevron that opens the notifications sheet', () => {
    const { fixture, el } = setup();

    const row = el.querySelector<HTMLButtonElement>('[data-notifications-row]')!;
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('aria-haspopup')).toBe('dialog');
    expect(row.querySelector('app-icon[name="chevron-right"]')).not.toBeNull();
    expect(row.querySelector('.settings-page__badge')).toBeNull();
    expect(el.querySelector('app-notifications-sheet')).toBeNull();

    row.click();
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('app-notifications-sheet [role="dialog"]')).not.toBeNull();

    // The sheet is portalled to document.body, so query the document.
    el.ownerDocument.querySelector<HTMLElement>('app-notifications-sheet .ns__close')!.click();
    fixture.detectChanges();
    expect(el.ownerDocument.querySelector('app-notifications-sheet')).toBeNull();
  });

  it('renders the Password row inactive when the account is managed by Google', () => {
    const { fixture, el } = setup();

    fixture.componentInstance['passwordManagedByGoogle'].set(true);
    fixture.detectChanges();

    expect(el.querySelectorAll('[aria-disabled="true"]').length).toBe(1);
    expect(el.querySelector('a[role="listitem"]')).toBeNull();
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
