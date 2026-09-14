import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { catchError, concatMap, filter, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type { ChatMessage, ChatRealtimeMessage } from '../../chat/models/chat.model';
import { ChatApiService } from '../../chat/services/chat-api.service';
import * as ChatActions from '../../chat/store/chat.actions';
import { AdminMessagesApiService } from '../services/admin-messages-api.service';
import * as AdminMessagesActions from './admin-messages.actions';
import {
  selectMessageThreadItems,
  selectMessageThreadRequestParams,
  selectSelectedThreadId,
} from './admin-messages.selectors';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

/** Map a viewer-neutral hub message to the local, viewer-relative shape — same mapping
 *  `ChatEffects`'s (private) `toChatMessage` does, duplicated here rather than exported from
 *  the chat feature since it's a two-line pure function, not shared state. */
function toChatMessage(raw: ChatRealtimeMessage, currentUserId: string | null): ChatMessage {
  return {
    ...raw,
    isMine: raw.senderId !== null && raw.senderId === currentUserId,
    seen: false,
  };
}

const TOAST_LIFE_MS = 7000;

@Injectable()
export class AdminMessagesEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly messagesApi = inject(AdminMessagesApiService);
  private readonly chatApi = inject(ChatApiService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  // ── Queue ──
  readonly loadMessageThreads$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.loadMessageThreads),
      withLatestFrom(this.store.select(selectMessageThreadRequestParams)),
      switchMap(([, params]) =>
        this.messagesApi.getThreads(params).pipe(
          map((queue) => AdminMessagesActions.loadMessageThreadsSuccess({ queue })),
          catchError((error: unknown) =>
            of(AdminMessagesActions.loadMessageThreadsFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  /** Filter-tab switches, the debounced search, and page changes all just re-run the current
   *  query — same idiom as `AdminReportsEffects.reloadOnFilterChange$`. */
  readonly reloadOnFilterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        AdminMessagesActions.setMessageThreadFilter,
        AdminMessagesActions.setMessageThreadSearch,
        AdminMessagesActions.setMessageThreadPage,
      ),
      map(() => AdminMessagesActions.loadMessageThreads()),
    ),
  );

  // ── Thread selection / detail (reuses ChatApiService) ──
  readonly loadThreadDetail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.selectMessageThread),
      switchMap(({ conversationId }) =>
        this.chatApi.getConversationDetails(conversationId).pipe(
          map((conversation) => AdminMessagesActions.loadMessageThreadDetailSuccess({ conversation })),
          catchError((error: unknown) =>
            of(
              AdminMessagesActions.loadMessageThreadDetailFailure({ error: toErrorMessage(error) }),
            ),
          ),
        ),
      ),
    ),
  );

  /** Selecting a thread also marks it read — chained action, same "dispatch the next intent"
   *  idiom as `AdminReportsEffects.refetchAfterMutation$`. */
  readonly markReadOnSelect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.selectMessageThread),
      map(({ conversationId }) => AdminMessagesActions.markMessageThreadRead({ conversationId })),
    ),
  );

  /** A realtime message from the member landing on the thread the admin currently has open
   *  marks it read immediately — same "isOpen && !mine" idea as `ChatEffects.realtimeMessageReceived$`,
   *  but keyed off the thread's `memberId` (not the current admin's own identity) since
   *  "needs reply" is about the member vs. the moderator side, not any one specific admin. */
  readonly markReadOnLiveThread$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.threadMessageReceived),
      withLatestFrom(
        this.store.select(selectSelectedThreadId),
        this.store.select(selectMessageThreadItems),
      ),
      filter(([{ message }, selectedThreadId]) => selectedThreadId === message.conversationId),
      map(([{ message }, , items]) => ({
        message,
        thread: items.find((item) => item.conversationId === message.conversationId),
      })),
      filter(
        ({ message, thread }) =>
          thread !== undefined && message.senderId !== null && message.senderId === thread.memberId,
      ),
      map(({ message }) =>
        AdminMessagesActions.markMessageThreadRead({ conversationId: message.conversationId }),
      ),
    ),
  );

  readonly markThreadRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.markMessageThreadRead),
      mergeMap(({ conversationId }) =>
        this.chatApi.markRead(conversationId).pipe(
          map(() => AdminMessagesActions.markMessageThreadReadSuccess({ conversationId })),
          catchError((error: unknown) =>
            of(AdminMessagesActions.markMessageThreadReadFailure({ error: toErrorMessage(error) })),
          ),
        ),
      ),
    ),
  );

  // ── Send (reuses ChatApiService) ──
  readonly sendMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.sendMessageThreadMessage),
      concatMap(({ conversationId, content }) =>
        this.chatApi.sendMessage(conversationId, content).pipe(
          map((message) => AdminMessagesActions.sendMessageThreadMessageSuccess({ message })),
          catchError((error: unknown) =>
            of(
              AdminMessagesActions.sendMessageThreadMessageFailure({ error: toErrorMessage(error) }),
            ),
          ),
        ),
      ),
    ),
  );

  // ── Open-for-user (get-or-create) ──
  readonly openThreadForUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.openMessageThreadForUser),
      mergeMap(({ userId }) =>
        this.messagesApi.openThreadForUser(userId).pipe(
          map((thread) => AdminMessagesActions.openMessageThreadForUserSuccess({ thread })),
          catchError((error: unknown) =>
            of(
              AdminMessagesActions.openMessageThreadForUserFailure({ error: toErrorMessage(error) }),
            ),
          ),
        ),
      ),
    ),
  );

  /** Once the thread is open (created or found), select it so its detail loads too. */
  readonly selectAfterOpen$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminMessagesActions.openMessageThreadForUserSuccess),
      map(({ thread }) =>
        AdminMessagesActions.selectMessageThread({ conversationId: thread.conversationId }),
      ),
    ),
  );

  // ── Realtime — `ChatRealtimeService` (root-provided, started by the app shell on sign-in) is
  // already connected on `/admin` and dispatches these two actions globally; no second SignalR
  // connection here. ──
  readonly realtimeMessage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.realtimeMessageReceived),
      withLatestFrom(this.store.select(selectAuthUser)),
      map(([{ message: raw }, user]) =>
        AdminMessagesActions.threadMessageReceived({
          message: toChatMessage(raw, user?.id ?? null),
        }),
      ),
    ),
  );

  readonly realtimeRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChatActions.realtimeConversationRead),
      withLatestFrom(this.store.select(selectAuthUser)),
      map(([{ conversationId, readerUserId, readAtUtc }, user]) =>
        AdminMessagesActions.threadReadReceived({
          conversationId,
          readAtUtc,
          readerIsAdmin: user !== null && readerUserId === user.id,
        }),
      ),
    ),
  );

  // ── Toasts ──
  readonly sendFailureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AdminMessagesActions.sendMessageThreadMessageFailure),
        tap(({ error }) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('admin.messages.toast.sendFailureTitle'),
            detail: error,
            life: TOAST_LIFE_MS,
          });
        }),
      ),
    { dispatch: false },
  );

  readonly openFailureToast$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AdminMessagesActions.openMessageThreadForUserFailure),
        tap(({ error }) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('admin.messages.toast.openFailureTitle'),
            detail: error,
            life: TOAST_LIFE_MS,
          });
        }),
      ),
    { dispatch: false },
  );
}
