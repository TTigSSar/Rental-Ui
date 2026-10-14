import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { filter, pairwise } from 'rxjs';

import * as AuthActions from '../../store/auth.actions';
import { selectAuthLoading, selectIsAuthenticated } from '../../store/auth.selectors';
import { ForgotPasswordComponent } from '../forgot-password/forgot-password.component';
import { GoogleSignInBlockComponent } from '../google-sign-in-block/google-sign-in-block.component';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegisterFormComponent } from '../register-form/register-form.component';

/** `forgot` is the password-reset request flow (ADR-035): no tabs, no Google block. */
type AuthMode = 'login' | 'register' | 'forgot';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    DialogModule,
    ForgotPasswordComponent,
    GoogleSignInBlockComponent,
    LoginFormComponent,
    MessageModule,
    RegisterFormComponent,
    TranslatePipe,
  ],
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class AuthDialogComponent {
  @Output() readonly closed = new EventEmitter<void>();

  readonly visible = input.required<boolean>();
  readonly mode = input<AuthMode>('login');

  private readonly store = inject(Store);
  private readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);

  /** An /external request (or any other auth request) is in flight: tabs are disabled. */
  protected readonly isLoading = this.store.selectSignal(selectAuthLoading);

  protected readonly activeMode = signal<AuthMode>('login');

  /**
   * The Google block exists only while the dialog is open. `p-dialog` projects its
   * content eagerly, so without this the block (and its nonce request) would be created
   * at app start for every visitor. `blockEpoch` makes each opening a NEW block - fresh
   * nonce, fresh "unavailable" state (ADR-030: "until the dialog is reopened").
   */
  protected readonly blockMounted = signal(false);
  protected readonly blockEpoch = signal(0);

  /** Register tab only: false on the home-point step and the "check your email" state. */
  private readonly registerFirstStep = signal(true);
  protected readonly googleBlockVisible = computed(
    () => this.activeMode() === 'login' || (this.activeMode() === 'register' && this.registerFirstStep()),
  );
  /** Address carried into the Request step (Sign in email as typed; '' when opened by `/?forgot`). */
  protected readonly forgotEmail = signal('');

  /** 409 `auth.external_link_conflict`: show "an account with this email exists" above the form. */
  protected readonly linkConflictVisible = signal(false);
  /** Display-only prefill for the Sign in form; `seq` re-triggers it for a repeat conflict. */
  protected readonly loginPrefill = signal<{ email: string | null; seq: number } | null>(null);
  private prefillSeq = 0;

  constructor() {
    // Reset to requested mode and clear stale errors whenever the dialog opens.
    effect(() => {
      if (this.visible()) {
        this.activeMode.set(this.mode());
        this.linkConflictVisible.set(false);
        this.loginPrefill.set(null);
        this.forgotEmail.set('');
        this.blockEpoch.update((n) => n + 1);
        this.blockMounted.set(true);
        this.store.dispatch(AuthActions.clearAuthError());
      }
    });

    // Close automatically when the user authenticates while the dialog is open.
    toObservable(this.isAuthenticated)
      .pipe(
        pairwise(),
        filter(([prev, curr]) => !prev && curr),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.visible()) {
          this.closed.emit();
        }
      });
  }

  protected onRegisterFirstStep(first: boolean): void {
    this.registerFirstStep.set(first);
  }

  protected switchToRegister(): void {
    if (this.isLoading()) return;
    this.registerFirstStep.set(true);
    this.activeMode.set('register');
    this.linkConflictVisible.set(false);
    this.store.dispatch(AuthActions.clearAuthError());
  }

  protected switchToLogin(): void {
    if (this.isLoading()) return;
    this.activeMode.set('login');
    this.linkConflictVisible.set(false);
    this.store.dispatch(AuthActions.clearAuthError());
  }

  /** "Forgot password?" on the Sign in tab: the Request step, with the typed email copied over. */
  protected switchToForgot(email: string): void {
    if (this.isLoading()) return;
    this.forgotEmail.set(email);
    this.activeMode.set('forgot');
    this.linkConflictVisible.set(false);
    this.store.dispatch(AuthActions.clearAuthError());
  }

  /** "Back to Sign in": the Sign in tab again, carrying the address back. */
  protected onForgotBack(email: string): void {
    this.loginPrefill.set({ email, seq: ++this.prefillSeq });
    this.activeMode.set('login');
  }

  /** After the hide animation: tear the Google block down (unless reopened meanwhile). */
  protected onHidden(): void {
    if (!this.visible()) {
      this.blockMounted.set(false);
    }
  }

  /**
   * 409 `auth.external_link_conflict`: the email already belongs to a password account.
   * Switch to Sign in, prefill the email the Google credential carried (display only -
   * never sent as identity) and put focus on the password field.
   */
  protected onLinkConflict(email: string | null): void {
    this.activeMode.set('login');
    this.linkConflictVisible.set(true);
    this.loginPrefill.set({ email, seq: ++this.prefillSeq });
  }

  protected onGoogleAttempt(): void {
    this.linkConflictVisible.set(false);
  }
}
