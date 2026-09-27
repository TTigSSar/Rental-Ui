import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AuthApiService } from '../../../auth/services/auth-api.service';
import { SecurityPageComponent } from './security-page.component';

function setup(changePassword: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    imports: [SecurityPageComponent, TranslateModule.forRoot()],
    // `PageHeaderComponent`'s `backLink` renders a `routerLink`, which needs a router in the
    // injector even though this spec never navigates.
    providers: [provideRouter([]), { provide: AuthApiService, useValue: { changePassword } }],
  });
  const fixture: ComponentFixture<SecurityPageComponent> =
    TestBed.createComponent(SecurityPageComponent);
  fixture.detectChanges();
  return fixture;
}

function fillValidForm(component: SecurityPageComponent): void {
  component['form'].setValue({
    currentPassword: 'OldPass123',
    newPassword: 'NewPass456',
    confirmPassword: 'NewPass456',
  });
}

describe('SecurityPageComponent', () => {
  it('does not call the service when the form is invalid, and marks controls touched', () => {
    const changePassword = vi.fn();
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    component['submit']();

    expect(changePassword).not.toHaveBeenCalled();
    expect(component['form'].controls.currentPassword.touched).toBe(true);
    expect(component['form'].controls.newPassword.touched).toBe(true);
    expect(component['form'].controls.confirmPassword.touched).toBe(true);
  });

  it('does not call the service when the new password exceeds 72 UTF-8 bytes (Armenian text), and shows the too-long message', () => {
    const changePassword = vi.fn();
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    // 37 Armenian characters = 74 UTF-8 bytes, one past the 72-byte BCrypt cap — see
    // max-byte-length.validator.spec.ts for the same boundary case.
    const overLong = 'ա'.repeat(37);
    component['form'].setValue({
      currentPassword: 'OldPass123',
      newPassword: overLong,
      confirmPassword: overLong,
    });
    component['submit']();

    expect(changePassword).not.toHaveBeenCalled();
    expect(component['newPasswordErrorKey']()).toBe('profile.security.validation.newPasswordTooLong');
  });

  it('does not call the service when the two new-password fields do not match', () => {
    const changePassword = vi.fn();
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

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

  it('submits { currentPassword, newPassword } and shows the success phase on 204', () => {
    const changePassword = vi.fn().mockReturnValue(of(undefined));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass456',
    });
    expect(component['phase']()).toBe('success');
  });

  it('renders the current-password field error for auth.invalid_current_password', () => {
    const problem = new HttpErrorResponse({
      status: 400,
      error: { errorCode: 'auth.invalid_current_password', title: 'Wrong password' },
    });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['phase']()).toBe('form');
    expect(component['currentPasswordErrorKey']()).toBe(
      'profile.security.errors.invalidCurrentPassword',
    );
    expect(component['bannerMessageKey']()).toBeNull();
  });

  it('renders the new-password field error for auth.password_unchanged', () => {
    const problem = new HttpErrorResponse({
      status: 400,
      error: { errorCode: 'auth.password_unchanged', title: 'Same password' },
    });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['phase']()).toBe('form');
    expect(component['newPasswordErrorKey']()).toBe('profile.security.errors.passwordUnchanged');
    expect(component['bannerMessageKey']()).toBeNull();
  });

  // ADR-021's 2026-09-27 amendment: the client-side `maxByteLengthValidator` should catch an
  // over-long new password before any request goes out, but the server is the authority and
  // `auth.password_too_long` can still arrive — e.g. a legitimate current password that is
  // itself over 72 bytes doesn't trip anything client-side, only the new one does, or a race
  // with a server-side policy change. Mapped as a field-level error under New password,
  // exactly like `auth.password_unchanged` above.
  it('renders the new-password field error for auth.password_too_long', () => {
    const problem = new HttpErrorResponse({
      status: 400,
      error: { errorCode: 'auth.password_too_long', title: 'Password too long' },
    });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['phase']()).toBe('form');
    expect(component['newPasswordErrorKey']()).toBe('profile.security.errors.passwordTooLong');
    expect(component['bannerMessageKey']()).toBeNull();
  });

  it('renders a form-level banner for auth.password_not_set', () => {
    const problem = new HttpErrorResponse({
      status: 400,
      error: { errorCode: 'auth.password_not_set', title: 'External account' },
    });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['bannerMessageKey']()).toBe('profile.security.errors.passwordNotSet');
  });

  it('renders a form-level banner for auth.user_blocked', () => {
    const problem = new HttpErrorResponse({
      status: 403,
      error: { errorCode: 'auth.user_blocked', title: 'Blocked' },
    });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['bannerMessageKey']()).toBe('profile.security.errors.userBlocked');
  });

  it('renders a form-level banner for a 429 rate-limit response', () => {
    const problem = new HttpErrorResponse({ status: 429, error: {} });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['bannerMessageKey']()).toBe('profile.security.errors.tooManyAttempts');
  });

  it('falls back to the raw server message for an unrecognised error code', () => {
    const problem = new HttpErrorResponse({ status: 500, error: { title: 'Server exploded' } });
    const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
    const fixture = setup(changePassword);
    const component = fixture.componentInstance;

    fillValidForm(component);
    component['submit']();

    expect(component['bannerMessageKey']()).toBeNull();
    expect(component['bannerMessage']()).toBe('Server exploded');
  });

  // `toApiErrorMessage`'s `unauthorizedMessage`/`serverErrorMessage` options are a last
  // resort — they only kick in once the ProblemDetails body has nothing usable. These
  // three specs cover that fallback wiring (added alongside the a11y fix below; the
  // `unauthorizedMessage`/`serverErrorMessage` pass-through itself predates this change).
  describe('generic HTTP fallback messages (no recognised errorCode)', () => {
    it('renders the translated session-expired message for a bare 401 with no ProblemDetails body', () => {
      const problem = new HttpErrorResponse({ status: 401, error: null });
      const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
      const fixture = setup(changePassword);
      const component = fixture.componentInstance;

      fillValidForm(component);
      component['submit']();

      expect(component['phase']()).toBe('form');
      expect(component['bannerMessageKey']()).toBeNull();
      // No loader is configured for `TranslateModule.forRoot()` in this spec, so
      // `translate.instant()` resolves to the key itself — the same "translated, not the
      // default HttpErrorResponse message" assertion the other admin-store specs make via
      // their `{ instant: (k) => k }` double.
      expect(component['bannerMessage']()).toBe('profile.security.errors.sessionExpired');
      expect(component['bannerMessage']()).not.toContain('Http failure response');
    });

    it('renders the translated generic-error message for a 5xx response', () => {
      const problem = new HttpErrorResponse({ status: 503, error: null });
      const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
      const fixture = setup(changePassword);
      const component = fixture.componentInstance;

      fillValidForm(component);
      component['submit']();

      expect(component['bannerMessageKey']()).toBeNull();
      expect(component['bannerMessage']()).toBe('profile.security.errors.serverError');
      expect(component['bannerMessage']()).not.toContain('Http failure response');
    });

    it('still renders a ProblemDetails `title` for a 401 that carries one — the body wins over the unauthorizedMessage option (http-error-message.util.spec.ts:67-72)', () => {
      const problem = new HttpErrorResponse({
        status: 401,
        error: { title: 'Your session token is no longer valid' },
      });
      const changePassword = vi.fn().mockReturnValue(throwError(() => problem));
      const fixture = setup(changePassword);
      const component = fixture.componentInstance;

      fillValidForm(component);
      component['submit']();

      expect(component['bannerMessageKey']()).toBeNull();
      expect(component['bannerMessage']()).toBe('Your session token is no longer valid');
    });
  });

  describe('success state — focus and live-region announcement (a11y)', () => {
    it('moves focus to the success heading and announces success through a live region that was already mounted', async () => {
      const changePassword = vi.fn().mockReturnValue(of(undefined));
      const fixture = setup(changePassword);
      const component = fixture.componentInstance;

      // The live region must exist BEFORE the success text lands in it — a region
      // inserted already containing its text is not reliably announced. Captured here,
      // before submit(), so this spec would fail if a future change went back to
      // creating the region only inside the `@if (phase() === 'success')` branch.
      const liveRegion: HTMLElement | null = fixture.nativeElement.querySelector(
        '.security-page__visually-hidden',
      );
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.getAttribute('role')).toBe('status');
      expect(liveRegion?.textContent?.trim()).toBe('');

      fillValidForm(component);
      component['submit']();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['phase']()).toBe('success');
      // Same node reference as captured before the phase flip — proves the region was
      // mutated in place, not torn down and recreated with the text already inside it.
      expect(
        fixture.nativeElement.querySelector('.security-page__visually-hidden'),
      ).toBe(liveRegion);
      expect(liveRegion?.textContent?.trim()).toBe('profile.security.success.announcement');

      const heading: HTMLElement | null = fixture.nativeElement.querySelector(
        '.security-page__success-title',
      );
      expect(heading).not.toBeNull();
      expect(heading?.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(heading);
    });
  });
});
