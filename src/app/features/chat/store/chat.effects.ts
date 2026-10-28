import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import {
  EMPTY,
  catchError,
  concatMap,
  filter,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';

import { getApiErrorCode } from '../../../api/api-error.model';
import { ApiErrorMapper } from '../../../api/api-error-mapper';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import * as BookingsActions from '../../bookings/store/bookings.actions';
import { type ChatMessage, type ChatRealtimeMessage } from '../models/chat.model';
import { ChatBadgeService } from '../services/chat-badge.service';
import { ChatApiService } from '../services/chat-api.service';
import * as ChatActions from './chat.actions';
import { selectActiveConversation, selectConversations } from './chat.selectors';

const CHAT_TOAST_LIFE_MS = 7000;

/** Map a viewer-neutral hub message to the local, viewer-relative shape. */
function toChatMessage(raw: ChatRealtimeMessage, currentUserId: string | null): ChatMessage {
  return {
    ...raw,
    isMine: raw.senderId !== null && raw.senderId === currentUserId,
    seen: false,
  };
}

@Injectable()
export class ChatEffects {
  private readonly actions$ = inject(Actions);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly chatApi = inject(ChatApiService);
  private readonly store = inject(Store);
  private readonly chatBadge = inject(ChatBadgeService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly loadConversations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadConversations),
      switchMap(() =>
        this.chatApi.getConversations().pipe(
          map((conversations) => ChatActions.loadConversationsSuccess({ conversations })),
          catchError((error: unknown) =>
            of(
              ChatActions.loadConversationsFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadConversationDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadConversationDetails, ChatActions.leaveConversation),
      switchMap((action) =>
        // Leaving the thread cancels an in-flight details load so it cannot
        // re-open the conversation after the page is gone.
        action.type === ChatActions.leaveConversation.type
          ? EMPTY
          : this.chatApi.getConversationDetails(action.conversationId).pipe(
              map((conversation) => ChatActions.loadConversationDetailsSuccess({ conversation })),
              catchError((error: unknown) =>
                of(
                  ChatActions.loadConversationDetailsFailure({
                    error: this.apiErrors.message(error),
                  }),
                ),
              ),
            ),
      ),
    ),
  );

  readonly sendMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendMessage),
      concatMap(({ conversationId, content }) =>
        this.chatApi.sendMessage(conversationId, content).pipe(
          map((message) => ChatActions.sendMessageSuccess({ message })),
          catchError((error: unknown) =>
            of(
              ChatActions.sendMessageFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * Upload an image attachment. The file arrives already compressed and
   * validated by the composer. On success the object URL behind the optimistic
   * bubble is revoked (the bubble is replaced by the server message); on failure
   * it is kept so the failed bubble still shows the picture.
   */
  readonly sendImageMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.sendImageMessage),
      concatMap(({ conversationId, file, caption, previewUrl }) =>
        this.chatApi.sendImageMessage(conversationId, file, caption).pipe(
          map((message) => {
            URL.revokeObjectURL(previewUrl);
            return ChatActions.sendImageMessageSuccess({ message });
          }),
          catchError((error: unknown) =>
            of(
              ChatActions.sendImageMessageFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /** Owner shares the meeting point (ADR-053); the optimistic/failed state lives in the reducer. */
  readonly shareMeetingPoint$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.shareMeetingPoint),
      concatMap(({ conversationId, request }) =>
        this.chatApi.shareMeetingPoint(conversationId, request).pipe(
          map((message) => ChatActions.shareMeetingPointSuccess({ message })),
          catchError((error: unknown) =>
            of(
              ChatActions.shareMeetingPointFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * The chat turned read-only while the owner was sharing: re-fetch the thread so
   * `isClosed` flips and the composer / pin button / picker react (the realtime
   * `closed` system line does the same, but only when the hub is connected).
   */
  readonly reloadAfterMeetingPointClosed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.shareMeetingPointFailure),
      filter(({ errorCode }) => errorCode === 'chat.conversation_closed'),
      withLatestFrom(this.store.select(selectActiveConversation)),
      filter(([, active]) => active !== null),
      map(([, active]) => ChatActions.loadConversationDetails({ conversationId: active!.id })),
    ),
  );

  readonly markConversationRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.markConversationRead),
      concatMap(({ conversationId }) =>
        this.chatApi.markRead(conversationId).pipe(
          map(() => ChatActions.markConversationReadSuccess({ conversationId })),
          catchError((error: unknown) =>
            of(
              ChatActions.markConversationReadFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * Opens (creating if needed) the conversation tied to a booking — the
   * "Message {owner}" CTA on the booking confirmation screen. The caller
   * (e.g. `ListingBookingPageComponent`) never touches `ChatApiService`
   * directly; it only dispatches {@link ChatActions.openConversationFromBooking}.
   */
  readonly openConversationFromBooking$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.openConversationFromBooking),
      switchMap(({ bookingId }) =>
        this.chatApi.getOrCreateFromBooking(bookingId).pipe(
          map((conversation) => ChatActions.openConversationFromBookingSuccess({ conversation })),
          catchError((error: unknown) =>
            of(
              ChatActions.openConversationFromBookingFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /** Navigate to the thread once it's open — kept separate so the dispatching
   * effect above stays a pure action mapper. */
  readonly navigateAfterOpenConversationFromBooking$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.openConversationFromBookingSuccess),
        tap(({ conversation }) => {
          void this.router.navigate(['/chat', conversation.id]);
        }),
      ),
    { dispatch: false },
  );

  /** Surface a failure to open/create the conversation via the global toast —
   * the button must never look like it silently did nothing. */
  readonly openConversationFromBookingErrorToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.openConversationFromBookingFailure),
        tap(({ error }) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('chat.details.openFromBookingErrorTitle'),
            detail: error,
            life: CHAT_TOAST_LIFE_MS,
          });
        }),
      ),
    { dispatch: false },
  );

  /**
   * Resolve a raw hub message against the current user (isMine) and store it.
   * When it lands in the open conversation and is not ours, mark the thread read
   * (the user is looking at it).
   */
  readonly realtimeMessageReceived$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.realtimeMessageReceived),
      withLatestFrom(
        this.store.select(selectAuthUser),
        this.store.select(selectActiveConversation),
        this.store.select(selectConversations),
      ),
      mergeMap(([{ message: raw }, user, activeConversation, conversations]) => {
        const message = toChatMessage(raw, user?.id ?? null);
        const isOpen =
          activeConversation !== null && activeConversation.id === message.conversationId;

        const actions: ReturnType<
          | typeof ChatActions.realtimeMessageResolved
          | typeof ChatActions.markConversationRead
          | typeof ChatActions.loadConversationDetails
          | typeof ChatActions.loadConversations
        >[] = [ChatActions.realtimeMessageResolved({ message })];

        // A message for a conversation that is not in the inbox yet (brand-new
        // thread): the reducer cannot build a row from it, so reconcile with the
        // server list.
        if (!conversations.some((c) => c.id === message.conversationId)) {
          actions.push(ChatActions.loadConversations());
        }

        if (isOpen && !message.isMine) {
          actions.push(
            ChatActions.markConversationRead({
              conversationId: message.conversationId,
            }),
          );
        }

        // A system line for a thread that is NOT open changes its derived status,
        // which the message alone cannot give the inbox row: reconcile once with
        // the server list (unknown threads already got this above).
        if (
          !isOpen &&
          message.type === 'system' &&
          conversations.some((c) => c.id === message.conversationId)
        ) {
          actions.push(ChatActions.loadConversations());
        }

        // A system message fires only on a real booking transition. Re-fetch the
        // open conversation so the server re-derives the authoritative `status`
        // and `isClosed` (ADR-001: "closed" also depends on both reviews being
        // in — a server-side rule). Without this the header status pill stays
        // stale (M-007). Skipped for ordinary text messages.
        if (isOpen && message.type === 'system') {
          actions.push(
            ChatActions.loadConversationDetails({
              conversationId: message.conversationId,
            }),
          );
        }

        return actions;
      }),
    ),
  );

  /**
   * A booking transition made from the rental card (approve / decline / hand over /
   * receive back / cancel) changes what the card shows. Re-fetch the open conversation so
   * the server re-derives `bookingStatus`, `turn` and `deadlineAt`; the realtime system
   * message does this too, but only if the hub is connected. Skipped when the booking is
   * not the one open in the thread (the same actions fire from the bookings pages).
   */
  readonly reloadAfterBookingAction$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        BookingsActions.approveBookingRequestSuccess,
        BookingsActions.rejectBookingRequestSuccess,
        BookingsActions.cancelBookingSuccess,
        BookingsActions.bookingActionSuccess,
      ),
      withLatestFrom(this.store.select(selectActiveConversation)),
      mergeMap(([action, active]) => {
        const bookingId = 'detail' in action ? action.detail.id : action.bookingId;
        return active !== null && active.bookingId === bookingId
          ? [ChatActions.loadConversationDetails({ conversationId: active.id })]
          : [];
      }),
    ),
  );

  /**
   * Refresh the global badge from the server right away (debounced in the
   * service) instead of waiting for the 60 s poll: a rental status change is an
   * unread message for the OTHER party, and the viewer's own action can change
   * what the server counts as unread for them (ADR-001 amendment).
   */
  readonly refreshBadge$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.realtimeMessageResolved),
        withLatestFrom(
          this.store.select(selectActiveConversation),
          this.store.select(selectConversations),
        ),
        tap(([{ message }, activeConversation, conversations]) => {
          // With the inbox loaded, a not-open system line (or an unknown thread)
          // already triggers loadConversations, whose result syncNavBadge$ turns
          // into the badge — a second GET would be redundant.
          const isOpen = activeConversation?.id === message.conversationId;
          const known = conversations.some((c) => c.id === message.conversationId);
          const inboxReloads =
            conversations.length > 0 && (!known || (!isOpen && message.type === 'system'));
          if (!inboxReloads) {
            this.chatBadge.requestRefresh();
          }
        }),
        map(([action]) => action),
      ),
    { dispatch: false },
  );

  /**
   * A badge GET that started before the thread was marked read can land after it
   * and repaint a stale count; syncNavBadge$ has the authoritative value from the
   * store, so drop whatever is still in flight.
   */
  readonly discardStaleBadgeAfterRead$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ChatActions.markConversationReadSuccess),
        withLatestFrom(this.store.select(selectConversations)),
        tap(([, conversations]) => {
          if (conversations.length > 0) {
            this.chatBadge.discardInFlight();
          } else {
            // Inbox not loaded (cold deep link): syncNavBadge$ will not repaint,
            // so ask the server for the post-read count instead.
            this.chatBadge.requestRefresh();
          }
        }),
        map(([action]) => action),
      ),
    { dispatch: false },
  );

  /** Resolve the `conversationRead` reader identity against the current user. */
  readonly realtimeConversationRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.realtimeConversationRead),
      withLatestFrom(this.store.select(selectAuthUser)),
      map(([{ conversationId, readerUserId, readAtUtc }, user]) =>
        ChatActions.realtimeConversationReadResolved({
          conversationId,
          readAtUtc,
          readerIsMe: user !== null && readerUserId === user.id,
        }),
      ),
    ),
  );

  /**
   * Keep the global nav badge in lockstep with the store whenever the chat
   * feature is loaded — so it clears instantly on read and bumps instantly on an
   * incoming message, no 60s poll. The badge sums `unreadCount` across the
   * inbox. An empty inbox means "not loaded yet" (a user in chat has at least
   * one conversation), so we skip it to avoid clobbering the cold-start count
   * that ChatRealtimeService maintains.
   */
  readonly syncNavBadge$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          ChatActions.loadConversationsSuccess,
          ChatActions.realtimeMessageResolved,
          ChatActions.realtimeConversationReadResolved,
          ChatActions.markConversationRead,
          ChatActions.markConversationReadSuccess,
        ),
        withLatestFrom(this.store.select(selectConversations)),
        tap(([, conversations]) => {
          if (conversations.length === 0) {
            return;
          }
          const total = conversations.reduce((sum, c) => sum + Math.max(0, c.unreadCount), 0);
          this.chatBadge.setUnreadCount(total);
        }),
      ),
    { dispatch: false },
  );
}
