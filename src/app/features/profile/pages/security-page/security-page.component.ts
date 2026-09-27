import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { getApiErrorCode } from '../../../../api/api-error.model';
import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { maxByteLengthValidator, MAX_PASSWORD_BYTES } from '../../../../shared/validators/max-byte-length.validator';
import { passwordsMatchValidator } from '../../../../shared/validators/passwords-match.validator';
import { AuthApiService } from '../../../auth/services/auth-api.service';

type SecurityPhase = 'form' | 'submitting' | 'success';

type SecurityFormField = 'currentPassword' | 'newPassword' | 'confirmPassword';

/**
 * `/profile/security` — the change-password form (ADR-021). Component-local state, following
 * `features/reports/.../report-dialog`: a one-shot request/response with nothing to keep in
 * sync, so an NgRx slice would be pure ceremony. Deliberately NOT the `updatePreferredLanguage`
 * pattern (`auth.actions.ts`), which dispatches one action and swallows failures silently —
 * a password change must report its outcome to the user.
 *
 * Error mapping (see `ApiContract.auth.changePassword` / ADR-021 §3, amended 2026-09-27):
 *  - `auth.invalid_current_password` -> field error under Current password
 *  - `auth.password_unchanged`       -> field error under New password
 *  - `auth.password_too_long`        -> field error under New password (client-side
 *    `maxByteLengthValidator` on `newPassword` should catch this before it ever reaches the
 *    server, but the server is the authority and the code can still arrive)
 *  - `auth.password_not_set` / `auth.user_blocked` / 429 / anything else -> form-level banner
 *
 * Per ADR-021 §5, a successful change never signs the user out and the success copy never
 * implies other devices/sessions were affected — already-issued tokens cannot be revoked.
 */
@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [ButtonModule, MessageModule, PageHeaderComponent, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './security-page.component.html',
  styleUrl: './security-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly translate = inject(TranslateService);

  protected readonly phase = signal<SecurityPhase>('form');
  protected readonly isSubmitting = computed(() => this.phase() === 'submitting');

  /** Focus target for the success state (a11y) — moved there once it renders. */
  private readonly successHeading = viewChild<ElementRef<HTMLElement>>('successHeading');

  /** Translated key for a known form-level error; null while unset. */
  protected readonly bannerMessageKey = signal<string | null>(null);
  /** Raw (English) server message, used only when the error code isn't one we recognise. */
  protected readonly bannerMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(8), maxByteLengthValidator(MAX_PASSWORD_BYTES)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatchValidator('newPassword', 'confirmPassword')] },
  );

  constructor() {
    // Move focus into the success heading once it renders, so assistive tech lands
    // somewhere sensible instead of on `<body>` (the submit button that held focus is
    // removed from the DOM in the same change). `afterRenderEffect` runs on the render
    // AFTER the `@if` branch swap has painted the heading — same idiom as
    // `BookingRejectDialogComponent`'s focus restore (see that class's doc comment for
    // why a same-tick call can't reliably reach a node the current change-detection
    // pass hasn't rendered yet).
    afterRenderEffect(() => {
      if (this.phase() === 'success') {
        this.successHeading()?.nativeElement.focus();
      }
    });
  }

  protected hasError(controlName: SecurityFormField, errorKey: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorKey);
  }

  protected currentPasswordErrorKey(): string {
    if (this.hasError('currentPassword', 'required')) {
      return 'profile.security.validation.currentPasswordRequired';
    }
    if (this.hasError('currentPassword', 'serverInvalid')) {
      return 'profile.security.errors.invalidCurrentPassword';
    }
    return '';
  }

  protected newPasswordErrorKey(): string {
    if (this.hasError('newPassword', 'required')) {
      return 'profile.security.validation.newPasswordRequired';
    }
    if (this.hasError('newPassword', 'minlength')) {
      return 'profile.security.validation.newPasswordMinLength';
    }
    if (this.hasError('newPassword', 'maxByteLength')) {
      return 'profile.security.validation.newPasswordTooLong';
    }
    if (this.hasError('newPassword', 'serverUnchanged')) {
      return 'profile.security.errors.passwordUnchanged';
    }
    if (this.hasError('newPassword', 'serverTooLong')) {
      return 'profile.security.errors.passwordTooLong';
    }
    return '';
  }

  protected confirmPasswordErrorKey(): string {
    if (this.hasError('confirmPassword', 'required')) {
      return 'profile.security.validation.confirmPasswordRequired';
    }
    if (this.form.controls.confirmPassword.touched && this.form.hasError('passwordsMismatch')) {
      return 'profile.security.validation.passwordsMismatch';
    }
    return '';
  }

  protected submit(): void {
    if (this.isSubmitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.bannerMessageKey.set(null);
    this.bannerMessage.set(null);
    this.phase.set('submitting');

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.authApi.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => this.phase.set('success'),
      error: (error: unknown) => this.handleError(error),
    });
  }

  private handleError(error: unknown): void {
    const code = getApiErrorCode(error);

    if (code === 'auth.invalid_current_password') {
      const control = this.form.controls.currentPassword;
      control.setErrors({ ...(control.errors ?? {}), serverInvalid: true });
      control.markAsTouched();
      this.phase.set('form');
      return;
    }

    if (code === 'auth.password_unchanged') {
      const control = this.form.controls.newPassword;
      control.setErrors({ ...(control.errors ?? {}), serverUnchanged: true });
      control.markAsTouched();
      this.phase.set('form');
      return;
    }

    if (code === 'auth.password_too_long') {
      const control = this.form.controls.newPassword;
      control.setErrors({ ...(control.errors ?? {}), serverTooLong: true });
      control.markAsTouched();
      this.phase.set('form');
      return;
    }

    if (code === 'auth.password_not_set') {
      this.bannerMessageKey.set('profile.security.errors.passwordNotSet');
      this.phase.set('form');
      return;
    }

    if (code === 'auth.user_blocked') {
      this.bannerMessageKey.set('profile.security.errors.userBlocked');
      this.phase.set('form');
      return;
    }

    if (error instanceof HttpErrorResponse && error.status === 429) {
      this.bannerMessageKey.set('profile.security.errors.tooManyAttempts');
      this.phase.set('form');
      return;
    }

    this.bannerMessage.set(
      toApiErrorMessage(error, {
        unauthorizedMessage: this.translate.instant('profile.security.errors.sessionExpired'),
        serverErrorMessage: this.translate.instant('profile.security.errors.serverError'),
      }),
    );
    this.phase.set('form');
  }
}
