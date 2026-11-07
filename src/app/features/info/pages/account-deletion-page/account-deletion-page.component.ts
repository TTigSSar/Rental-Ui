import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthDialogComponent } from '../../../auth/components/auth-dialog/auth-dialog.component';
import { AuthRedirectService } from '../../../auth/services/auth-redirect.service';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';

/** Where "Sign in and delete" lands once signed in: Profile -> Settings (Delete account row). */
export const ACCOUNT_DELETION_RETURN_URL = '/profile/settings';

/**
 * `/account-deletion` (AD-4) — public explainer, no guard. Tells people how to delete their
 * account and what happens to their data; the only action is "Sign in and delete", which sends a
 * guest through the sign-in dialog and on to Settings via the existing `AuthRedirectService`
 * returnUrl (consumed by `AuthEffects.navigateAfterAuthenticated$`).
 */
@Component({
  selector: 'app-account-deletion-page',
  standalone: true,
  imports: [AuthDialogComponent, TranslatePipe],
  templateUrl: './account-deletion-page.component.html',
  styleUrl: './account-deletion-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDeletionPageComponent {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly authRedirect = inject(AuthRedirectService);

  protected readonly isAuthenticated = this.store.selectSignal(selectIsAuthenticated);
  protected readonly showAuthDialog = signal(false);

  protected signInAndDelete(): void {
    if (this.isAuthenticated()) {
      void this.router.navigateByUrl(ACCOUNT_DELETION_RETURN_URL);
      return;
    }
    this.authRedirect.set(ACCOUNT_DELETION_RETURN_URL);
    this.showAuthDialog.set(true);
  }
}
