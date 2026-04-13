import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, concatMap, map, of, switchMap } from 'rxjs';

import { ChatApiService } from '../services/chat-api.service';
import * as ChatActions from './chat.actions';

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }
    return error.message.length > 0 ? error.message : 'Request failed';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

@Injectable()
export class ChatEffects {
  private readonly actions$ = inject(Actions);
  private readonly chatApi = inject(ChatApiService);

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
        this.chatApi.sendMessage(conversationId, { content }).pipe(
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
}
