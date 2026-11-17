import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  PushPublicKeyResponse,
  PushSubscriptionRequest,
  PushUnsubscribeRequest,
} from '../models/push.models';

/** Per-device, per-user flag set by "Turn off on this device" (ADR-067 §6). */
export const pushOffKey = (userId: string): string => `dorent.push.off:${userId}`;

/**
 * Web Push subscription lifecycle for chat messages (ADR-067). Every public method is
 * crash-proof: nothing here throws to callers, and a missing/unsupported browser API simply
 * leaves the in-tab notifications in charge. Operations run strictly one after another so a
 * logout's unsubscribe can never race the next user's subscribe.
 */
@Injectable({ providedIn: 'root' })
export class PushSubscriptionService {
  private readonly http = inject(HttpClient);

  /** serviceWorker + PushManager + Notification are all present. */
  readonly supported = signal<boolean>(detectSupported()).asReadonly();

  private readonly activeSignal = signal(false);
  /** True while this device holds a live subscription registered with the backend. */
  readonly active = this.activeSignal.asReadonly();

  private readonly unavailableSignal = signal(false);
  /** The backend has no VAPID keys (404 push.not_configured). */
  readonly unavailable = this.unavailableSignal.asReadonly();

  /** Bumped whenever an off flag changes so `isOff` readers re-evaluate. */
  private readonly flagTick = signal(0);
  private queue: Promise<void> = Promise.resolve();

  /** True when "Turn off on this device" is set for this user. Reactive via the tick. */
  isOff(userId: string | null): boolean {
    this.flagTick();
    if (userId === null) {
      return false;
    }
    try {
      return localStorage.getItem(pushOffKey(userId)) !== null;
    } catch {
      return false;
    }
  }

  /** Subscribes (or re-registers the existing subscription) when permission allows it. */
  ensureSubscribed(userId: string): Promise<void> {
    return this.enqueue(async () => {
      if (!this.supported() || Notification.permission !== 'granted' || this.isOff(userId)) {
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      let subscription = await registration.pushManager.getSubscription();
      if (subscription === null) {
        let key: PushPublicKeyResponse;
        try {
          key = await firstValueFrom(
            this.http.get<PushPublicKeyResponse>(toApiUrl(ApiContract.push.publicKey)),
          );
        } catch (error) {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.unavailableSignal.set(true);
          }
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(key.publicKey),
        });
      }
      const json = subscription.toJSON();
      const body: PushSubscriptionRequest = {
        endpoint: subscription.endpoint,
        p256dh: json.keys?.['p256dh'] ?? '',
        auth: json.keys?.['auth'] ?? '',
      };
      await firstValueFrom(this.http.put<void>(toApiUrl(ApiContract.push.subscription), body));
      this.activeSignal.set(true);
    });
  }

  /** "Turn off on this device": flag first, unsubscribe next, best-effort DELETE last. */
  turnOff(userId: string): Promise<void> {
    try {
      localStorage.setItem(pushOffKey(userId), '1');
    } catch {
      /* storage blocked: the flag lasts nothing, the unsubscribe below still happens */
    }
    this.flagTick.update((n) => n + 1);
    return this.enqueue(() => this.dropSubscription());
  }

  /** Real session end (logout or account switch). Needs no token. */
  onSessionEnded(): Promise<void> {
    return this.enqueue(() => this.dropSubscription());
  }

  /** Permission was (re)granted explicitly: forget "Turn off". */
  clearOff(userId: string): void {
    try {
      localStorage.removeItem(pushOffKey(userId));
    } catch {
      /* ignore */
    }
    this.flagTick.update((n) => n + 1);
  }

  private async dropSubscription(): Promise<void> {
    this.activeSignal.set(false);
    if (!this.supported()) {
      return;
    }
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) {
      return;
    }
    const endpoint = subscription.endpoint;
    // Unsubscribe FIRST: the server row is cleaned up best-effort (a 410 sweeps leftovers).
    await subscription.unsubscribe();
    const body: PushUnsubscribeRequest = { endpoint };
    try {
      await firstValueFrom(
        this.http.request<void>('DELETE', toApiUrl(ApiContract.push.subscription), { body }),
      );
    } catch {
      /* best effort */
    }
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const run = this.queue.then(job).catch(() => undefined);
    this.queue = run;
    return run;
  }
}

function detectSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof (globalThis as { PushManager?: unknown }).PushManager === 'function' &&
      typeof (globalThis as { Notification?: unknown }).Notification === 'function'
    );
  } catch {
    return false;
  }
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/** iOS Safari in a normal tab: Web Push only works once installed to the Home Screen. */
export function isIosBrowserTab(): boolean {
  try {
    const ua = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!ios) {
      return false;
    }
    const standalone =
      (navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true;
    return !standalone;
  } catch {
    return false;
  }
}
