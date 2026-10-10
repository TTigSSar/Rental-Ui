import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  ViewEncapsulation,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { AuthApiService } from '../../services/auth-api.service';
import { DEFAULT_COOLDOWN_SECONDS, retryAfterSeconds } from '../../services/retry-after';

type ResendError = 'cooldown' | 'unavailable' | 'failed';

/**
 * "Resend the confirmation email" button with the 60 s countdown (ADR-028 §7).
 *
 * Used by the register dialog's check-your-email step (`startCooling`: the email
 * was sent a moment ago, so the button starts locked) and by the login form's
 * "Email not confirmed" notice. The endpoint always answers 202 — also for an
 * unknown or already-verified address — so the success copy is deliberately
 * neutral and never claims an email was actually sent.
 *
 * Local signals, not NgRx: this is a transient per-widget request/cooldown with no
 * second consumer; nothing outside this component needs to read it.
 */
@Component({
  selector: 'app-resend-verification',
  standalone: true,
  imports: [ButtonModule, TranslatePipe],
  templateUrl: './resend-verification.component.html',
  styleUrl: './resend-verification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ResendVerificationComponent implements OnInit {
  readonly email = input.required<string>();
  readonly startCooling = input(false);

  private readonly authApi = inject(AuthApiService);

  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<ResendError | null>(null);
  protected readonly cooldown = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  ngOnInit(): void {
    if (this.startCooling()) {
      this.startCooldown(DEFAULT_COOLDOWN_SECONDS);
    }
  }

  protected resend(): void {
    if (this.sending() || this.cooldown() > 0) return;
    const email = this.email().trim();
    if (email === '') return;

    this.sending.set(true);
    this.sent.set(false);
    this.error.set(null);

    this.authApi.resendVerification({ email }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        this.startCooldown(DEFAULT_COOLDOWN_SECONDS);
      },
      error: (error: unknown) => {
        this.sending.set(false);
        if (error instanceof HttpErrorResponse && error.status === 429) {
          this.error.set('cooldown');
          this.startCooldown(retryAfterSeconds(error));
        } else if (error instanceof HttpErrorResponse && error.status === 503) {
          this.error.set('unavailable');
        } else {
          this.error.set('failed');
        }
      },
    });
  }

  private startCooldown(seconds: number): void {
    this.stopTimer();
    this.cooldown.set(seconds);
    this.timer = setInterval(() => {
      const next = this.cooldown() - 1;
      this.cooldown.set(Math.max(next, 0));
      if (next <= 0) {
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
}
