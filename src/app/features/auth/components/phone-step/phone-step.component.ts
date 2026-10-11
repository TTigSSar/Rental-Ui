import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';

import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { isValidPhoneNumber } from '../../../../shared/utils/phone.utils';
import * as AuthActions from '../../store/auth.actions';
import { selectPhoneError, selectPhoneSaving } from '../../store/auth.selectors';

export type PhoneStepContext = 'listing' | 'booking';

/**
 * "Add your phone number" (ADR-030 §8): a bottom sheet on mobile, a 480 px dialog on
 * desktop, in the home-point gate's layout family. Reusable and presentational about the
 * action it unblocks: the PARENT opens it (`visible`), and on `saved` re-runs its own
 * original action exactly once; `dismissed` leaves the form underneath untouched.
 *
 * Validation runs on submit only and clears as the user types. While the PUT is in flight
 * the field is locked, the CTA spins and the step cannot be dismissed by any route.
 */
@Component({
  selector: 'app-phone-step',
  standalone: true,
  imports: [ButtonModule, DialogModule, MessageModule, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './phone-step.component.html',
  styleUrls: ['../step-dialog/step-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PhoneStepComponent {
  readonly visible = input.required<boolean>();
  /** Which action this unblocks: picks the eyebrow, the CTA and the toast copy. */
  readonly context = input<PhoneStepContext>('listing');

  /** The phone is saved (and the user re-read): the parent re-runs its action once. */
  readonly saved = output<void>();
  /** "Not now", the X or Esc - nothing was saved, nothing underneath was touched. */
  readonly dismissed = output<void>();

  private readonly store = inject(Store);
  // Optional: the step is embedded in forms whose unit tests do not provide a toast service;
  // the app provides it globally (app.config.ts).
  private readonly messageService = inject(MessageService, { optional: true });
  private readonly translate = inject(TranslateService);

  protected readonly saving = this.store.selectSignal(selectPhoneSaving);
  private readonly saveError = this.store.selectSignal(selectPhoneError);
  protected readonly hasSaveError = computed(() => this.saveError() !== null);

  protected readonly phone = new FormControl('', { nonNullable: true });
  protected readonly invalid = signal(false);
  protected readonly isListing = computed(() => this.context() === 'listing');

  private awaitingSave = false;

  constructor() {
    // Every opening starts clean: empty field, no stale error from an earlier attempt.
    effect(() => {
      if (this.visible()) {
        this.phone.reset('');
        this.invalid.set(false);
        this.awaitingSave = false;
        this.store.dispatch(AuthActions.clearProfileWriteError());
      }
    });

    // The field is locked while the PUT is in flight. Through the control, not a `[disabled]`
    // binding: that would also reach the forms directive and trip its warning.
    effect(() => {
      if (this.saving()) {
        this.phone.disable({ emitEvent: false });
      } else {
        this.phone.enable({ emitEvent: false });
      }
    });

    // saving true -> false after OUR submit: success closes the loop, failure keeps the
    // step open with the generic error above the field.
    effect(() => {
      if (this.saving() || !this.awaitingSave) {
        return;
      }
      this.awaitingSave = false;
      if (this.saveError() !== null) {
        return;
      }
      this.messageService?.add({
        severity: 'success',
        summary: this.translate.instant('auth.phoneStep.saved'),
        detail: this.translate.instant(
          this.isListing() ? 'auth.phoneStep.savedListing' : 'auth.phoneStep.savedBooking',
        ),
        life: 4000,
      });
      this.saved.emit();
    });
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const value = this.phone.value.trim();
    if (!isValidPhoneNumber(value)) {
      this.invalid.set(true);
      return;
    }
    this.invalid.set(false);
    this.awaitingSave = true;
    this.store.dispatch(AuthActions.updatePhone({ phoneNumber: value }));
  }

  protected onType(): void {
    if (this.invalid()) {
      this.invalid.set(false);
    }
  }

  protected cancel(): void {
    if (this.saving()) {
      return;
    }
    this.dismissed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.visible()) {
      this.cancel();
    }
  }
}
