import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { distinctUntilChanged, filter, map } from 'rxjs';

import type { ChatConversationDetails } from '../../models/chat.model';
import * as ChatActions from '../../store/chat.actions';
import {
  selectActiveConversation,
  selectActiveConversationError,
  selectActiveConversationLoading,
  selectSendingMessage,
  selectSendingMessageError,
} from '../../store/chat.selectors';

interface ConversationDetailsPageViewModel {
  readonly conversation: ChatConversationDetails | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly sendingMessage: boolean;
  readonly sendingMessageError: string | null;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectConversationDetailsPageViewModel = createSelector(
  selectActiveConversation,
  selectActiveConversationLoading,
  selectActiveConversationError,
  selectSendingMessage,
  selectSendingMessageError,
  (conversation, loading, error, sendingMessage, sendingMessageError): ConversationDetailsPageViewModel => {
    const hasError = error !== null;
    return {
      conversation,
      loading,
      error,
      sendingMessage,
      sendingMessageError,
      showInitialSkeleton: loading && conversation === null,
      showEmpty: !loading && conversation === null && !hasError,
      hasError,
    };
  },
);

@Component({
  selector: 'app-conversation-details-page',
  standalone: true,
  imports: [
    AsyncPipe,
    ButtonModule,
    DatePipe,
    InputTextModule,
    MessageModule,
    ReactiveFormsModule,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './conversation-details-page.component.html',
  styleUrl: './conversation-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationDetailsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  protected conversationId: string | null = null;

  protected readonly viewModel$ = this.store.select(
    selectConversationDetailsPageViewModel,
  );

  protected readonly messageForm = this.fb.nonNullable.group({
    content: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('conversationId')),
        filter((conversationId): conversationId is string => conversationId !== null),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((conversationId) => {
        this.conversationId = conversationId;
        this.store.dispatch(ChatActions.loadConversationDetails({ conversationId }));
      });
  }

  protected retry(): void {
    if (this.conversationId === null) {
      return;
    }
    this.store.dispatch(
      ChatActions.loadConversationDetails({ conversationId: this.conversationId }),
    );
  }

  protected sendMessage(conversationId: string): void {
    if (this.messageForm.invalid) {
      this.messageForm.markAllAsTouched();
      return;
    }

    const content = this.messageForm.controls.content.value.trim();
    if (content.length === 0) {
      return;
    }

    this.store.dispatch(ChatActions.sendMessage({ conversationId, content }));
    this.messageForm.reset({ content: '' });
  }
}
