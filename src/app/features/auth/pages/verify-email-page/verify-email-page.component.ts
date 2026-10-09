import { DOCUMENT, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { getApiErrorCode } from '../../../../api/api-error.model';
import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { AuthDialogComponent } from '../../components/auth-dialog/auth-dialog.component';
import { ResendVerificationComponent } from '../../components/resend-verification/resend-verification.component';
import { AuthApiService } from '../../services/auth-api.service';
import * as AuthActions from '../../store/auth.actions';

/** Where a verified user lands. Fixed on purpose: this page is reached from an
 *  emailed link, so it never honours a `returnUrl`/redirect parameter. */
export const POST_VERIFY_ROUTE = '/';

export type VerifyError =
  | 'wrongPassword'
  | 'expired'
  | 'invalid'
  | 'alreadyVerified'
  | 'blocked'
  | 'rateLimited'
  | 'generic';

/** `#token=<base64url>` -> the token, or null when absent/empty. */
export function readTokenFromFragment(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('token')?.trim() ?? '';
  return token === '' ? null : token;
}

/**
 * `/auth/verify-email#token=…` — the landing page of the confirmation email
 * (ADR-028 §3, §6).
 *
 * Token handling, all deliberate:
 *  - read once from the URL fragment, then the fragment is stripped from the
 *    address bar at once (`Location.replaceState`) so it does not linger in the
 *    visible URL or history;
 *  - held ONLY in this component's private field — never in NgRx, storage or logs
 *    (only the resulting JWT is dispatched, in `verifyEmailSuccess`);
 *  - NOTHING is posted on load: the user must type their password and click.
 *    That is what stops mail scanners / link previews from burning the token.
 *
 * The page is NOT behind `guestGuard`: someone else may be signed in on this browser.
 */
@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  imports: [
    AuthDialogComponent,
    ButtonModule,
    MessageModule,
    ReactiveFormsModule,
    ResendVerificationComponent,
    TranslatePipe,
    UiInputComponent,
  ],
  templateUrl: './verify-email-page.component.html',
  styleUrl: './verify-email-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VerifyEmailPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly authApi = inject(AuthApiService);

  /** The emailed link token. Component memory only. */
  private token: string | null = null;

  protected readonly hasToken = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<VerifyError | null>(null);
  /** Server-provided text for `blocked`, matching what the login form prints. */
  protected readonly serverMessage = signal('');
  protected readonly showLoginDialog = signal(false);

  protected readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required]],
  });

  protected readonly resendEmail = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.email,
  ]);
  private readonly resendEmailValue = toSignal(this.resendEmail.valueChanges, {
    initialValue: '',
  });
  /** Empty until the typed address looks valid, which keeps "Resend" disabled. */
  protected readonly resendTarget = computed(() => {
    // Read the value signal FIRST: an early return before it would leave the
    // computed with no dependency while the address is invalid.
    const value = this.resendEmailValue().trim();
    return this.resendEmail.valid ? value : '';
  });

  /** The password form is offered while a usable token is held (terminal errors
   *  drop it via `dropToken`; wrong password / 429 / network errors keep it). */
  protected readonly showPasswordForm = computed(() => this.hasToken());

  /** No usable link (missing, expired or invalid): offer a fresh one. Not for an
   *  already-verified or blocked account, where a new email would not help. */
  protected readonly showResend = computed(
    () => !this.hasToken() && this.error() !== 'alreadyVerified' && this.error() !== 'blocked',
  );

  constructor() {
    this.token = readTokenFromFragment(this.document.location?.hash ?? '');
    this.hasToken.set(this.token !== null);
    // Strip the fragment immediately so the token is not left in the address bar
    // or history. `path()` has no hash by default; query is not used by this page.
    this.location.replaceState(this.location.path());
    // The Router's own state (router.url / UrlTree) still holds the fragment until
    // the next navigation: replace it with the fragment-less URL. Same route, so the
    // component is reused (no re-init, no POST).
    if (this.router.url.includes('#')) {
      void this.router.navigate([], {
        relativeTo: this.route,
        fragment: undefined,
        replaceUrl: true,
        queryParamsHandling: 'preserve',
      });
    }
  }

  protected submit(): void {
    if (this.submitting() || this.token === null) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.authApi
      .verifyEmail({ token: this.token, password: this.passwordForm.controls.password.value })
      .subscribe({
        next: ({ token: jwt }) => {
          this.submitting.set(false);
          this.token = null;
          this.hasToken.set(false);
          this.passwordForm.reset();
          this.store.dispatch(AuthActions.verifyEmailSuccess({ token: jwt }));
          void this.router.navigateByUrl(POST_VERIFY_ROUTE);
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  protected openLogin(): void {
    this.showLoginDialog.set(true);
  }

  protected hasPasswordError(): boolean {
    const control = this.passwordForm.controls.password;
    return control.touched && control.hasError('required');
  }

  private handleError(error: unknown): void {
    this.submitting.set(false);
    const code = getApiErrorCode(error);
    const status = error instanceof HttpErrorResponse ? error.status : 0;

    if (code === 'auth.invalid_credentials') {
      // Wrong password: the token is NOT consumed server-side — keep it and let
      // the user retry.
      this.passwordForm.reset();
      this.error.set('wrongPassword');
      return;
    }

    if (code === 'auth.email_already_verified') {
      this.dropToken();
      this.error.set('alreadyVerified');
      this.showLoginDialog.set(true);
      return;
    }

    if (code === 'auth.verification_token_expired') {
      this.dropToken();
      this.error.set('expired');
      return;
    }

    if (code === 'auth.verification_token_invalid') {
      this.dropToken();
      this.error.set('invalid');
      return;
    }

    if (code === 'auth.user_blocked') {
      this.dropToken();
      this.serverMessage.set(toApiErrorMessage(error));
      this.error.set('blocked');
      return;
    }

    if (status === 429) {
      this.error.set('rateLimited');
      return;
    }

    this.error.set('generic');
  }

  private dropToken(): void {
    this.token = null;
    this.hasToken.set(false);
    this.passwordForm.reset();
  }
}
