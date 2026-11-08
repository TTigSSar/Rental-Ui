import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';

import * as AuthActions from '../../../auth/store/auth.actions';
import { AuthApiService } from '../../../auth/services/auth-api.service';
import { PasswordSheetComponent } from './password-sheet.component';

const messages = { add: vi.fn() };

function setup(changePassword: ReturnType<typeof vi.fn>) {
  messages.add.mockClear();
  TestBed.configureTestingModule({
    imports: [PasswordSheetComponent, TranslateModule.forRoot()],
    providers: [
      provideMockStore(),
      { provide: MessageService, useValue: messages },
      { provide: AuthApiService, useValue: { changePassword } },
    ],
  });
  const fixture: ComponentFixture<PasswordSheetComponent> =
    TestBed.createComponent(PasswordSheetComponent);
  fixture.detectChanges();
  return fixture;
}

const authResponse = { token: 'new-jwt', user: {} };

function fillValidForm(component: PasswordSheetComponent): void {
  component['form'].setValue({
    currentPassword: 'OldPass123',
    newPassword: 'NewPass456',
    confirmPassword: 'NewPass456',
  });
}

function failing(status: number, error: unknown) {
  return vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status, error })));
}

/** Submits a valid form against a service that fails with `status` / `error`. */
function submitFailing(status: number, error: unknown) {
  const fixture = setup(failing(status, error));
  const component = fixture.componentInstance;
  fillValidForm(component);
  component['submit']();
  return component;
}

describe('PasswordSheetComponent', () => {
  it('does not call the service when the form is invalid, and marks controls touched', () => {
    const changePassword = vi.fn();
    const component = setup(changePassword).componentInstance;

    component['submit']();

    expect(changePassword).not.toHaveBeenCalled();
    expect(component['form'].controls.currentPassword.touched).toBe(true);
    expect(component['form'].controls.newPassword.touched).toBe(true);
    expect(component['form'].controls.confirmPassword.touched).toBe(true);
  });

  it('does not call the service when the new password exceeds 72 UTF-8 bytes (Armenian text)', () => {
    const changePassword = vi.fn();
    const component = setup(changePassword).componentInstance;

    // 37 Armenian characters = 74 UTF-8 bytes, one past the 72-byte BCrypt cap.
    const overLong = 'ա'.repeat(37);
    component['form'].setValue({
      currentPassword: 'OldPass123',
      newPassword: overLong,
      confirmPassword: overLong,
    });
    component['submit']();

    expect(changePassword).not.toHaveBeenCalled();
    expect(component['newPasswordErrorKey']()).toBe(
      'profile.security.validation.newPasswordTooLong',
    );
  });

  it('does not call the service when the two new-password fields do not match', () => {
    const changePassword = vi.fn();
    const component = setup(changePassword).componentInstance;

    component['form'].setValue({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
      confirmPassword: 'Different789',
    });
    component['submit']();

    expect(changePassword).not.toHaveBeenCalled();
    expect(component['confirmPasswordErrorKey']()).toBe(
      'profile.security.validation.passwordsMismatch',
    );
  });

  it('submits { currentPassword, newPassword } and stores the returned token first (ADR-055)', () => {
    const changePassword = vi.fn().mockReturnValue(of(authResponse));
    const component = setup(changePassword).componentInstance;
    const dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');

    fillValidForm(component);
    component['submit']();

    expect(dispatch).toHaveBeenCalledWith(AuthActions.sessionTokenRefreshed({ token: 'new-jwt' }));
    // Same user id: a session replacement / logout must never be dispatched.
    expect(dispatch).not.toHaveBeenCalledWith(AuthActions.sessionReplaced());
    expect(dispatch).not.toHaveBeenCalledWith(AuthActions.logout());
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
    });
  });

  it('closes the sheet and raises a success toast (no success screen) once the change succeeds', () => {
    const fixture = setup(vi.fn().mockReturnValue(of(authResponse)));
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    fillValidForm(fixture.componentInstance);
    fixture.componentInstance['submit']();

    expect(closed).toHaveBeenCalledTimes(1);
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'profile.security.toast.success' }),
    );
  });

  it('maps auth.invalid_current_password to the Current password field', () => {
    const component = submitFailing(400, { errorCode: 'auth.invalid_current_password' });

    expect(component['phase']()).toBe('form');
    expect(component['currentPasswordErrorKey']()).toBe(
      'profile.security.errors.invalidCurrentPassword',
    );
    expect(component['bannerMessageKey']()).toBeNull();
  });

  it('maps auth.password_unchanged to the New password field', () => {
    const component = submitFailing(400, { errorCode: 'auth.password_unchanged' });

    expect(component['newPasswordErrorKey']()).toBe('profile.security.errors.passwordUnchanged');
    expect(component['bannerMessageKey']()).toBeNull();
  });

  it('maps auth.password_too_long to the New password field', () => {
    const component = submitFailing(400, { errorCode: 'auth.password_too_long' });

    expect(component['newPasswordErrorKey']()).toBe('profile.security.errors.passwordTooLong');
    expect(component['bannerMessageKey']()).toBeNull();
  });

  it('shows a banner for auth.password_not_set', () => {
    const component = submitFailing(400, { errorCode: 'auth.password_not_set' });

    expect(component['bannerMessageKey']()).toBe('profile.security.errors.passwordNotSet');
  });

  it('shows a banner for auth.user_blocked', () => {
    const component = submitFailing(403, { errorCode: 'auth.user_blocked' });

    expect(component['bannerMessageKey']()).toBe('profile.security.errors.userBlocked');
  });

  it('shows a banner for a 429 rate-limit response', () => {
    const component = submitFailing(429, {});

    expect(component['bannerMessageKey']()).toBe('profile.security.errors.tooManyAttempts');
  });

  it('never shows the raw server message for an unrecognised error code', () => {
    const component = submitFailing(500, { title: 'Server exploded' });

    expect(component['bannerMessageKey']()).toBeNull();
    expect(component['bannerMessage']()).toBe('errors.server');
  });

  it('resolves a bare 401 through the shared mapper (ADR-045)', () => {
    const component = submitFailing(401, null);

    expect(component['bannerMessage']()).toBe('errors.sessionExpired');
  });

  describe('sheet behaviour', () => {
    const sheetEl = () => document.body.querySelector('app-settings-sheet') as HTMLElement;

    it('is a modal dialog titled Password with Current password focused on open', async () => {
      const fixture = setup(vi.fn());
      await fixture.whenStable();

      const dialog = sheetEl().querySelector('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(sheetEl().querySelector('#ns-title')?.textContent).toContain(
        'profile.settings.password',
      );
      const first = sheetEl().querySelector<HTMLInputElement>('.ps__current input')!;
      expect(document.activeElement).toBe(first);
      expect(first.getAttribute('autocomplete')).toBe('current-password');
    });

    it('pins a Cancel + Save footer; Cancel closes', () => {
      const fixture = setup(vi.fn());
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);

      expect(sheetEl().querySelector('.ps__foot .ps__btn--save')).not.toBeNull();
      sheetEl().querySelector<HTMLButtonElement>('.ps__foot .ps__btn--cancel')!.click();

      expect(closed).toHaveBeenCalledTimes(1);
    });

    it('while submitting: fields read-only, Cancel disabled, Save busy and named, close ignored', () => {
      const pending = vi.fn().mockReturnValue(new Observable(() => undefined));
      const fixture = setup(pending);
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);

      fillValidForm(fixture.componentInstance);
      fixture.componentInstance['submit']();
      fixture.detectChanges();

      expect(sheetEl().querySelectorAll('.ps__form input[readonly]').length).toBe(3);
      expect(sheetEl().querySelector<HTMLButtonElement>('.ps__btn--cancel')!.disabled).toBe(true);
      const save = sheetEl().querySelector('.ps__btn--save')!;
      expect(save.getAttribute('aria-busy')).toBe('true');
      expect(save.getAttribute('aria-label')).toBe('profile.security.form.saving');
      sheetEl().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closed).not.toHaveBeenCalled();
      // A second submit while in flight is ignored.
      fixture.componentInstance['submit']();
      expect(pending).toHaveBeenCalledTimes(1);
    });

    it('while submitting: a swipe-down past the threshold does not close the sheet', () => {
      const pending = vi.fn().mockReturnValue(new Observable(() => undefined));
      const fixture = setup(pending);
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);
      Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
      fillValidForm(fixture.componentInstance);
      fixture.componentInstance['submit']();
      fixture.detectChanges();

      const zone = sheetEl().querySelector<HTMLElement>('.ns__handle-zone')!;
      const ptr = (type: string, y: number, t: number) => {
        const e = new Event(type, { bubbles: true });
        Object.defineProperties(e, {
          pointerId: { value: 1 },
          pointerType: { value: 'touch' },
          button: { value: 0 },
          clientY: { value: y },
          timeStamp: { value: t },
        });
        return e;
      };
      zone.dispatchEvent(ptr('pointerdown', 0, 0));
      zone.dispatchEvent(ptr('pointermove', 300, 200));
      zone.dispatchEvent(ptr('pointerup', 300, 400));
      fixture.detectChanges();

      expect(closed).not.toHaveBeenCalled();
      expect(sheetEl().querySelector<HTMLElement>('.ns')!.style.transform).toBe('');
    });

    it('keeps typed values and shows the banner (role=alert) above the fields on a server error', () => {
      const fixture = setup(failing(429, {}));

      fillValidForm(fixture.componentInstance);
      fixture.componentInstance['submit']();
      fixture.detectChanges();

      const banner = sheetEl().querySelector('.ps__banner')!;
      expect(banner.getAttribute('role')).toBe('alert');
      expect(banner.textContent).toContain('profile.security.errors.tooManyAttempts');
      expect(fixture.componentInstance['form'].getRawValue().currentPassword).toBe('OldPass123');
    });

    const enter = () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    it('Enter on a show/hide eye button is not hijacked: not cancelled, no focus move, no submit', () => {
      const changePassword = vi.fn().mockReturnValue(of(authResponse));
      const fixture = setup(changePassword);
      fillValidForm(fixture.componentInstance);
      const input = sheetEl().querySelector<HTMLInputElement>('.ps__current input')!;
      const eye = sheetEl().querySelector<HTMLButtonElement>('.ps__current button[aria-pressed]')!;
      eye.focus();

      const event = enter();
      eye.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(eye);
      expect(changePassword).not.toHaveBeenCalled();
      // Native activation (Enter on a focused button) is a click, which toggles visibility.
      eye.click();
      fixture.detectChanges();
      expect(input.type).toBe('text');
      expect(eye.getAttribute('aria-pressed')).toBe('true');
    });

    it('Enter in a field still moves to the next field, and from Confirm submits', () => {
      const changePassword = vi.fn().mockReturnValue(of(authResponse));
      const fixture = setup(changePassword);
      fillValidForm(fixture.componentInstance);
      const inputs = sheetEl().querySelectorAll<HTMLInputElement>('.ps__form input');

      const first = enter();
      inputs[0].dispatchEvent(first);
      expect(first.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(inputs[1]);
      expect(changePassword).not.toHaveBeenCalled();

      inputs[2].dispatchEvent(enter());
      expect(changePassword).toHaveBeenCalledTimes(1);
    });

    it('shows every client error at once and focuses the first invalid field on Save', () => {
      const fixture = setup(vi.fn());

      sheetEl().querySelector<HTMLButtonElement>('.ps__btn--save')!.click();
      fixture.detectChanges();

      expect(sheetEl().querySelectorAll('.uii-helper--error').length).toBe(3);
      expect(document.activeElement).toBe(sheetEl().querySelector('.ps__current input'));
    });
  });
});
