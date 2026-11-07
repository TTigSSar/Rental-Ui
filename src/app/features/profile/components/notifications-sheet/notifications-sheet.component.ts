import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  afterNextRender,
  inject,
  output,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import * as AuthActions from '../../../auth/store/auth.actions';
import {
  selectChatEmailsEnabled,
  selectChatEmailsSaveState,
} from '../../../auth/store/auth.selectors';
import { BrowserNotificationService } from '../../../notifications/services/browser-notification.service';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Settings > Notifications container (ADR-059, card 17b): a bottom sheet under 961px, a 560px
 * centred dialog above. Row A is the chat-email switch (saved immediately, optimistic, reverts
 * on failure); Row B reflects the browser permission via `BrowserNotificationService` (no off
 * switch — a page cannot take permission back). Focus is trapped while open and restored on
 * close, same idiom as `CategoryEditSheetComponent` / `RejectSheetComponent`.
 */
@Component({
  selector: 'app-notifications-sheet',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './notifications-sheet.component.html',
  styleUrl: './notifications-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsSheetComponent implements OnInit, OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly store = inject(Store);
  protected readonly browser = inject(BrowserNotificationService);
  private previouslyFocused: HTMLElement | null = null;

  readonly closed = output<void>();

  protected readonly emailsEnabled = this.store.selectSignal(selectChatEmailsEnabled);
  protected readonly saveState = this.store.selectSignal(selectChatEmailsSaveState);
  protected readonly permission = this.browser.permission;

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });
  }

  ngOnInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    // Portal: no ancestor stacking context / transform can trap the sheet below the bottom nav.
    document.body.appendChild(this.host.nativeElement);
    this.store.dispatch(AuthActions.resetChatEmailsSaveState());
    // The user may have changed the permission in the browser settings since the last visit.
    this.browser.refresh();
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
    this.previouslyFocused?.focus?.();
  }

  protected toggleEmails(): void {
    this.store.dispatch(AuthActions.updateChatEmails({ enabled: !this.emailsEnabled() }));
  }

  protected async enableBrowser(): Promise<void> {
    await this.browser.requestPermission();
    // The "Enable" button is replaced by the status once the permission settles, which would
    // drop focus to <body> inside the modal; park it on the stable close button instead.
    this.host.nativeElement.querySelector<HTMLElement>('.ns__close')?.focus();
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
