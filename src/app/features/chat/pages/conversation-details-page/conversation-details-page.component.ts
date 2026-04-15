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
import { combineLatest, distinctUntilChanged, filter, map } from 'rxjs';

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
  readonly routeConversationId: string | null;
  readonly conversation: ChatConversationDetails | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly sendingMessage: boolean;
  readonly sendingMessageError: string | null;
  readonly showInitialSkeleton: boolean;
  readonly showEmpty: boolean;
  readonly hasError: boolean;
}

const selectConversationDetailsRouteState = createSelector(
  selectActiveConversation,
  selectActiveConversationLoading,
  selectActiveConversationError,
  (conversation, loading, error): {
    readonly conversation: ChatConversationDetails | null;
    readonly loading: boolean;
    readonly error: string | null;
  } => ({
    conversation,
    loading,
    error,
  }),
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
  private readonly routeConversationId$ = this.route.paramMap.pipe(
    map((params) => params.get('conversationId')),
    distinctUntilChanged(),
  );

  protected readonly viewModel$ = combineLatest({
    routeState: this.store.select(selectConversationDetailsRouteState),
    sendingMessage: this.store.select(selectSendingMessage),
    sendingMessageError: this.store.select(selectSendingMessageError),
    routeConversationId: this.routeConversationId$,
  }).pipe(
    map(
      ({
        routeState,
        sendingMessage,
        sendingMessageError,
        routeConversationId,
      }): ConversationDetailsPageViewModel => {
        const conversation = routeState.conversation;
        const isMatch =
          conversation !== null &&
          routeConversationId !== null &&
          conversation.id === routeConversationId;
        const hasError = routeState.error !== null;

        return {
          routeConversationId,
          conversation: isMatch ? conversation : null,
          loading: routeState.loading,
          error: routeState.error,
          sendingMessage,
          sendingMessageError,
          showInitialSkeleton: routeState.loading && !isMatch,
          showEmpty: !routeState.loading && !isMatch && !hasError,
          hasError,
        };
      },
    ),
  );

  protected readonly messageForm = this.fb.nonNullable.group({
    content: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.routeConversationId$
      .pipe(
        filter((conversationId): conversationId is string => conversationId !== null),
        takeUntilDestroyed(),
      )
      .subscribe((conversationId) => {
        this.store.dispatch(ChatActions.loadConversationDetails({ conversationId }));
      });
  }

  protected retry(): void {
    const routeConversationId = this.route.snapshot.paramMap.get('conversationId');
    if (routeConversationId === null) {
      return;
    }
    this.store.dispatch(
      ChatActions.loadConversationDetails({ conversationId: routeConversationId }),
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
