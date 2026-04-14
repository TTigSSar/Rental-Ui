import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  ChatConversationDetails,
  ChatConversationPreview,
  ChatMessage,
  SendChatMessageRequest,
} from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);

  getConversations(): Observable<ChatConversationPreview[]> {
    return this.http.get<ChatConversationPreview[]>(toApiUrl(ApiContract.chat.conversations));
  }

  getConversationDetails(conversationId: string): Observable<ChatConversationDetails> {
    return this.http.get<ChatConversationDetails>(
      toApiUrl(ApiContract.chat.conversationById(conversationId)),
    );
  }

  sendMessage(
    conversationId: string,
    payload: SendChatMessageRequest,
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(toApiUrl(ApiContract.chat.messages), {
      conversationId,
      ...payload,
    });
  }
}
