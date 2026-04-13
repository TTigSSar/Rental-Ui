import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import type { ChatConversationPreview } from '../../models/chat.model';
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
    ButtonModule,
    CardModule,
    DatePipe,
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

  ngOnInit(): void {
    this.store.dispatch(ChatActions.loadConversations());
  }

  protected retry(): void {
    this.store.dispatch(ChatActions.loadConversations());
  }
}
