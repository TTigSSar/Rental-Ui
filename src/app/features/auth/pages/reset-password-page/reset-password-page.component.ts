import { DOCUMENT, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { MessageModule } from 'primeng/message';

import { getApiErrorCode } from '../../../../api/api-error.model';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import {
  MAX_PASSWORD_BYTES,
  maxByteLengthValidator,
} from '../../../../shared/validators/max-byte-length.validator';
import { passwordsMatchValidator } from '../../../../shared/validators/passwords-match.validator';
import { AuthApiService } from '../../services/auth-api.service';
import * as AuthActions from '../../store/auth.actions';
import { readTokenFromFragment } from '../verify-email-page/verify-email-page.component';

/** Where a user lands after setting a password. Fixed on purpose, like the verify page:
 *  the page is reached from an emailed link, so it never honours a returnUrl. */
export const POST_RESET_ROUTE = '/';

export type ResetPhase = 'checking' | 'form' | 'expired' | 'invalid' | 'checkFailed';
type SaveError = 'fail' | 'rate';

/**
 * `/auth/reset-password#token=...` - the landing page of the reset email (ADR-035).
 *
 * Token handling mirrors the verify-email page (ADR-028 section 6): read once from the URL
 * fragment, the fragment is stripped from the address bar at once, and the token lives ONLY in
 * this component's private field - never in NgRx, storage or logs (only the resulting JWT is
 * dispatched). Unlike verify-email, the page checks the link on load
 * (`POST /api/auth/reset-password/check`, read-only) so a dead link is reported before the
 * user types a password.
 *
 * The page is NOT behind `guestGuard`: someone may already be signed in here. On success the
 * returned `AuthResponse` replaces the current session exactly as login does. State is
 * component-local (a one-shot request/response), like `/profile/security`.
 *
 * Deliberately says nothing about other devices: issued JWTs are not revoked (ADR-035 section 3).
 */
@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [MessageModule, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ResetPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly authApi = inject(AuthApiService);
  private readonly messages = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly injector = inject(Injector);

  private readonly newPasswordInput = viewChild<UiInputComponent>('newPasswordInput');

  /** The emailed link token. Component memory only. */
  private token: string | null = null;

  protected readonly phase = signal<ResetPhase>('checking');
  protected readonly submitting = signal(false);
  protected readonly saveError = signal<SaveError | null>(null);
  /** True after the first submit attempt: an empty Confirm then reads as "don't match". */
  protected readonly submitted = signal(false);

  protected readonly isDead = computed(() => this.phase() === 'expired' || this.phase() === 'invalid');

  protected readonly form = this.fb.nonNullable.group(
    {
      newPassword: [
        '',
        [Validators.required, Validators.minLength(8), maxByteLengthValidator(MAX_PASSWORD_BYTES)],
      ],
      confirmPassword: [''],
    },
    { validators: [passwordsMatchValidator('newPassword', 'confirmPassword')] },
  );

  constructor() {
    this.token = readTokenFromFragment(this.document.location?.hash ?? '');
    // Strip the fragment immediately so the token is not left in the address bar or history.
    this.location.replaceState(this.location.path());
    // The Router's own state still holds the fragment until the next navigation: replace it
    // with the fragment-less URL. Same route, so the component is reused (no re-init).
    if (this.router.url.includes('#')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        fragment: undefined,
        replaceUrl: true,
        queryParamsHandling: 'preserve',
      });
    }
    this.checkLink();
  }

  /** On load, and the retry after a 429 / network failure of the check itself. */
  protected checkLink(): void {
    if (this.token === null) {
      // No fragment (typed URL, reload after the strip): same state as a malformed link.
      this.phase.set('invalid');
      return;
    }
    this.phase.set('checking');
    this.authApi.resetPasswordCheck({ token: this.token }).subscribe({
      next: () => {
        this.phase.set('form');
        afterNextRender(() => this.newPasswordInput()?.focusInput(), { injector: this.injector });
      },
      error: (error: unknown) => {
        const code = getApiErrorCode(error);
        if (code === 'auth.reset_token_expired') {
          this.dropToken('expired');
        } else if (code === 'auth.reset_token_invalid') {
          this.dropToken('invalid');
        } else {
          // 429 / network / 5xx: the link may still be fine - keep the token, offer a retry.
          this.phase.set('checkFailed');
        }
      },
    });
  }

  protected submit(): void {
    if (this.submitting() || this.token === null) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.controls.confirmPassword.value === '') {
      return;
    }

    this.submitting.set(true);
    this.saveError.set(null);

    this.authApi
      .resetPassword({ token: this.token, newPassword: this.form.controls.newPassword.value })
      .subscribe({
        next: ({ token: jwt }) => {
          this.submitting.set(false);
          this.token = null;
          this.form.reset();
          // Same store path as verify-email: persists the JWT, loads the user, and (unlike
          // `loginSuccess`) leaves navigation to this page so no stale returnUrl can fire.
          this.store.dispatch(AuthActions.verifyEmailSuccess({ token: jwt }));
          this.messages.add({
            severity: 'success',
            summary: this.translate.instant('auth.reset.ok'),
            life: 5000,
          });
          void this.router.navigateByUrl(POST_RESET_ROUTE);
        },
        error: (error: unknown) => this.handleSaveError(error),
      });
  }

  protected newPasswordErrorKey(): string | null {
    const control = this.form.controls.newPassword;
    // Too long is reported while typing (no maxlength: a paste must never be cut).
    if (control.hasError('maxByteLength') || control.hasError('serverTooLong')) {
      return 'auth.validation.passwordTooLong';
    }
    if (control.touched && (control.hasError('required') || control.hasError('minlength'))) {
      return 'auth.reset.eShort';
    }
    return null;
  }

  protected confirmPasswordErrorKey(): string | null {
    const confirm = this.form.controls.confirmPassword;
    if (!confirm.touched) return null;
    if (this.form.hasError('passwordsMismatch')) return 'auth.reset.eMatch';
    if (this.submitted() && confirm.value === '') return 'auth.reset.eMatch';
    return null;
  }

  private handleSaveError(error: unknown): void {
    this.submitting.set(false);
    const code = getApiErrorCode(error);

    if (code === 'auth.reset_token_expired') {
      this.dropToken('expired');
      return;
    }
    if (code === 'auth.reset_token_invalid') {
      this.dropToken('invalid');
      return;
    }
    if (code === 'auth.password_too_long') {
      const control = this.form.controls.newPassword;
      control.setErrors({ ...(control.errors ?? {}), serverTooLong: true });
      control.markAsTouched();
      return;
    }
    this.saveError.set(error instanceof HttpErrorResponse && error.status === 429 ? 'rate' : 'fail');
  }

  protected requestNewLink(): void {
    void this.router.navigate(['/'], { queryParams: { forgot: '' } });
  }

  private dropToken(phase: 'expired' | 'invalid'): void {
    this.token = null;
    this.form.reset();
    this.saveError.set(null);
    this.phase.set(phase);
  }
}
