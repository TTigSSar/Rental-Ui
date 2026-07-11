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

  /**
   * Sends an image attachment (multipart/form-data). The field names mirror the
   * backend `UploadChatImageRequest` (`Image`, `Caption`); the FormData is built
   * inline, matching `ListingsApiService.uploadListingImages`. The caller
   * compresses and validates the file first (see `CHAT_ATTACHMENT_MAX_BYTES` /
   * `CHAT_ATTACHMENT_ALLOWED_TYPES`); the server re-validates regardless.
   * Returns the same `ChatMessage` shape as the text send.
   */
  sendImageMessage(
    conversationId: string,
    image: File,
    caption: string | null,
  ): Observable<ChatMessage> {
    const formData = new FormData();
    formData.append('Image', image, image.name);
    if (caption !== null && caption.length > 0) {
      formData.append('Caption', caption);
    }

    return this.http.post<ChatMessage>(
      toApiUrl(ApiContract.chat.sendImageMessage(conversationId)),
      formData,
    );
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
