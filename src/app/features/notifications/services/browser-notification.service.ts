import { Injectable, computed, signal } from '@angular/core';

/** `unsupported` = no Notification API (old browser, SSR, test runner). */
export type BrowserNotificationPermission = 'unsupported' | 'default' | 'granted' | 'denied';

export interface BrowserNotificationRequest {
  title: string;
  body: string;
  /** Same tag replaces the previous notification instead of stacking. */
  tag: string;
  onClick: () => void;
}

/** Per-device flag: the soft permission prompt was answered ("Turn on" or "Not now"). */
export const NOTIFICATION_PROMPT_DISMISSED_KEY = 'dorent.notifications.promptDismissed';

/**
 * Thin, crash-proof wrapper over the browser Notification API plus the per-device
 * "soft prompt answered" flag (ADR-059 §8). Reusable by the chat thread prompt and the
 * Settings notifications row.
 */
@Injectable({ providedIn: 'root' })
export class BrowserNotificationService {
  private readonly permissionSignal = signal<BrowserNotificationPermission>(readPermission());
  private readonly dismissedSignal = signal<boolean>(readDismissed());

  readonly permission = this.permissionSignal.asReadonly();
  readonly supported = computed(() => this.permissionSignal() !== 'unsupported');
  readonly promptDismissed = this.dismissedSignal.asReadonly();

  /** The soft prompt may be offered: supported, never decided, not answered on this device. */
  readonly canPrompt = computed(
    () => this.permissionSignal() === 'default' && !this.dismissedSignal(),
  );

  /** Re-read the permission (the user may have changed it in the browser settings). */
  refresh(): void {
    this.permissionSignal.set(readPermission());
  }

  /** Opens the browser's own permission dialog. Never throws. */
  async requestPermission(): Promise<BrowserNotificationPermission> {
    const api = notificationApi();
    if (api === null) {
      return 'unsupported';
    }
    try {
      await api.requestPermission();
    } catch {
      /* ignore: re-read below */
    }
    this.refresh();
    return this.permissionSignal();
  }

  /** Removes the soft prompt for good on this device. */
  dismissPrompt(): void {
    this.dismissedSignal.set(true);
    try {
      localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, '1');
    } catch {
      /* storage blocked: stays dismissed for this page load only */
    }
  }

  /** True while the DoRent tab is not visible. */
  isPageHidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  /** Shows a notification; returns a closer, or null when nothing was shown. Never throws. */
  show(request: BrowserNotificationRequest): (() => void) | null {
    const api = notificationApi();
    if (api === null || api.permission !== 'granted') {
      return null;
    }
    try {
      const notification = new api(request.title, { body: request.body, tag: request.tag });
      notification.onclick = () => {
        request.onClick();
        notification.close();
      };
      return () => notification.close();
    } catch {
      return null;
    }
  }
}

function notificationApi(): typeof Notification | null {
  const api = (globalThis as { Notification?: typeof Notification }).Notification;
  return typeof api === 'function' ? api : null;
}

function readPermission(): BrowserNotificationPermission {
  const api = notificationApi();
  if (api === null) {
    return 'unsupported';
  }
  try {
    return api.permission;
  } catch {
    return 'unsupported';
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
