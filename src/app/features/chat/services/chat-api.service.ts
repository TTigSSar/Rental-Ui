import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  ChatConversationDetails,
  ChatConversationPreview,
  ChatMessage,
} from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);

  getConversations(): Observable<ChatConversationPreview[]> {
    return this.http.get<ChatConversationPreview[]>(
      toApiUrl(ApiContract.chat.conversations),
    );
  }

  getConversationDetails(
    conversationId: string,
  ): Observable<ChatConversationDetails> {
    return this.http.get<ChatConversationDetails>(
      toApiUrl(ApiContract.chat.conversationById(conversationId)),
    );
  }

  sendMessage(conversationId: string, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(toApiUrl(ApiContract.chat.messages), {
      conversationId,
      content,
    });
  }

  markRead(conversationId: string): Observable<void> {
    return this.http.post<void>(
      toApiUrl(ApiContract.chat.read(conversationId)),
      {},
    );
  }

  getOrCreateFromBooking(
    bookingId: string,
  ): Observable<ChatConversationDetails> {
    return this.http.post<ChatConversationDetails>(
      toApiUrl(ApiContract.chat.fromBooking(bookingId)),
      {},
    );
  }
}
