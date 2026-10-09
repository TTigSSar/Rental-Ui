import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { HomePointMapComponent } from '../../../../shared/ui/home-point-map/home-point-map.component';
import type { HomePointSelection } from '../../../../shared/ui/home-point-map/home-point-map.model';
import { HomePointStatusComponent } from '../../../../shared/ui/home-point-map/home-point-status.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import {
  maxByteLengthValidator,
  MAX_PASSWORD_BYTES,
} from '../../../../shared/validators/max-byte-length.validator';
import * as AuthActions from '../../store/auth.actions';
import {
  selectAuthError,
  selectAuthErrorCode,
  selectAuthLoading,
  selectPendingVerificationEmail,
} from '../../store/auth.selectors';
import { ResendVerificationComponent } from '../resend-verification/resend-verification.component';

/**
 * Sign-up, in two steps inside the existing auth dialog.
 *
 * Step 1 is the account fields, unchanged. Step 2 asks for the home point on a
 * crosshair map and can be skipped — a renter never needs one, and an owner is
 * caught later by the add-a-toy wizard's gate.
 *
 * **The account is created on "Create account" or "Skip", never on
 * "Continue".** That is the whole reason the two steps live in ONE component
 * with one form: a `auth.duplicate_email` rejection can then send the user back
 * to step 1 with the email in error and everything else — including the point
 * they just picked on the map — still there. Creating the account at the end of
 * step 1 would mean either a half-created account or a second, post-registration
 * screen, so the coordinates travel in the register payload itself.
 *
 * ADR-028: a successful register no longer signs anyone in (201, no token). The
 * form is then replaced by a "check your email" step with a resend button; the
 * account becomes usable only after the emailed link is confirmed on
 * `/auth/verify-email`.
 */
@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    HomePointMapComponent,
    HomePointStatusComponent,
    MessageModule,
    ReactiveFormsModule,
    ResendVerificationComponent,
    TranslatePipe,
    UiInputComponent,
  ],
  templateUrl: './register-form.component.html',
  styleUrl: './register-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class RegisterFormComponent {
  @Output() readonly switchMode = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly isLoading = this.store.selectSignal(selectAuthLoading);
  private readonly errorCode = this.store.selectSignal(selectAuthErrorCode);

  protected readonly isLoading$ = this.store.select(selectAuthLoading);
  protected readonly error$ = this.store.select(selectAuthError);

  private static readonly PHONE_PATTERN = /^\+?(?=(?:[^\d]*\d){7,20}[^\d]*$)[\d\s\-().]+$/;

  protected readonly step = signal<1 | 2>(1);

  /** The home point chosen on step 2, or null while none has been. */
  protected readonly homeSelection = signal<HomePointSelection | null>(null);

  /**
   * "Create account" stays disabled until the map has been moved or a location
   * fix has arrived — the same `deliberate` rule the picker's Confirm uses, and
   * the same reason: the map opens on Republic Square, and nobody should
   * register their home as the city centre because that is where the crosshair
   * happened to be. "Skip" is always enabled, so this is never a dead end.
   */
  protected readonly canCreateWithPoint = computed(() => {
    const selection = this.homeSelection();
    return selection !== null && selection.canConfirm;
  });

  /** The server refused the point with `auth.home_point_outside_yerevan` — a
   *  `ServiceError` code, NOT a field-level validation error. */
  protected readonly serverOutsideYerevan = computed(
    () => this.errorCode() === 'auth.home_point_outside_yerevan',
  );

  /** ADR-028: set once the account is created — the confirmation link has been
   *  sent and nobody is signed in. Swaps the whole form for the "check your email"
   *  step (see `registerSuccess` in the reducer). */
  protected readonly pendingEmail = this.store.selectSignal(selectPendingVerificationEmail);

  /** Codes that get a purpose-written, translated message instead of the raw
   *  English `ProblemDetails.title`. */
  protected readonly errorTranslationKey = computed((): string | null => {
    switch (this.errorCode()) {
      case 'auth.verification_cooldown':
        return 'auth.verification.registerCooldown';
      case 'auth.registration_unavailable':
        return 'auth.verification.registrationUnavailable';
      default:
        return null;
    }
  });

  protected readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [
      '',
      [Validators.required, Validators.minLength(8), maxByteLengthValidator(MAX_PASSWORD_BYTES)],
    ],
    phoneNumber: [
      '',
      [Validators.required, Validators.pattern(RegisterFormComponent.PHONE_PATTERN)],
    ],
  });

  constructor() {
    // A duplicate email is a STEP 1 problem reported from step 2 — walk the
    // user back to the field that is wrong and mark it, keeping every other
    // value (and the chosen home point) exactly as it was.
    effect(() => {
      if (this.errorCode() === 'auth.duplicate_email') {
        this.step.set(1);
        const email = this.registerForm.controls.email;
        email.setErrors({ ...(email.errors ?? {}), emailTaken: true });
        email.markAsTouched();
      }
    });
  }

  /** Step 1 → step 2. Client-side validation only; nothing is sent yet. */
  protected continueToHomePoint(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.store.dispatch(AuthActions.clearAuthError());
    this.step.set(2);
  }

  protected backToAccount(): void {
    this.step.set(1);
  }

  protected onHomeSelectionChange(selection: HomePointSelection): void {
    this.homeSelection.set(selection);
  }

  /** "Create account" — with the chosen coordinates. */
  protected submitWithHomePoint(): void {
    const selection = this.homeSelection();
    if (selection === null || !selection.canConfirm) return;
    this.submit({ homeLatitude: selection.center.lat, homeLongitude: selection.center.lng });
  }

  /** "Skip for now" — the SAME registration, with no coordinates at all.
   *  Both-or-neither: sending one without the other is a 400. */
  protected submitWithoutHomePoint(): void {
    this.submit(null);
  }

  private submit(home: { homeLatitude: number; homeLongitude: number } | null): void {
    if (this.isLoading()) return;
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.step.set(1);
      return;
    }
    const payload = { ...this.registerForm.getRawValue(), ...(home ?? {}) };
    this.store.dispatch(AuthActions.register({ payload }));
  }

  protected hasError(
    controlName: 'firstName' | 'lastName' | 'email' | 'password' | 'phoneNumber',
    errorKey: string,
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.touched && control.hasError(errorKey);
  }

  protected isInvalid(
    controlName: 'firstName' | 'lastName' | 'email' | 'password' | 'phoneNumber',
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.touched && control.invalid;
  }

  protected phoneErrorKey(): string {
    if (this.hasError('phoneNumber', 'required')) return 'auth.validation.phoneNumberRequired';
    if (this.hasError('phoneNumber', 'pattern')) return 'auth.validation.phoneNumberInvalid';
    return '';
  }

  protected emailErrorKey(): string {
    if (this.hasError('email', 'emailTaken')) return 'auth.validation.emailTaken';
    if (this.hasError('email', 'required')) return 'auth.validation.emailRequired';
    if (this.hasError('email', 'email')) return 'auth.validation.emailInvalid';
    return '';
  }

  /** The `emailTaken` error is server-supplied, so Angular's own validators
   *  never clear it — a keystroke has to. */
  protected onEmailInput(): void {
    const email = this.registerForm.controls.email;
    if (email.hasError('emailTaken')) {
      const { emailTaken, ...rest } = email.errors ?? {};
      void emailTaken;
      email.setErrors(Object.keys(rest).length > 0 ? rest : null);
      email.updateValueAndValidity();
    }
  }

  protected passwordErrorKey(): string {
    if (this.hasError('password', 'required')) return 'auth.validation.passwordRequired';
    if (this.hasError('password', 'minlength')) return 'auth.validation.passwordMinLength';
    if (this.hasError('password', 'maxByteLength')) return 'auth.validation.passwordTooLong';
    return '';
  }
}
