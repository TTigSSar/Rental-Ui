import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';

import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import * as AuthActions from '../../store/auth.actions';
import {
  selectAuthUser,
  selectNameErrorCode,
  selectNameSaving,
  selectNameError,
  selectNameStepRequired,
} from '../../store/auth.selectors';

/** `FirstName` / `LastName` are nvarchar(100) columns; the API takes 1-100 after trim. */
export const NAME_MAX_LENGTH = 100;

/**
 * The mandatory "What should we call you?" step (ADR-030 §5), mounted once in the app shell.
 *
 * It shows whenever a signed-in user's first name is empty - after a Google sign-in whose
 * account carries no usable name, and again on app start if the tab was closed mid-step.
 * It cannot be dismissed: no close button, no Esc, no mask click, no swipe. The only way
 * out is "Continue" with a first name, which PUTs `/api/auth/me/name`.
 */
@Component({
  selector: 'app-name-step',
  standalone: true,
  imports: [ButtonModule, DialogModule, MessageModule, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './name-step.component.html',
  styleUrls: ['../step-dialog/step-dialog.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class NameStepComponent {
  /** The auth dialog is still on screen: wait, so the two never stack visibly. */
  readonly suppressed = input(false);

  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  private readonly required = this.store.selectSignal(selectNameStepRequired);
  protected readonly visible = computed(() => this.required() && !this.suppressed());

  protected readonly user = this.store.selectSignal(selectAuthUser);
  protected readonly saving = this.store.selectSignal(selectNameSaving);
  private readonly saveError = this.store.selectSignal(selectNameError);
  private readonly saveErrorCode = this.store.selectSignal(selectNameErrorCode);

  protected readonly maxLength = NAME_MAX_LENGTH;

  protected readonly form = this.fb.nonNullable.group({
    firstName: [''],
    lastName: [''],
  });

  /** Validation runs on "Continue" only (board 2): the button is never disabled, so the
   *  requirement is never a mystery. */
  protected readonly firstNameInvalid = signal(false);

  /** 400 `auth.invalid_name` is a field problem (same copy as an empty first name); any
   *  other refusal is the generic "couldn't save" banner. */
  protected readonly serverRejectedName = computed(
    () => this.saveError() !== null && this.saveErrorCode() === 'auth.invalid_name',
  );
  protected readonly genericError = computed(
    () => this.saveError() !== null && this.saveErrorCode() !== 'auth.invalid_name',
  );

  private awaitingSave = false;

  constructor() {
    // A fresh opening starts clean: no stale refusal from an earlier attempt.
    effect(() => {
      if (this.visible()) {
        this.store.dispatch(AuthActions.clearProfileWriteError());
      }
    });

    // Fields are locked while the PUT is in flight (through the controls, not a `[disabled]`
    // binding, which would also reach the forms directives and trip their warning).
    effect(() => {
      if (this.saving()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });

    // Welcome toast once the server has accepted the name (saving true -> false, no error).
    effect(() => {
      const saving = this.saving();
      if (saving) {
        return;
      }
      if (!this.awaitingSave) {
        return;
      }
      this.awaitingSave = false;
      if (this.saveError() !== null) {
        return;
      }
      const name = this.user()?.firstName ?? '';
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('auth.nameStep.welcome', { name }),
        life: 5000,
      });
    });
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const { firstName, lastName } = this.form.getRawValue();
    const first = firstName.trim();
    if (first === '' || first.length > NAME_MAX_LENGTH) {
      this.firstNameInvalid.set(true);
      return;
    }
    this.firstNameInvalid.set(false);
    this.awaitingSave = true;
    this.store.dispatch(
      AuthActions.updateName({
        payload: { firstName: first, lastName: lastName.trim().slice(0, NAME_MAX_LENGTH) },
      }),
    );
  }

  protected clearFirstNameError(): void {
    if (this.firstNameInvalid()) {
      this.firstNameInvalid.set(false);
    }
  }
}
