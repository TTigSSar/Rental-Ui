# Backend Persistence Roadmap — "save all data to the DB"

> Goal: every feature the Angular app exposes is backed by real, persisted
> data. This document is (1) a gap analysis, (2) a step-by-step roadmap, and
> (3) a ready-to-hand-off prompt for a backend coding agent working in
> `rental-app/rental-api` (.NET clean architecture + EF Core + SQL Server).

## Gap analysis (what is and isn't persisted today)

I cross-checked the Angular `ApiContract` and feature services against the
backend controllers, `AppDbContext` DbSets, and domain entities.

| Feature | Frontend calls | Backend today | Persisted? |
|---|---|---|---|
| Auth / Users | `/api/auth/*` | `AuthController`, `User` entity | ✅ |
| Listings | `/api/listings/*` | `ListingsController`, `Listing`/`ListingImage` | ✅ |
| Categories | `/api/categories` | `CategoriesController`, `Category` | ✅ |
| Favorites | `/api/favorites/*` | `FavoritesController`, `Favorite` | ✅ |
| Bookings | `/api/bookings/*` | `BookingsController`, `Booking` | ✅ |
| Reviews | `/api/reviews/*` | `ReviewsController`, `ToyReview`/`OwnerReview`/`RenterReview` | ✅ |
| Admin moderation | `/api/admin/listings/*` | `AdminListingsController` | ✅ |
| Home sections | `/api/home/sections` | `HomeController` | ✅ |
| Public profile | `/api/users/{id}/*` | `UsersController` + `PublicUserProfileQueryService` | ✅ |
| **Chat** | `/api/chat/conversations`, `/api/chat/conversations/{id}`, `/api/chat/messages` | **none** — no controller, no entities, no DbSets | ❌ **not persisted** |
| **Profile (own)** | `/api/profile/me` | no `ProfileController` found (data lives in `User`) | ⚠️ **endpoint likely missing** |
| Dashboard (`/dashboard/*`) | nothing — renders hardcoded mock arrays | n/a | ⚠️ **mock, not wired** |

### Conclusions
1. **Chat is the only feature with no DB persistence at all.** The frontend
   issues real HTTP calls that currently 404. This is the main work.
2. **`/api/profile/me`** has no handler; the *data* already lives in the `User`
   table, so this is a thin read endpoint (and optional update), not new storage.
3. **Dashboard** needs no new tables — it duplicates data already served by the
   bookings/listings/favorites endpoints. See `docs/dashboard-implementation-prompt.md`.

---

## Roadmap

### Phase 1 — Chat persistence (primary)

**1.1 Design decision (required first): how does a conversation start?**
The frontend contract has only *list*, *get*, and *send-message* — there is no
"create conversation" call. Pick one and note it:
- **A (recommended):** add `POST /api/chat/conversations` with `{ listingId }`
  (or `{ recipientId, listingId? }`) that finds-or-creates the conversation
  between the current user and the listing owner, returns its id; wire a
  "Message owner" button on the listing-details page to call it then navigate to
  `/chat/:id`. (Small frontend follow-up.)
- **B:** auto-create a conversation as a side effect of a booking request.

**1.2 Domain entities** (`RentalPlatform.Domain/Entities/`)
- `Conversation`: `Id`, `ListingId?` (FK → Listing), `CreatedAt`, `LastMessageAt`.
- `ConversationParticipant`: `Id`, `ConversationId` (FK), `UserId` (FK),
  `LastReadAt` (drives `unreadCount`). Unique index on `(ConversationId, UserId)`.
- `Message`: `Id`, `ConversationId` (FK), `SenderId` (FK → User), `Content`,
  `SentAt`. Index on `(ConversationId, SentAt)`.

**1.3 EF config** (`Infrastructure/Configurations/`) — one
`IEntityTypeConfiguration<T>` per entity, mirroring `FavoriteConfiguration`
(keys, FKs, `OnDelete` behavior, max lengths, indexes).

**1.4 DbContext** — add `DbSet<Conversation>`, `DbSet<ConversationParticipant>`,
`DbSet<Message>` to `AppDbContext`. Configs auto-register via
`ApplyConfigurationsFromAssembly`.

**1.5 Migration** — `dotnet ef migrations add AddChat` in the Infrastructure
project. It is applied automatically on startup by `MigrationExtensions`
(`MigrateAsync` on SQL Server). Verify the migration file is committed.

**1.6 DTOs** (`Application/DTOs/`) — match the frontend `chat.model.ts` exactly:
- `ChatConversationPreviewResponse`: `id, title, lastMessageSnippet, lastMessageAt, unreadCount`
- `ChatMessageResponse`: `id, conversationId, senderId, senderName, content, sentAt`
- `ChatConversationDetailsResponse`: `id, title, participantName, listingTitle, messages[]`
- `SendChatMessageRequest`: `{ conversationId, content }`

**1.7 Store + Service** (follow the `IBookingsStore`/`BookingsService` split)
- `IChatStore` / `ChatStore` (Infrastructure): EF queries.
- `IChatService` / `ChatService` (Application): authorization (caller must be a
  participant), mapping, `unreadCount` = messages with `SentAt > LastReadAt` and
  `SenderId != currentUser`; `title`/`participantName` derived from the *other*
  participant; `listingTitle` from the linked listing. Use `ICurrentUserContext`.
  On `GET conversation/{id}`, bump that participant's `LastReadAt`. On send,
  insert message + update `Conversation.LastMessageAt`.
- Register both in `ServiceCollectionExtensions` (`AddScoped`).

**1.8 Controller** `ChatController` (`[ApiController]`, `[Route("api/[controller]")]`,
`[Authorize]`), mirroring `FavoritesController`'s `Result<T>` + `FromError` pattern:
- `GET conversations` → `ChatConversationPreviewResponse[]`
- `GET conversations/{conversationId:guid}` → `ChatConversationDetailsResponse` (404/403 if not a participant)
- `POST messages` `{ conversationId, content }` → `ChatMessageResponse`
- (if decision A) `POST conversations` `{ listingId }` → `{ id }`

**1.9 Tests** — mirror `bookings.effects.spec`-style coverage on the backend:
service authorization (non-participant gets 403), unreadCount math, find-or-create.

### Phase 2 — Own profile endpoint
- Add `ProfileController` `GET /api/profile/me` returning the current user mapped
  to the `UserProfile` shape (`id, firstName, lastName, email, phoneNumber,
  preferredLanguage, roles`). Reuse `ICurrentUserContext` + `Users` set. No new
  table. (Optionally add `PUT /api/profile/me` if you want profile editing — the
  frontend `ProfileApiService` is read-only today, so this is optional.)

### Phase 3 — Dashboard (no new persistence)
- Either delete the mock dashboard (if `/profile/*` is canonical) or wire it to
  the existing bookings/listings/favorites endpoints per
  `docs/dashboard-implementation-prompt.md`. Optionally add a single
  `GET /api/dashboard/summary` aggregate for the rail counts.

### Phase 4 — Seed data (so screens aren't empty)
- Add/extend a dev seeder (the project already seeds via EF on startup) with a
  few conversations + messages so the chat UI shows real data in Docker.

---

## Ready-to-hand-off agent prompt

> Paste everything below to a backend coding agent working in `rental-app/rental-api`.

You are a Senior .NET Engineer. The solution uses clean architecture
(`RentalPlatform.Domain`, `.Application`, `.Infrastructure`, `.Api`), EF Core
with SQL Server, JWT auth, and a `Result<T>` + `FromError` controller pattern.
Migrations are applied on startup by `MigrationExtensions`. Match existing
conventions exactly — study the **Favorites** and **Bookings** vertical slices
first (`FavoritesController`, `IFavoritesService`/`FavoritesService`,
`IFavoritesStore`/`FavoritesStore`, `FavoriteConfiguration`, `Favorite` entity,
DI registration in `ServiceCollectionExtensions`).

**Task: implement chat persistence** so these existing frontend endpoints work
against the database (they currently 404 — there is no chat backend):
- `GET /api/chat/conversations` → list the current user's conversations.
- `GET /api/chat/conversations/{conversationId}` → conversation with messages;
  403 if the caller is not a participant; mark the caller's messages as read.
- `POST /api/chat/messages` `{ conversationId, content }` → append a message.

Response shapes MUST match the frontend `chat.model.ts` exactly:
`ChatConversationPreview { id, title, lastMessageSnippet, lastMessageAt, unreadCount }`,
`ChatMessage { id, conversationId, senderId, senderName, content, sentAt }`,
`ChatConversationDetails { id, title, participantName, listingTitle, messages[] }`.

Implement, in order:
1. Domain entities `Conversation`, `ConversationParticipant` (with `LastReadAt`),
   `Message` (see field lists in the roadmap above), with relationships.
2. EF `IEntityTypeConfiguration` for each (keys, FKs, indexes, max lengths,
   delete behavior) like `FavoriteConfiguration`.
3. Add the three `DbSet`s to `AppDbContext`.
4. `dotnet ef migrations add AddChat` (Infrastructure project) and commit it.
5. DTOs in `Application/DTOs` matching the shapes above.
6. `IChatStore`/`ChatStore` (EF data access) and `IChatService`/`ChatService`
   (authorization via `ICurrentUserContext`, mapping, `unreadCount` =
   messages newer than the caller's `LastReadAt` not sent by the caller,
   derive `title`/`participantName` from the other participant, `listingTitle`
   from the linked listing; on send, update `Conversation.LastMessageAt`).
7. Register both services in `ServiceCollectionExtensions` (`AddScoped`).
8. `ChatController` mirroring `FavoritesController`.
9. **Decide and implement conversation creation**: add
   `POST /api/chat/conversations` `{ listingId }` that find-or-creates the
   conversation between the current user and the listing owner and returns its
   id (state this choice in the PR). Note any small frontend follow-up needed
   (a "Message owner" action that calls it then navigates to `/chat/:id`).
10. Backend tests: non-participant → 403, `unreadCount` math, find-or-create
    idempotency.

Also (small, separate): add `ProfileController` with `GET /api/profile/me`
returning the current user as `{ id, firstName, lastName, email, phoneNumber,
preferredLanguage, roles }` using `ICurrentUserContext` (no new table).

Definition of done: `dotnet build` + tests pass; migration applies cleanly on a
fresh DB via `docker compose up --build`; the Angular chat and profile pages
load real persisted data; one logical change per commit.
