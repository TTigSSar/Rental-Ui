import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import {
  filterConversations,
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

interface ConversationsBaseState {
  readonly conversations: ChatConversationPreview[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly totalUnread: number;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

interface ConversationsPageViewModel extends ConversationsBaseState {
  /** Conversations after applying the client-side search filter. */
  readonly filteredConversations: ChatConversationPreview[];
  readonly searchTerm: string;
  readonly showSearch: boolean;
  /** There are conversations, but the current search matches none of them. */
  readonly showNoResults: boolean;
}

const selectConversationsBaseState = createSelector(
  selectConversations,
  selectConversationsLoading,
  selectConversationsError,
  (conversations, loading, error): ConversationsBaseState => {
    const hasError = error !== null;
    return {
      conversations,
      loading,
      error,
      totalUnread: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
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
    ButtonModule,
    ChatTimeAgoPipe,
    MessageModule,
    RouterLink,
    RouterLinkActive,
    SkeletonModule,
    TranslatePipe,
    UiInputComponent,
  ],
  templateUrl: './conversations-page.component.html',
  styleUrl: './conversations-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationsPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly searchTerm$ = new BehaviorSubject<string>('');

  protected readonly viewModel$ = combineLatest({
    base: this.store.select(selectConversationsBaseState),
    searchTerm: this.searchTerm$,
  }).pipe(
    map(({ base, searchTerm }): ConversationsPageViewModel => {
      const filteredConversations = filterConversations(base.conversations, searchTerm);
      return {
        ...base,
        filteredConversations,
        searchTerm,
        showSearch: !base.showInitialSkeleton && !base.hasError && base.conversations.length > 0,
        showNoResults:
          !base.showEmpty &&
          !base.hasError &&
          base.conversations.length > 0 &&
          filteredConversations.length === 0,
      };
    }),
  );

  protected readonly statusTone = mapChatStatusTone;
  protected readonly statusLabelKey = mapChatStatusLabelKey;

  ngOnInit(): void {
    this.store.dispatch(ChatActions.loadConversations());
  }

  protected retry(): void {
    this.store.dispatch(ChatActions.loadConversations());
  }

  protected onSearch(term: string): void {
    this.searchTerm$.next(term);
  }
}
