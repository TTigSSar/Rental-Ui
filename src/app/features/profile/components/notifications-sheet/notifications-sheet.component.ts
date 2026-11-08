import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import * as AuthActions from '../../../auth/store/auth.actions';
import {
  selectChatEmailsEnabled,
  selectChatEmailsSaveState,
} from '../../../auth/store/auth.selectors';
import { BrowserNotificationService } from '../../../notifications/services/browser-notification.service';
import { SettingsSheetComponent } from '../settings-sheet/settings-sheet.component';

/**
 * Settings > Notifications container (ADR-059, card 17b): a bottom sheet under 961px, a 560px
 * centred dialog above. Row A is the chat-email switch (saved immediately, optimistic, reverts
 * on failure); Row B reflects the browser permission via `BrowserNotificationService` (no off
 * switch — a page cannot take permission back). Focus is trapped while open and restored on
 * close — all of that lives in the shared `SettingsSheetComponent` shell.
 */
@Component({
  selector: 'app-notifications-sheet',
  standalone: true,
  imports: [SettingsSheetComponent, TranslatePipe],
  templateUrl: './notifications-sheet.component.html',
  styleUrl: './notifications-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsSheetComponent implements OnInit {
  private readonly store = inject(Store);
  protected readonly browser = inject(BrowserNotificationService);
  private readonly sheet = viewChild.required<SettingsSheetComponent>('sheet');

  readonly closed = output<void>();

  protected readonly emailsEnabled = this.store.selectSignal(selectChatEmailsEnabled);
  protected readonly saveState = this.store.selectSignal(selectChatEmailsSaveState);
  protected readonly permission = this.browser.permission;

  ngOnInit(): void {
    this.store.dispatch(AuthActions.resetChatEmailsSaveState());
    // The user may have changed the permission in the browser settings since the last visit.
    this.browser.refresh();
  }

  protected toggleEmails(): void {
    this.store.dispatch(AuthActions.updateChatEmails({ enabled: !this.emailsEnabled() }));
  }

  protected async enableBrowser(): Promise<void> {
    await this.browser.requestPermission();
    // The "Enable" button is replaced by the status once the permission settles, which would
    // drop focus to <body> inside the modal; park it on the stable close button instead.
    this.sheet().focusClose();
  }
}
