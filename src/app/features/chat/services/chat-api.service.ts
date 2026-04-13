import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  ChatConversationDetails,
  ChatConversationPreview,
  ChatMessage,
  SendChatMessageRequest,
} from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/chat';

  getConversations(): Observable<ChatConversationPreview[]> {
    return this.http.get<ChatConversationPreview[]>(
      `${this.baseUrl}/conversations`,
    );
  }

  getConversationDetails(conversationId: string): Observable<ChatConversationDetails> {
    const url = `${this.baseUrl}/conversations/${encodeURIComponent(conversationId)}`;
    return this.http.get<ChatConversationDetails>(url);
  }

  sendMessage(
    conversationId: string,
    payload: SendChatMessageRequest,
  ): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/messages`, {
      conversationId,
      ...payload,
    });
  }
}
