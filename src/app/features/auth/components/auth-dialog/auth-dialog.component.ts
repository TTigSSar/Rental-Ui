import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  ViewEncapsulation,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { filter, pairwise } from 'rxjs';

import * as AuthActions from '../../store/auth.actions';
import { selectIsAuthenticated } from '../../store/auth.selectors';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegisterFormComponent } from '../register-form/register-form.component';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-dialog',
  standalone: true,
  imports: [
    DialogModule,
    LoginFormComponent,
    RegisterFormComponent,
    TranslatePipe,
  ],
  templateUrl: './auth-dialog.component.html',
  styleUrl: './auth-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class AuthDialogComponent {
  @Output() readonly closed = new EventEmitter<void>();

  readonly visible = input.required<boolean>();

  private readonly store = inject(Store);
  private readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);

  protected readonly activeMode = signal<AuthMode>('login');

  constructor() {
    // Reset to login mode and clear stale errors whenever the dialog opens.
    effect(() => {
      if (this.visible()) {
        this.activeMode.set('login');
        this.store.dispatch(AuthActions.clearAuthError());
      }
    });

    // Close automatically when the user authenticates while the dialog is open.
    toObservable(this.isAuthenticated)
      .pipe(
        pairwise(),
        filter(([prev, curr]) => !prev && curr),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.visible()) {
          this.closed.emit();
        }
      });
  }

  protected switchToRegister(): void {
    this.activeMode.set('register');
    this.store.dispatch(AuthActions.clearAuthError());
  }

  protected switchToLogin(): void {
    this.activeMode.set('login');
    this.store.dispatch(AuthActions.clearAuthError());
  }
}
