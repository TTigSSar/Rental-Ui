import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  concatMap,
  map,
  mergeMap,
  of,
  switchMap,
  tap,
  withLatestFrom,
} from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type {
  ChatMessage,
  ChatRealtimeMessage,
} from '../models/chat.model';
import { ChatBadgeService } from '../services/chat-badge.service';
import { ChatApiService } from '../services/chat-api.service';
import * as ChatActions from './chat.actions';
import {
  selectActiveConversation,
  selectConversations,
} from './chat.selectors';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

/** Map a viewer-neutral hub message to the local, viewer-relative shape. */
function toChatMessage(
  raw: ChatRealtimeMessage,
  currentUserId: string | null,
): ChatMessage {
  return {
    ...raw,
    isMine: raw.senderId !== null && raw.senderId === currentUserId,
    seen: false,
  };
}

@Injectable()
export class ChatEffects {
  private readonly actions$ = inject(Actions);
  private readonly chatApi = inject(ChatApiService);
  private readonly store = inject(Store);
  private readonly chatBadge = inject(ChatBadgeService);

  readonly loadConversations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadConversations),
      switchMap(() =>
        this.chatApi.getConversations().pipe(
          map((conversations) =>
            ChatActions.loadConversationsSuccess({ conversations }),
          ),
          catchError((error: unknown) =>
            of(
              ChatActions.loadConversationsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadConversationDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.loadConversationDetails),
      switchMap(({ conversationId }) =>
        this.chatApi.getConversationDetails(conversationId).pipe(
          map((conversation) =>
            ChatActions.loadConversationDetailsSuccess({ conversation }),
          ),
          catchError((error: unknown) =>
            of(
              ChatActions.loadConversationDetailsFailure({
                error: toErrorMessage(error),
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
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
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
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
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
      ),
      mergeMap(([{ message: raw }, user, activeConversation]) => {
        const message = toChatMessage(raw, user?.id ?? null);
        const isOpen =
          activeConversation !== null &&
          activeConversation.id === message.conversationId;

        const actions: ReturnType<
          | typeof ChatActions.realtimeMessageResolved
          | typeof ChatActions.markConversationRead
        >[] = [ChatActions.realtimeMessageResolved({ message })];

        if (isOpen && !message.isMine) {
          actions.push(
            ChatActions.markConversationRead({
              conversationId: message.conversationId,
            }),
          );
        }

        return actions;
      }),
    ),
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
          const total = conversations.reduce(
            (sum, c) => sum + Math.max(0, c.unreadCount),
            0,
          );
          this.chatBadge.setUnreadCount(total);
        }),
      ),
    { dispatch: false },
  );
}
