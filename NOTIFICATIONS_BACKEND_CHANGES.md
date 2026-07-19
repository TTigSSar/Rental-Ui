# Notifications — Backend Changes

> **Status (implemented):** The core backend now ships in `rental-api`
> (`RentalPlatform.*`): a `Notification` entity + EF migration
> (`AddNotifications`), the four endpoints below, the `NotificationsService`
> /`NotificationsStore`, and a best-effort `INotificationEmitter` wired into
> **booking request/approve/decline** and **listing moderation approve/reject**.
> A dev seed populates a demo feed for `renter@rental.local` (Ryan) and
> `owner@rental.local`. Verified end-to-end: login → feed/unread-count/mark-read/
> mark-all-read all return the expected data and status codes.
>
> **Still open (see §5–§6):** realtime push channel, mobile/web push delivery,
> per-user preferences, and the scheduled return-due / pickup-due reminders.
> Chat-message notifications are not wired because there is no chat backend yet
> (`/api/chat/*` is unimplemented).

The **frontend** Notifications feature is implemented and merged (Angular + NgRx,
mobile + desktop, the approved *Avatar* card design). This document was the
original gap list; the sections below now double as the reference for what was
built plus a ready-to-paste prompt for the remaining server-side work.

Nothing in the shipped frontend uses mock data.

---

## 1. What the frontend already calls

All paths are defined in `src/app/api/api-contract.ts` under `ApiContract.notifications`.
The Angular HTTP interceptor attaches the bearer token, so every request is
implicitly scoped to the authenticated user — **the client never sends a user id**.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/notifications?filter=&cursor=` | Paginated feed for the current user |
| `GET`  | `/api/notifications/unread-count` | Global unread count for the header bell |
| `POST` | `/api/notifications/{id}/read` | Mark one notification read |
| `POST` | `/api/notifications/read-all` | Mark all of the user's notifications read |

### `GET /api/notifications`
Query params:
- `filter` — one of `all` | `unread` | `action` (`action` = urgent items).
- `cursor` — opaque pagination cursor; absent on the first page.

Response shape (matches `NotificationFeedPage` in
`src/app/features/notifications/models/notification.model.ts`):

```jsonc
{
  "items": [
    {
      "id": "n_123",
      "kind": "approved",              // see enum below
      "category": "booking",           // booking|listing|reminder|review|message
      "title": "Anna approved your request",
      "body": "The LEGO Duplo Town Set is yours for 18–22 May…",
      "meta": "4 days · ֏6,000",       // nullable secondary line
      "createdAt": "2026-07-03T09:41:00Z",
      "read": false,
      "urgent": false,                 // drives the "Action needed" pill + Action filter
      "actor": {
        "name": "Anna Sargsyan",
        "avatarUrl": "https://…",      // null for system senders
        "verified": true,
        "system": false,
        "systemIcon": null             // PrimeIcon name (no pi- prefix) when system=true
      },
      "toy": { "imageUrl": "https://…", "title": "LEGO Duplo Town Set" }, // nullable
      "primaryAction":   { "label": "Arrange pickup", "deepLink": "/bookings/4821" },
      "secondaryAction": { "label": "Message Anna",   "deepLink": "/chat/abc" }        // nullable
    }
  ],
  "nextCursor": "eyJvZmZzZXQiOjIwfQ==", // null on the last page
  "counts": { "all": 12, "unread": 4, "action": 2 } // authoritative, whole-feed totals
}
```

Notes for the implementer:
- **Copy is produced server-side** (`title`, `body`, `meta`, action `label`s).
  The frontend localises only the fixed taxonomy (kind label, filter tabs, group
  headers, relative time). Localise the copy server-side off the recipient's
  language if you support it; otherwise English is fine for v1.
- `deepLink` must be an **in-app router path** that already exists in this app:
  - booking detail → `/bookings/{bookingId}`
  - booking requests (owner) → `/bookings/requests`
  - chat thread → `/chat/{conversationId}`
  - listing editor → `/my-listings/{listingId}/edit`
  - public listing → `/listings/{listingId}`
  - review form → `/bookings/{bookingId}/review` (renter) / `/bookings/{bookingId}/rate-renter` (owner)
  Do not invent routes; map to the flows above.
- `counts` must be **aggregated over the whole feed**, not the returned page —
  they back the filter-tab badges. `counts.unread` also seeds the header bell
  badge on every feed load.

### `GET /api/notifications/unread-count`
```json
{ "unreadCount": 4 }
```
Polled by the header badge every 60s while authenticated (no realtime yet — see §5).

### `POST /api/notifications/{id}/read` and `POST /api/notifications/read-all`
Return `204 No Content`. Both must be **idempotent** (re-marking an already-read
row is a no-op) and **authorization-scoped**: a user may only mark their own rows;
`{id}` belonging to another user → `404`.

---

## 2. `Notification` model / table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | PK | |
| `user_id` | FK → User | **recipient**; every query filters on this |
| `kind` | enum | `request, approved, declined, listing_live, listing_changes, pickup, confirm, return, review, message` |
| `category` | enum | `booking, listing, reminder, review, message` |
| `title` | text | rendered copy |
| `body` | text | rendered copy |
| `meta` | text null | secondary line |
| `urgent` | bool | action-needed |
| `actor_user_id` | FK → User null | null when a system sender |
| `actor_system` | enum/text null | e.g. `dorent`, `moderator` → maps to name + icon |
| `entity_type` | enum | `booking, listing, message, review` |
| `entity_id` | FK/string | the row the deep link targets |
| `deep_link` | text | precomputed in-app path (or derived from entity at read time) |
| `primary_action_label` | text null | |
| `secondary_action_label` | text null | |
| `secondary_deep_link` | text null | |
| `read_at` | timestamp null | null ⇒ unread |
| `created_at` | timestamp | feed ordering, Today/Earlier grouping |

Index: `(user_id, read_at, created_at DESC)` for both the feed page and the
unread count. Cursor pagination on `(created_at, id)`.

`toy` fields (image + title) can be joined from the listing referenced by the
booking/listing entity rather than duplicated — expose them in the response
serializer.

---

## 3. Emitter — create a notification on every domain event

Add a `NotificationService.emit(...)` that is **idempotent per (recipient, kind,
entity, dedupe-window)** so retries/webhooks don't duplicate. Hook it into the
events you already have — do not invent new ones:

| Existing event | Recipient | kind |
| --- | --- | --- |
| Booking requested | owner | `request` (urgent) |
| Booking approved | renter | `approved` |
| Booking declined | renter | `declined` |
| Booking handed over | renter | `confirm` (urgent) |
| Booking completed | both | `review` |
| Listing approved (admin moderation hook) | owner | `listing_live` |
| Listing rejected / changes requested (admin moderation hook) | owner | `listing_changes` (urgent) |
| New chat message | recipient | `message` |

Reuse the existing booking status transitions
(`requested→approved/declined→handed_over→confirmed→completed`) and the admin
listing moderation approve/reject hook — the same taxonomy already drives
`FAStatusBadge` in the design system.

## 4. Scheduled reminders (cron / queue)

Two time-based emitters with no existing event:
- **return-due** → renter, kind `return` (urgent), when a rental's return date is today.
- **pickup-due** → owner, kind `pickup` (urgent), on the handover date/time.

Guard against double-send (once per booking per reminder type).

## 5. Realtime + push (currently absent)

This app has **no realtime transport today** (chat is plain HTTP), so the shipped
badge **polls** `unread-count` every 60s (`NotificationBadgeService`). To make it
live:
- Add a per-user channel/topic (WebSocket / SSE / Pusher) and **publish on emit**.
  The frontend badge service exposes `setUnreadCount()` / `refresh()` hooks to
  wire a subscription into (see the service's class comment).
- **Push** (FCM / APNs / web-push): device-token registration + storage, and
  send-on-emit with the `deep_link` in the payload so tapping opens the right
  screen. No token-registration endpoint exists yet.

## 6. Preferences (not built)

Per-user notification settings (categories on/off, push on/off, quiet hours) +
an endpoint, honoured by the emitter. The frontend has no preferences UI yet;
add the endpoint and the emitter check, and it can be surfaced later.

---

## 7. Ready-to-paste prompt for a backend Opus

```
You are implementing the BACKEND for the "DoRent" Notifications feature. The
Angular frontend is already merged and calls these endpoints (all scoped to the
authenticated user via bearer token — the client never sends a user id):

  GET  /api/notifications?filter=all|unread|action&cursor=<opaque>
  GET  /api/notifications/unread-count
  POST /api/notifications/{id}/read        -> 204, idempotent, own-rows-only (else 404)
  POST /api/notifications/read-all         -> 204, idempotent

Build, in MY backend stack and conventions:

1. A `Notification` model/table (see columns below) with index
   (user_id, read_at, created_at DESC) and cursor pagination on (created_at, id).
   Columns: id, user_id (recipient), kind enum
   [request, approved, declined, listing_live, listing_changes, pickup, confirm,
   return, review, message], category enum
   [booking, listing, reminder, review, message], title, body, meta(null),
   urgent(bool), actor_user_id(null), actor_system(null), entity_type, entity_id,
   deep_link, primary_action_label(null), secondary_action_label(null),
   secondary_deep_link(null), read_at(null), created_at.

2. The GET feed endpoint returning:
   { items: Notification[], nextCursor: string|null,
     counts: { all, unread, action } }   // counts aggregate the WHOLE feed
   Serialize each item to the shape in
   src/app/features/notifications/models/notification.model.ts (attached), joining
   the toy image+title from the referenced listing, and mapping actor_system to a
   display name + PrimeIcon (system=true, systemIcon set, avatarUrl null).
   `filter=unread` → read_at IS NULL; `filter=action` → urgent = true.
   deep_link must be an existing in-app route:
     /bookings/{id}, /bookings/requests, /chat/{conversationId},
     /my-listings/{id}/edit, /listings/{id},
     /bookings/{id}/review, /bookings/{id}/rate-renter.

3. unread-count endpoint: { unreadCount: <count of read_at IS NULL> }.

4. mark-read / read-all: set read_at=now; idempotent; a user may only affect
   their own rows.

5. An idempotent NotificationService.emit(recipient, kind, entity, copy…) hooked
   into EXISTING domain events (do not invent events):
     booking requested -> owner  request (urgent)
     booking approved  -> renter approved
     booking declined  -> renter declined
     booking handed_over -> renter confirm (urgent)
     booking completed -> both   review
     listing approved (admin moderation hook) -> owner listing_live
     listing rejected  (admin moderation hook) -> owner listing_changes (urgent)
     new chat message  -> recipient message
   Dedupe per (recipient, kind, entity, window) so retries don't duplicate.

6. Two scheduled jobs (cron/queue), guarded against double-send:
     return-due -> renter return (urgent)   (rental return date == today)
     pickup-due -> owner  pickup (urgent)    (handover date/time)

7. Stubs + notes (do NOT fully build unless trivial in my stack): a per-user
   realtime channel that publishes on emit; push (FCM/APNs/web-push) device-token
   registration + send-on-emit with deep_link payload; a per-user preferences
   model (categories/push/quiet-hours) honoured by the emitter.

Match my framework, auth, ORM, and migration conventions. List any assumptions at
the top. Ship migrations, model, serializer, endpoints, the emitter + event hooks,
and the two scheduled jobs.
```
