import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import * as AuthActions from '../../../auth/store/auth.actions';
import {
  selectAuthUser,
  selectNameError,
  selectNameErrorCode,
  selectNameSaving,
  selectPhoneError,
  selectPhoneSaving,
} from '../../../auth/store/auth.selectors';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { isValidPhoneNumber } from '../../../../shared/utils/phone.utils';

const NAME_MAX_LENGTH = 100;

/** Where the two-request save is: name first, then the phone only if it changed. */
type SaveStage = 'idle' | 'name' | 'phone';

/**
 * The profile page's "Personal info" card (ADR-030 §5, §8, board 3): name, phone and a
 * read-only email, edited in place.
 *
 * Reads the AUTH user (`selectAuthUser`), the same single source the Home point card uses.
 * Save = `PUT /api/auth/me/name`, then `PUT /api/auth/me/phone` ONLY when the phone changed
 * (an empty phone stays empty and is never sent). Everything the user typed survives a
 * failure; the card leaves edit mode only when every request it needed has succeeded.
 */
@Component({
  selector: 'app-personal-info-card',
  standalone: true,
  imports: [ButtonModule, MessageModule, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './personal-info-card.component.html',
  styleUrl: './personal-info-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PersonalInfoCardComponent {
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  protected readonly user = this.store.selectSignal(selectAuthUser);
  private readonly nameSaving = this.store.selectSignal(selectNameSaving);
  private readonly phoneSaving = this.store.selectSignal(selectPhoneSaving);
  private readonly nameError = this.store.selectSignal(selectNameError);
  private readonly nameErrorCode = this.store.selectSignal(selectNameErrorCode);
  private readonly phoneError = this.store.selectSignal(selectPhoneError);

  protected readonly editing = signal(false);
  private readonly stage = signal<SaveStage>('idle');
  protected readonly saving = computed(() => this.stage() !== 'idle');

  protected readonly maxLength = NAME_MAX_LENGTH;

  protected readonly displayPhone = computed(() => (this.user()?.phoneNumber ?? '').trim());

  protected readonly form = this.fb.nonNullable.group({
    firstName: [''],
    lastName: [''],
    phoneNumber: [''],
  });

  protected readonly firstNameInvalid = signal(false);
  protected readonly phoneInvalid = signal(false);

  /** 400 `auth.invalid_name` is a field problem; every other refusal is the banner. */
  protected readonly nameRejected = computed(
    () => this.nameError() !== null && this.nameErrorCode() === 'auth.invalid_name',
  );
  protected readonly serverError = computed(
    () =>
      (this.nameError() !== null && this.nameErrorCode() !== 'auth.invalid_name') ||
      this.phoneError() !== null,
  );

  /** Set once the current stage's request has been observed in flight, so a store that has
   *  not flipped yet is never mistaken for an answer. */
  private stageStarted = false;

  constructor() {
    effect(() => {
      if (this.saving()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });

    effect(() => {
      const stage = this.stage();
      if (stage === 'idle') {
        return;
      }
      const inFlight = stage === 'name' ? this.nameSaving() : this.phoneSaving();
      if (inFlight) {
        this.stageStarted = true;
        return;
      }
      if (!this.stageStarted) {
        return;
      }
      this.stageStarted = false;

      if (stage === 'name') {
        if (this.nameError() !== null) {
          this.stage.set('idle');
        } else if (this.phoneChanged()) {
          this.startStage('phone');
          this.store.dispatch(AuthActions.updatePhone({ phoneNumber: this.typedPhone() }));
        } else {
          this.finish();
        }
        return;
      }
      if (this.phoneError() !== null) {
        this.stage.set('idle');
      } else {
        this.finish();
      }
    });
  }

  protected edit(): void {
    const u = this.user();
    this.form.reset({
      firstName: u?.firstName ?? '',
      lastName: u?.lastName ?? '',
      phoneNumber: u?.phoneNumber ?? '',
    });
    this.firstNameInvalid.set(false);
    this.phoneInvalid.set(false);
    this.store.dispatch(AuthActions.clearProfileWriteError());
    this.editing.set(true);
  }

  protected cancel(): void {
    if (this.saving()) {
      return;
    }
    this.store.dispatch(AuthActions.clearProfileWriteError());
    this.editing.set(false);
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    const { firstName, lastName } = this.form.getRawValue();
    const first = firstName.trim();
    const firstOk = first !== '' && first.length <= NAME_MAX_LENGTH;
    this.firstNameInvalid.set(!firstOk);

    // An untouched empty phone is fine (it stays empty). A phone that is typed, or that
    // was cleared when one is saved (the API has no "remove"), must be a valid number.
    const phone = this.typedPhone();
    const original = this.originalPhone();
    const phoneOk = phone === '' ? original === '' : isValidPhoneNumber(phone);
    this.phoneInvalid.set(!phoneOk);

    if (!firstOk || !phoneOk) {
      return;
    }
    this.startStage('name');
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

  protected clearPhoneError(): void {
    if (this.phoneInvalid()) {
      this.phoneInvalid.set(false);
    }
  }

  private typedPhone(): string {
    return this.form.getRawValue().phoneNumber.trim();
  }

  private originalPhone(): string {
    return (this.user()?.phoneNumber ?? '').trim();
  }

  private phoneChanged(): boolean {
    const typed = this.typedPhone();
    return typed !== '' && typed !== this.originalPhone();
  }

  private startStage(stage: SaveStage): void {
    this.stageStarted = false;
    this.stage.set(stage);
  }

  private finish(): void {
    this.stage.set('idle');
    this.editing.set(false);
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('profile.personal.saved'),
      life: 4000,
    });
  }
}
