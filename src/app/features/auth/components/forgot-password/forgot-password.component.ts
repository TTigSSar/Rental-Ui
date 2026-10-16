import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';

import { getApiErrorCode } from '../../../../api/api-error.model';
import { LanguageService } from '../../../../shared/services/language.service';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { AuthApiService } from '../../services/auth-api.service';
import { ExternalAuthConfigService } from '../../services/external-auth-config.service';
import { DEFAULT_COOLDOWN_SECONDS } from '../../services/retry-after';

type ForgotStep = 'request' | 'check' | 'unavailable';
type ForgotNotice = 'fail' | 'rate';
type ForgotFieldError = 'empty' | 'invalid';
type SendOrigin = 'request' | 'again';

const EMAIL_HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * The "Forgot password?" flow inside the auth dialog (ADR-035): Request -> Check your email,
 * with the "temporarily unavailable" state (ADR-035 section 10, 503) replacing Check.
 *
 * Component-local state, not NgRx: a transient request/cooldown with no second consumer
 * (same call as `ResendVerificationComponent`, ADR-021 frontend precedent). Nothing here says
 * whether the address has an account - the 202 is identical for every address (ADR-035 section 6).
 *
 * The 60 s "send again" countdown is purely client-side (the server cooldown is measured
 * from the last token and silently answers 202), so it is a plain-text row, not a disabled
 * button, and is announced to assistive tech only when it reaches 0.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [MessageModule, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ForgotPasswordComponent implements OnInit {
  /** The Sign in email as typed (even if invalid), or '' for a cold start (`/?forgot`). */
  readonly initialEmail = input('');
  /** "Back to Sign in": carries the current address back to the Sign in form. */
  readonly backToLogin = output<string>();

  private readonly authApi = inject(AuthApiService);
  private readonly languageService = inject(LanguageService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly googleConfig = inject(ExternalAuthConfigService);

  private readonly emailInput = viewChild<UiInputComponent>('emailInput');
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private readonly retryButton = viewChild<ElementRef<HTMLButtonElement>>('retryButton');

  protected readonly email = new FormControl('', { nonNullable: true });

  protected readonly step = signal<ForgotStep>('request');
  protected readonly sending = signal(false);
  protected readonly notice = signal<ForgotNotice | null>(null);
  protected readonly fieldError = signal<ForgotFieldError | null>(null);
  /** The address the last accepted request went to; "Send again" targets it. */
  protected readonly submittedEmail = signal('');
  protected readonly sentAgain = signal(false);
  protected readonly cooldown = signal(0);
  /** Which request is in flight: "Send again" shows its own sending label in the again row. */
  protected readonly sendingAgain = signal(false);

  /** The Google hint in the Unavailable state: only when Google sign-in is configured. */
  protected readonly googleEnabled = this.googleConfig.googleClientId !== '';

  protected readonly cooldownLabel = computed(() => {
    const total = this.cooldown();
    const seconds = String(total % 60).padStart(2, '0');
    return `${Math.floor(total / 60)}:${seconds}`;
  });

  /** HTML-escaped: it is interpolated into a translation that is bound with [innerHTML]. */
  protected readonly submittedEmailHtml = computed(() =>
    this.submittedEmail().replace(/[&<>"']/g, (c) => EMAIL_HTML_ESCAPES[c]),
  );

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());
    // Editing clears the field error at once (no server call was made for it).
    this.email.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.fieldError.set(null));
  }

  ngOnInit(): void {
    this.email.setValue(this.initialEmail());
    this.focusEmail(false);
  }

  protected submit(): void {
    if (this.sending()) return;
    const value = this.email.value.trim();
    if (value === '') {
      this.fieldError.set('empty');
      this.focusEmail(false);
      return;
    }
    if (new FormControl(value, Validators.email).invalid) {
      this.fieldError.set('invalid');
      this.focusEmail(false);
      return;
    }
    this.post(value, 'request');
  }

  protected sendAgain(): void {
    if (this.sending() || this.cooldown() > 0) return;
    this.post(this.submittedEmail(), 'again');
  }

  /** "Use a different email": back to the Request step with the field selected. */
  protected useOtherEmail(): void {
    if (this.sending()) return;
    this.stopTimer();
    this.cooldown.set(0);
    this.notice.set(null);
    this.sentAgain.set(false);
    this.email.setValue(this.submittedEmail());
    this.step.set('request');
    this.focusEmail(true);
  }

  protected back(): void {
    if (this.sending()) return;
    this.backToLogin.emit(this.email.value);
  }

  private post(email: string, origin: SendOrigin): void {
    this.sending.set(true);
    this.sendingAgain.set(origin === 'again');
    this.notice.set(null);
    this.sentAgain.set(false);

    this.authApi
      .forgotPassword({ email, preferredLanguage: this.languageService.current().code })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.submittedEmail.set(email);
          this.sentAgain.set(origin === 'again');
          this.step.set('check');
          this.startCooldown(DEFAULT_COOLDOWN_SECONDS);
          this.focusHeading();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          if (getApiErrorCode(error) === 'auth.password_reset_unavailable') {
            this.stopTimer();
            this.cooldown.set(0);
            this.email.setValue(email);
            this.step.set('unavailable');
            this.focusRetry();
          } else if (error instanceof HttpErrorResponse && error.status === 429) {
            this.notice.set('rate');
          } else {
            this.notice.set('fail');
          }
        },
      });
  }

  private startCooldown(seconds: number): void {
    this.stopTimer();
    this.cooldown.set(seconds);
    this.timer = setInterval(() => {
      const next = Math.max(this.cooldown() - 1, 0);
      this.cooldown.set(next);
      if (next === 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Focus the address field; `select` highlights an existing value, otherwise the caret goes to the end. */
  private focusEmail(select: boolean): void {
    afterNextRender(
      () => {
        const input = this.emailInput();
        if (input === undefined) return;
        input.focusInput();
        const native = input.inputRef.nativeElement;
        try {
          if (select) {
            native.select();
          } else {
            const end = native.value.length;
            native.setSelectionRange(end, end);
          }
        } catch {
          // type="email" inputs refuse selection ranges in some browsers; focus is enough.
        }
      },
      { injector: this.injector },
    );
  }

  private focusHeading(): void {
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), { injector: this.injector });
  }

  private focusRetry(): void {
    afterNextRender(() => this.retryButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
