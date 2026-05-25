import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import * as AuthActions from '../../store/auth.actions';
import { selectAuthError, selectAuthLoading } from '../../store/auth.selectors';

@Component({
  selector: 'app-register-form',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    InputTextModule,
    MessageModule,
    ReactiveFormsModule,
    TranslatePipe,
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

  protected readonly isLoading$ = this.store.select(selectAuthLoading);
  protected readonly error$ = this.store.select(selectAuthError);

  private static readonly PHONE_PATTERN = /^\+?[\d\s\-()\\.]{7,20}$/;

  protected readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    phoneNumber: ['', [Validators.required, Validators.pattern(RegisterFormComponent.PHONE_PATTERN)]],
  });

  protected submit(): void {
    if (this.isLoading()) return;
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const payload = this.registerForm.getRawValue();
    this.store.dispatch(AuthActions.register({ payload }));
  }

  protected hasError(
    controlName: 'firstName' | 'lastName' | 'email' | 'password' | 'phoneNumber',
    errorKey: string,
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.touched && control.hasError(errorKey);
  }

  protected isInvalid(controlName: 'firstName' | 'lastName' | 'email' | 'password' | 'phoneNumber'): boolean {
    const control = this.registerForm.controls[controlName];
    return control.touched && control.invalid;
  }
}
