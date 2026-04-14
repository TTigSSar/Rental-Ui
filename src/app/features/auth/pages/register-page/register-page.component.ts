import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import type { ExternalAuthProvider } from '../../models/auth.models';
import * as AuthActions from '../../store/auth.actions';
import { selectAuthError, selectAuthLoading } from '../../store/auth.selectors';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    CardModule,
    InputTextModule,
    MessageModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);

  protected readonly isLoading$ = this.store.select(selectAuthLoading);
  protected readonly error$ = this.store.select(selectAuthError);

  protected readonly registerForm = this.fb.nonNullable.group({
    firstName: ['Guest', [Validators.required]],
    lastName: ['User', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected submit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const payload = this.registerForm.getRawValue();
    this.store.dispatch(AuthActions.register({ payload }));
  }

  protected continueWithProvider(provider: ExternalAuthProvider): void {
    this.store.dispatch(AuthActions.externalAuth({ provider, idToken: '' }));
  }

  protected hasError(
    controlName: 'firstName' | 'lastName' | 'email' | 'password',
    errorKey: string,
  ): boolean {
    const control = this.registerForm.controls[controlName];
    return control.touched && control.hasError(errorKey);
  }
}
