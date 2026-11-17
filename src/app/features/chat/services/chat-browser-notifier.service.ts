import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';

import { selectAuthUser } from '../../auth/store/auth.selectors';
import { BrowserNotificationService } from '../../notifications/services/browser-notification.service';
import { PushSubscriptionService } from '../../notifications/services/push-subscription.service';
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
  private readonly push = inject(PushSubscriptionService);
  private readonly currentUser = inject(Store).selectSignal(selectAuthUser);

  private readonly open = new Map<string, () => void>();

  constructor() {
    // The service worker asks the open tab to open a chat after a push notification click.
    try {
      navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as { type?: unknown; url?: unknown } | null;
        if (
          data?.type === 'dorent-push-navigate' &&
          typeof data.url === 'string' &&
          data.url.startsWith('/chat/') &&
          !data.url.startsWith('//')
        ) {
          void this.router.navigateByUrl(data.url);
        }
      });
    } catch {
      /* no service worker support */
    }
  }

  notify(message: ChatRealtimeMessage): void {
    // Push (ADR-067 §11) or "Turn off on this device" (§6) silences the in-tab notification.
    if (this.push.active() || this.push.isOff(this.currentUser()?.id ?? null)) {
      return;
    }
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
      title:
        message.senderName?.trim() ||
        (message.type === 'moderationNote'
          ? this.translate.instant('chat.notify.moderation')
          : 'DoRent'),
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
