import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';

import { selectAuthUser } from '../../auth/store/auth.selectors';
import { BrowserNotificationService } from '../../notifications/services/browser-notification.service';
import {
  chatNotificationSnippet,
  shouldNotifyChatMessage,
} from '../models/chat-browser-notify.util';
import type { ChatRealtimeMessage } from '../models/chat.model';

/**
 * Raises a browser notification for a new chat message while the DoRent tab is hidden
 * (ADR-059 §8). Fed only by {@link ChatRealtimeService}, whose lifecycle follows the user id
 * (ADR-036): nothing is delivered after sign-out, and {@link closeAll} clears what is open.
 */
@Injectable({ providedIn: 'root' })
export class ChatBrowserNotifier {
  private readonly browser = inject(BrowserNotificationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly currentUser = inject(Store).selectSignal(selectAuthUser);

  private readonly open = new Map<string, () => void>();

  notify(message: ChatRealtimeMessage): void {
    this.browser.refresh();
    const allowed = shouldNotifyChatMessage({
      message,
      currentUserId: this.currentUser()?.id ?? null,
      pageHidden: this.browser.isPageHidden(),
      permission: this.browser.permission(),
    });
    if (!allowed) {
      return;
    }

    const close = this.browser.show({
      title: message.senderName?.trim() || 'DoRent',
      body: this.bodyFor(message),
      tag: message.conversationId,
      onClick: () => {
        window.focus();
        void this.router.navigate(['/chat', message.conversationId]);
      },
    });
    if (close !== null) {
      this.open.set(message.conversationId, close);
    }
  }

  /** Closes every notification this service opened (sign-out / account switch). */
  closeAll(): void {
    for (const close of this.open.values()) {
      close();
    }
    this.open.clear();
  }

  private bodyFor(message: ChatRealtimeMessage): string {
    const snippet = chatNotificationSnippet(message.body);
    if (snippet !== null) {
      return snippet;
    }
    return this.translate.instant(
      message.type === 'location' ? 'chat.notify.location' : 'chat.notify.photo',
    );
  }
}
