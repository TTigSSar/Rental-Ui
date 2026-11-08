import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { getApiErrorCode } from '../../../../api/api-error.model';
import { ApiErrorMapper } from '../../../../api/api-error-mapper';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import {
  maxByteLengthValidator,
  MAX_PASSWORD_BYTES,
} from '../../../../shared/validators/max-byte-length.validator';
import { passwordsMatchValidator } from '../../../../shared/validators/passwords-match.validator';
import { AuthApiService } from '../../../auth/services/auth-api.service';
import * as AuthActions from '../../../auth/store/auth.actions';
import { SettingsSheetComponent } from '../settings-sheet/settings-sheet.component';

type PasswordPhase = 'form' | 'submitting';

type PasswordFormField = 'currentPassword' | 'newPassword' | 'confirmPassword';

const FIELD_ORDER: readonly PasswordFormField[] = [
  'currentPassword',
  'newPassword',
  'confirmPassword',
];

/**
 * Settings > Password sheet (ADR-021, amended 2026-11-08; was the `/profile/settings/password`
 * page). Component-local state, following `features/reports/.../report-dialog`: a one-shot
 * request/response with nothing to keep in sync, so an NgRx slice would be pure ceremony.
 * Deliberately NOT the `updatePreferredLanguage` pattern, which swallows failures — a password
 * change must report its outcome to the user.
 *
 * Error mapping (see `ApiContract.auth.changePassword` / ADR-021 §3, amended 2026-09-27):
 *  - `auth.invalid_current_password` -> field error under Current password
 *  - `auth.password_unchanged`       -> field error under New password
 *  - `auth.password_too_long`        -> field error under New password (the client-side
 *    `maxByteLengthValidator` should catch it first, but the server is the authority)
 *  - `auth.password_not_set` / `auth.user_blocked` / 429 / anything else -> banner above the
 *    first field. Typed values are always kept.
 *
 * ADR-055 (supersedes ADR-021 §5): a successful change revokes the old token server-side and
 * answers 200 `AuthResponse`. The new token goes through `sessionTokenRefreshed` first. There is
 * no success screen: the sheet closes (focus returns to the Password row) and a global toast
 * announces "Password updated".
 */
@Component({
  selector: 'app-password-sheet',
  standalone: true,
  imports: [ReactiveFormsModule, SettingsSheetComponent, TranslatePipe, UiInputComponent],
  templateUrl: './password-sheet.component.html',
  styleUrl: './password-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordSheetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly store = inject(Store);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();

  protected readonly phase = signal<PasswordPhase>('form');
  protected readonly isSubmitting = computed(() => this.phase() === 'submitting');

  /** Current, New, Confirm — in DOM order, used to focus the first invalid field. */
  private readonly inputs = viewChildren(UiInputComponent);

  /** Translated key for a known form-level error; null while unset. */
  protected readonly bannerMessageKey = signal<string | null>(null);
  /** Already-translated message for an error code we don't recognise (mapped by status). */
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

  protected hasError(controlName: PasswordFormField, errorKey: string): boolean {
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

  /** Cancel / Esc / backdrop / close button. Ignored while the request is in flight. */
  protected requestClose(): void {
    if (this.isSubmitting()) return;
    this.closed.emit();
  }

  /** Enter moves to the next field and submits from Confirm. */
  protected onEnter(event: Event, index: number): void {
    // Only the native input drives field navigation; Enter on the eye button must keep its click activation.
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    if (index < FIELD_ORDER.length - 1) {
      this.inputs()[index + 1]?.focusInput();
    } else {
      this.submit();
    }
  }

  protected submit(): void {
    if (this.isSubmitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.bannerMessageKey.set(null);
    this.bannerMessage.set(null);
    this.phase.set('submitting');

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.authApi.changePassword({ currentPassword, newPassword }).subscribe({
      next: ({ token }) => {
        // The old token is already revoked: store the new one before anything else.
        this.store.dispatch(AuthActions.sessionTokenRefreshed({ token }));
        this.messages.add({
          severity: 'success',
          summary: this.translate.instant('profile.security.toast.success'),
          life: 5000,
        });
        this.phase.set('form');
        this.closed.emit();
      },
      error: (error: unknown) => this.handleError(error),
    });
  }

  private focusFirstInvalid(): void {
    const index = FIELD_ORDER.findIndex((name) =>
      name === 'confirmPassword'
        ? this.confirmPasswordErrorKey() !== ''
        : this.form.controls[name].invalid,
    );
    this.inputs()[Math.max(index, 0)]?.focusInput();
  }

  private fieldError(field: PasswordFormField, errorKey: string): void {
    const control = this.form.controls[field];
    control.setErrors({ ...(control.errors ?? {}), [errorKey]: true });
    control.markAsTouched();
    this.phase.set('form');
    // Fields were read-only while saving; return the caret to the offending one.
    this.inputs()[FIELD_ORDER.indexOf(field)]?.focusInput();
  }

  private banner(key: string | null, message: string | null = null): void {
    this.bannerMessageKey.set(key);
    this.bannerMessage.set(message);
    this.phase.set('form');
  }

  private handleError(error: unknown): void {
    const code = getApiErrorCode(error);

    if (code === 'auth.invalid_current_password') {
      this.fieldError('currentPassword', 'serverInvalid');
    } else if (code === 'auth.password_unchanged') {
      this.fieldError('newPassword', 'serverUnchanged');
    } else if (code === 'auth.password_too_long') {
      this.fieldError('newPassword', 'serverTooLong');
    } else if (code === 'auth.password_not_set') {
      this.banner('profile.security.errors.passwordNotSet');
    } else if (code === 'auth.user_blocked') {
      this.banner('profile.security.errors.userBlocked');
    } else if (error instanceof HttpErrorResponse && error.status === 429) {
      this.banner('profile.security.errors.tooManyAttempts');
    } else {
      this.banner(null, this.apiErrors.message(error));
    }
  }
}
