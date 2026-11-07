import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store, provideStore } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';

import { makeUser } from '../../../../../testing/fixtures';
import * as AuthActions from '../../../auth/store/auth.actions';
import { authFeatureKey, authReducer } from '../../../auth/store/auth.reducer';
import {
  BrowserNotificationService,
  type BrowserNotificationPermission,
} from '../../../notifications/services/browser-notification.service';
import { NotificationsSheetComponent } from './notifications-sheet.component';

function setup(permission: BrowserNotificationPermission = 'default', enabled = true) {
  const permissionSignal = signal<BrowserNotificationPermission>(permission);
  const browser = {
    permission: permissionSignal.asReadonly(),
    refresh: vi.fn(),
    requestPermission: vi.fn().mockResolvedValue('granted'),
  };
  TestBed.configureTestingModule({
    imports: [NotificationsSheetComponent, TranslateModule.forRoot()],
    providers: [
      provideStore({ [authFeatureKey]: authReducer }),
      { provide: BrowserNotificationService, useValue: browser },
    ],
  });
  const store = TestBed.inject(Store);
  store.dispatch(
    AuthActions.loadCurrentUserSuccess({ user: makeUser({ chatEmailsEnabled: enabled }) }),
  );
  const dispatch = vi.spyOn(store, 'dispatch');
  const fixture: ComponentFixture<NotificationsSheetComponent> =
    TestBed.createComponent(NotificationsSheetComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, store, dispatch, browser, permissionSignal };
}

const switchOf = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('[role="switch"]')!;

describe('NotificationsSheetComponent', () => {
  describe('Row A — chat emails switch', () => {
    it('is a labelled switch that reflects chatEmailsEnabled', () => {
      const { el } = setup('default', true);

      const sw = switchOf(el);
      expect(sw.getAttribute('aria-checked')).toBe('true');
      expect(sw.getAttribute('aria-labelledby')).toBe('ns-email-label');
      expect(el.querySelector('#ns-email-label')?.textContent).toContain(
        'profile.settings.chatEmails.label',
      );
    });

    it('reflects an off account', () => {
      const { el } = setup('default', false);

      expect(switchOf(el).getAttribute('aria-checked')).toBe('false');
    });

    it('saves immediately and flips optimistically on click', () => {
      const { fixture, el, dispatch } = setup('default', true);

      switchOf(el).click();
      fixture.detectChanges();

      expect(dispatch).toHaveBeenCalledWith(AuthActions.updateChatEmails({ enabled: false }));
      expect(switchOf(el).getAttribute('aria-checked')).toBe('false');
      expect(el.querySelector('[role="status"].ns__feedback')).toBeNull();
    });

    it('shows "Saved" as a status once the save succeeds', () => {
      const { fixture, el, store } = setup('default', true);

      switchOf(el).click();
      store.dispatch(AuthActions.updateChatEmailsSuccess({ enabled: false }));
      fixture.detectChanges();

      const saved = el.querySelector('.ns__feedback--ok');
      expect(saved?.getAttribute('role')).toBe('status');
      expect(saved?.textContent).toContain('profile.settings.chatEmails.saved');
      expect(switchOf(el).getAttribute('aria-checked')).toBe('false');
    });

    it('reverts the switch and shows an alert when the save fails', () => {
      const { fixture, el, store } = setup('default', true);

      switchOf(el).click();
      store.dispatch(AuthActions.updateChatEmailsFailure({ revertTo: true }));
      fixture.detectChanges();

      expect(switchOf(el).getAttribute('aria-checked')).toBe('true');
      const failed = el.querySelector('.ns__feedback--error');
      expect(failed?.getAttribute('role')).toBe('alert');
      expect(failed?.textContent).toContain('profile.settings.chatEmails.failed');
    });

    it('has no Save button', () => {
      const { el } = setup();

      const labels = Array.from(el.querySelectorAll('button')).map((b) => b.className);
      expect(labels.every((c) => !c.includes('save'))).toBe(true);
    });
  });

  describe('Row B — browser notifications', () => {
    it('default: shows the Enable button, which requests permission', () => {
      const { el, browser } = setup('default');

      const btn = el.querySelector<HTMLButtonElement>('.ns__btn')!;
      expect(btn.textContent).toContain('profile.settings.browser.enable');
      btn.click();

      expect(browser.requestPermission).toHaveBeenCalledTimes(1);
      expect(el.querySelector('.ns__pill')).toBeNull();
    });

    it('granted: shows the green On pill and the browser-settings line, no button', () => {
      const { el } = setup('granted');

      expect(el.querySelector('.ns__pill')?.textContent).toContain('profile.settings.browser.on');
      expect(el.querySelector('.ns__offhint')?.textContent).toContain(
        'profile.settings.browser.offHint',
      );
      expect(el.querySelector('.ns__btn')).toBeNull();
      expect(el.querySelectorAll('[role="switch"]').length).toBe(1);
    });

    it('denied: shows the re-enable note and no button', () => {
      const { el } = setup('denied');

      expect(el.querySelector('.ns__note')?.textContent).toContain(
        'profile.settings.browser.blocked',
      );
      expect(el.querySelector('.ns__btn')).toBeNull();
      expect(el.querySelector('.ns__pill')).toBeNull();
    });

    it('unsupported: shows a muted row with the not-supported text only', () => {
      const { el } = setup('unsupported');

      const muted = el.querySelector('.ns__row--muted')!;
      expect(muted.textContent).toContain('profile.settings.browser.unsupported');
      expect(muted.querySelector('button')).toBeNull();
    });

    it('moves to the On state when the permission becomes granted', () => {
      const { fixture, el, permissionSignal } = setup('default');

      permissionSignal.set('granted');
      fixture.detectChanges();

      expect(el.querySelector('.ns__pill')).not.toBeNull();
    });
  });

  describe('container', () => {
    it('is a modal dialog labelled by its title and closes on Escape and backdrop click', () => {
      const { fixture, el } = setup();
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);

      const dialog = el.querySelector('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('ns-title');

      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      el.querySelector<HTMLElement>('.ns__backdrop')!.click();

      expect(closed).toHaveBeenCalledTimes(2);
    });

    it('re-reads the browser permission when opened', () => {
      const { browser } = setup();

      expect(browser.refresh).toHaveBeenCalled();
    });
  });
});
