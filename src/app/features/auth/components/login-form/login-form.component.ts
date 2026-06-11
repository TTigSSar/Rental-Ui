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
import { MessageModule } from 'primeng/message';

import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import * as AuthActions from '../../store/auth.actions';
import { selectAuthError, selectAuthLoading } from '../../store/auth.selectors';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    MessageModule,
    ReactiveFormsModule,
    TranslatePipe,
    UiInputComponent,
  ],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class LoginFormComponent {
  @Output() readonly switchMode = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly isLoading = this.store.selectSignal(selectAuthLoading);

  protected readonly isLoading$ = this.store.select(selectAuthLoading);
  protected readonly error$ = this.store.select(selectAuthError);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.isLoading()) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const payload = this.loginForm.getRawValue();
    this.store.dispatch(AuthActions.login({ payload }));
  }

  protected hasError(controlName: 'email' | 'password', errorKey: string): boolean {
    const control = this.loginForm.controls[controlName];
    return control.touched && control.hasError(errorKey);
  }

  protected isInvalid(controlName: 'email' | 'password'): boolean {
    const control = this.loginForm.controls[controlName];
    return control.touched && control.invalid;
  }
}
