import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import {
  mapChatStatusLabelKey,
  mapChatStatusTone,
} from '../../models/chat-ui.util';
import type { ChatConversationPreview } from '../../models/chat.model';
import { ChatTimeAgoPipe } from '../../pipes/chat-time-ago.pipe';
import * as ChatActions from '../../store/chat.actions';
import {
  selectConversations,
  selectConversationsError,
  selectConversationsLoading,
} from '../../store/chat.selectors';

interface ConversationsPageViewModel {
  readonly conversations: ChatConversationPreview[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectConversationsPageViewModel = createSelector(
  selectConversations,
  selectConversationsLoading,
  selectConversationsError,
  (conversations, loading, error): ConversationsPageViewModel => {
    const hasError = error !== null;
    return {
      conversations,
      loading,
      error,
      showInitialSkeleton: loading && conversations.length === 0,
      showEmpty: !loading && conversations.length === 0 && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-conversations-page',
  standalone: true,
  imports: [
    AsyncPipe,
    AvatarComponent,
    BadgeComponent,
    ButtonModule,
    ChatTimeAgoPipe,
    MessageModule,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './conversations-page.component.html',
  styleUrl: './conversations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationsPageComponent implements OnInit {
  private readonly store = inject(Store);

  protected readonly viewModel$ = this.store.select(
    selectConversationsPageViewModel,
  );

  protected readonly statusTone = mapChatStatusTone;
  protected readonly statusLabelKey = mapChatStatusLabelKey;

  ngOnInit(): void {
    this.store.dispatch(ChatActions.loadConversations());
  }

  protected retry(): void {
    this.store.dispatch(ChatActions.loadConversations());
  }
}
