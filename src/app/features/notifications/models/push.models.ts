/**
 * Web Push contract (ADR-067). Mirrors PushDtos.cs (PascalCase -> camelCase JSON).
 * Error codes (ProblemDetails `errorCode`): `push.not_configured` (404),
 * `push.invalid_subscription` (400), `push.unauthenticated` (401), `push.user_blocked` (403).
 */

/** GET /api/push/public-key -> 200. VAPID application-server key, base64url, non-null. */
export interface PushPublicKeyResponse {
  readonly publicKey: string;
}

/** PUT /api/push/subscription body. Values come from PushSubscription.toJSON(). */
export interface PushSubscriptionRequest {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/** DELETE /api/push/subscription JSON body. */
export interface PushUnsubscribeRequest {
  readonly endpoint: string;
}

/** Payload delivered to the service worker on a push event (not an HTTP DTO). */
export interface PushNotificationPayload {
  readonly title: string;
  readonly body: string;
  /** Guid of the chat conversation. */
  readonly conversationId: string;
  /** In-app route, `/chat/<conversationId>`. */
  readonly url: string;
}

export type PushErrorCode =
  | 'push.not_configured'
  | 'push.invalid_subscription'
  | 'push.unauthenticated'
  | 'push.user_blocked';
