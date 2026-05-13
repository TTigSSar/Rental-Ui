import { AsyncPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import type { ExternalAuthProvider } from '../../models/auth.models';
import { ExternalAuthProviderService } from '../../services/external-auth-provider.service';
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
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly externalAuth = inject(ExternalAuthProviderService);
  private readonly isLoading = this.store.selectSignal(selectAuthLoading);

  protected readonly isLoading$ = this.store.select(selectAuthLoading);
  protected readonly error$ = this.store.select(selectAuthError);

  protected readonly googleButton =
    viewChild<ElementRef<HTMLDivElement>>('googleButton');

  protected readonly registerForm = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async ngAfterViewInit(): Promise<void> {
    const container = this.googleButton()?.nativeElement;
    if (!container) {
      return;
    }

    try {
      await this.externalAuth.renderGoogleButton(
        container,
        (idToken) => {
          this.store.dispatch(
            AuthActions.externalAuth({ provider: 'google', idToken }),
          );
        },
        { text: 'signup_with' },
      );
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.warn('[auth:google] Failed to render Google sign-up button.', error);
    }
  }

  protected submit(): void {
    if (this.isLoading()) {
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const payload = this.registerForm.getRawValue();
    this.store.dispatch(AuthActions.register({ payload }));
  }

  protected continueWithProvider(provider: Exclude<ExternalAuthProvider, 'google'>): void {
    if (this.isLoading()) {
      return;
    }

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
