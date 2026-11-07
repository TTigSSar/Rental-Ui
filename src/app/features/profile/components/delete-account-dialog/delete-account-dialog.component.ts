import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';

import {
  getApiErrorCode,
  type ApiProblemDetails,
  type OpenRental,
} from '../../../../api/api-error.model';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { UiDateService } from '../../../../shared/utils/ui-date';
import { AuthApiService } from '../../../auth/services/auth-api.service';
import * as AuthActions from '../../../auth/store/auth.actions';

type DeletePhase = 'confirm' | 'blocked';
type ConfirmState = 'idle' | 'invalid' | 'loading' | 'error';

/** Same breakpoint as the bottom-sheet layout in the stylesheet. */
const MOBILE_QUERY = '(max-width: 560px)';

/**
 * Delete-account dialog (AD-4, ADR-056): confirm with the password (or the email, for a Google-only
 * account), a "blocked by open rentals" body, and the post-deletion hand-off. Component-local state,
 * like `SecurityPageComponent`: a one-shot request/response with nothing to keep in sync, so an
 * NgRx slice would be ceremony. The only store interaction is `AuthActions.logout()` on success.
 *
 * Outcomes of `DELETE /api/auth/me`:
 *  - 204                                  -> local logout, home, success toast
 *  - 401 (token already revoked)          -> local logout, home, info toast (outcome unknown)
 *  - 400 `account.invalid_confirmation`   -> inline field error (text depends on `hasPassword`)
 *  - 409 `account.has_open_rentals`       -> blocked body listing `openRentals`
 *  - 409 `account.state_changed`, 403 `account.admin_cannot_delete`, 429, 5xx, network
 *                                         -> neutral banner, Delete enabled again
 * While the request is in flight Cancel, the close button and Escape are disabled.
 */
@Component({
  selector: 'app-delete-account-dialog',
  standalone: true,
  imports: [DialogModule, MessageModule, RouterLink, TranslatePipe, UiInputComponent],
  templateUrl: './delete-account-dialog.component.html',
  styleUrl: './delete-account-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DeleteAccountDialogComponent {
  readonly visible = input.required<boolean>();
  /** False for a Google-only account: the dialog then asks for the account email. */
  readonly hasPassword = input<boolean>(true);

  readonly closed = output<void>();

  private readonly authApi = inject(AuthApiService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly uiDate = inject(UiDateService);

  protected readonly phase = signal<DeletePhase>('confirm');
  protected readonly state = signal<ConfirmState>('idle');
  protected readonly value = signal('');
  protected readonly staysOpen = signal(false);
  protected readonly openRentals = signal<readonly OpenRental[]>([]);

  protected readonly failedImages = signal<ReadonlySet<string>>(new Set());

  protected readonly loading = computed(() => this.state() === 'loading');
  protected readonly fieldError = computed(() => {
    if (this.state() !== 'invalid') return null;
    return this.hasPassword()
      ? 'profile.deleteAccount.errors.invalidPassword'
      : 'profile.deleteAccount.errors.invalidEmail';
  });

  /** CTA of the blocked body: incoming requests when every open rental is one we lend out. */
  protected readonly ctaLink = computed(() => {
    const rentals = this.openRentals();
    const allLending = rentals.length > 0 && rentals.every((r) => r.role === 'owner');
    return allLending ? '/profile/requests' : '/profile/rentals';
  });
  protected readonly ctaLabelKey = computed(() =>
    this.ctaLink() === '/profile/requests'
      ? 'profile.deleteAccount.blocked.ctaRequests'
      : 'profile.deleteAccount.blocked.ctaRentals',
  );

  private readonly field = viewChild(UiInputComponent);
  private readonly titleEl = viewChild<ElementRef<HTMLElement>>('titleEl');

  constructor() {
    // Every opening starts clean: empty field, no stale error, summary collapsed.
    effect(() => {
      if (this.visible()) {
        this.phase.set('confirm');
        this.state.set('idle');
        this.value.set('');
        this.staysOpen.set(false);
        this.openRentals.set([]);
      }
    });

    // Focus: the field on desktop, the title on mobile (so the keyboard doesn't cover the
    // summary). The blocked body has no field, so it lands on the title.
    afterRenderEffect(() => {
      if (!this.visible()) return;
      const field = this.field();
      const title = this.titleEl();
      if (this.phase() === 'confirm' && field && !this.isMobile()) {
        field.focusInput();
      } else {
        title?.nativeElement.focus();
      }
    });

    // A rejected value keeps the field focused.
    afterRenderEffect(() => {
      if (this.state() === 'invalid') {
        this.field()?.focusInput();
      }
    });
  }

  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.(MOBILE_QUERY).matches === true;
  }

  protected dateRange(rental: OpenRental): string {
    return this.uiDate.formatRange(rental.startDate, rental.endDate);
  }

  protected markImageFailed(bookingId: string): void {
    this.failedImages.update((set) => new Set(set).add(bookingId));
  }

  protected onType(next: string): void {
    this.value.set(next);
    if (this.state() === 'invalid' || this.state() === 'error') {
      this.state.set('idle');
    }
  }

  protected toggleStays(): void {
    this.staysOpen.update((v) => !v);
  }

  protected close(): void {
    if (this.state() === 'loading') return;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.visible()) {
      this.close();
    }
  }

  protected submit(): void {
    if (this.state() === 'loading') return;
    const typed = this.hasPassword() ? this.value() : this.value().trim();
    if (typed === '') {
      this.state.set('invalid');
      return;
    }
    this.state.set('loading');
    const request = this.hasPassword()
      ? { password: typed, email: null }
      : { password: null, email: typed };

    this.authApi.deleteAccount(request).subscribe({
      next: () => this.finish('success'),
      error: (error: unknown) => this.handleError(error),
    });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.finish('signedOut');
      return;
    }

    const code = getApiErrorCode(error);
    if (code === 'account.invalid_confirmation') {
      this.state.set('invalid');
      return;
    }
    if (code === 'account.has_open_rentals') {
      const body = (error as HttpErrorResponse).error as ApiProblemDetails | null;
      const rentals = Array.isArray(body?.openRentals) ? body.openRentals : [];
      if (rentals.length > 0) {
        this.openRentals.set(rentals);
        this.phase.set('blocked');
        this.state.set('idle');
        return;
      }
    }
    // state_changed, admin_cannot_delete, 429, 5xx, network, anything else.
    this.state.set('error');
  }

  /** Ends the session locally, goes home and shows exactly one toast. */
  private finish(outcome: 'success' | 'signedOut'): void {
    this.store.dispatch(AuthActions.logout());
    // After the dispatch: the logout effect navigates too, and the last navigation wins.
    void this.router.navigateByUrl('/');
    this.messageService.add({
      severity: outcome === 'success' ? 'success' : 'info',
      summary: this.translate.instant(
        outcome === 'success'
          ? 'profile.deleteAccount.toast.success'
          : 'profile.deleteAccount.toast.signedOut',
      ),
      life: outcome === 'success' ? 6000 : 9000,
    });
    this.closed.emit();
  }
}
