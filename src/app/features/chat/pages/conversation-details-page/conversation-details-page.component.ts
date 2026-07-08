import { AsyncPipe, CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, filter, map } from 'rxjs';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import {
  type ChatDayLabel,
  type ChatSystemMeta,
  chatDayKey,
  chatDayLabel,
  mapChatStatusLabelKey,
  mapChatStatusTone,
  mapChatSystemMeta,
} from '../../models/chat-ui.util';
import type { ChatConversationDetails, ChatMessage } from '../../models/chat.model';
import { ChatTimeAgoPipe } from '../../pipes/chat-time-ago.pipe';
import * as ChatActions from '../../store/chat.actions';
import {
  selectActiveConversation,
  selectActiveConversationError,
  selectActiveConversationLoading,
  selectSendingMessage,
  selectSendingMessageError,
} from '../../store/chat.selectors';

/** A run of consecutive same-sender text/image messages, rendered as a bubble stack. */
interface MessageGroup {
  readonly kind: 'group';
  readonly id: string;
  readonly isMine: boolean;
  readonly senderName: string | null;
  readonly messages: ChatMessage[];
  readonly time: string;
  readonly showSeen: boolean;
}

/** A centered inline system event (no bubble). */
interface SystemLine {
  readonly kind: 'system';
  readonly id: string;
  readonly meta: ChatSystemMeta;
  readonly body: string | null;
}

/** A centered calendar-day separator inserted between messages of different days. */
interface DayDivider {
  readonly kind: 'day';
  readonly id: string;
  /** Translate key for Today / Yesterday, or null when an absolute date is used. */
  readonly labelKey: string | null;
  /** Pre-formatted absolute date (weekday or day-month), or null for Today/Yesterday. */
  readonly labelText: string | null;
}

/** Flattens a {@link ChatDayLabel} into template-friendly key/text fields. */
function toDayDividerFields(label: ChatDayLabel): {
  labelKey: string | null;
  labelText: string | null;
} {
  switch (label.kind) {
    case 'today':
      return { labelKey: 'chat.details.dayToday', labelText: null };
    case 'yesterday':
      return { labelKey: 'chat.details.dayYesterday', labelText: null };
    default:
      return { labelKey: null, labelText: label.text };
  }
}

type ThreadItem = MessageGroup | SystemLine | DayDivider;

interface ConversationDetailsPageViewModel {
  readonly routeConversationId: string | null;
  readonly conversation: ChatConversationDetails | null;
  readonly threadItems: ThreadItem[];
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
  (
    conversation,
    loading,
    error,
  ): {
    readonly conversation: ChatConversationDetails | null;
    readonly loading: boolean;
    readonly error: string | null;
  } => ({
    conversation,
    loading,
    error,
  }),
);

function buildThreadItems(messages: ChatMessage[]): ThreadItem[] {
  const items: ThreadItem[] = [];

  // Index of the last message the current user sent — used for the "Seen" marker.
  let lastMineId: string | null = null;
  for (const message of messages) {
    if (message.isMine && message.type !== 'system') {
      lastMineId = message.id;
    }
  }

  // Track the local calendar day so a divider is emitted whenever it changes.
  // Pushing the divider also breaks message grouping across a day boundary,
  // because the item preceding the next message is then the divider, not a group.
  let currentDayKey: string | null = null;

  for (const message of messages) {
    const dayKey = chatDayKey(message.sentAt);
    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      items.push({
        kind: 'day',
        id: `day:${dayKey}`,
        ...toDayDividerFields(chatDayLabel(message.sentAt)),
      });
    }

    if (message.type === 'system') {
      items.push({
        kind: 'system',
        id: message.id,
        meta: mapChatSystemMeta(message.systemKind),
        body: message.body,
      });
      continue;
    }

    const previous = items[items.length - 1];
    if (
      previous &&
      previous.kind === 'group' &&
      previous.isMine === message.isMine &&
      previous.senderName === message.senderName
    ) {
      previous.messages.push(message);
      continue;
    }

    items.push({
      kind: 'group',
      id: message.id,
      isMine: message.isMine,
      senderName: message.senderName,
      messages: [message],
      time: '',
      showSeen: false,
    });
  }

  // Finalise each group's footer (time from last message, seen marker).
  return items.map((item) => {
    if (item.kind !== 'group') {
      return item;
    }
    const last = item.messages[item.messages.length - 1];
    return {
      ...item,
      time: last.sentAt,
      showSeen: item.isMine && last.id === lastMineId && last.seen,
    };
  });
}

@Component({
  selector: 'app-conversation-details-page',
  standalone: true,
  imports: [
    AsyncPipe,
    AvatarComponent,
    BadgeComponent,
    ButtonModule,
    ChatTimeAgoPipe,
    CurrencyPipe,
    MessageModule,
    ReactiveFormsModule,
    RouterLink,
    SkeletonModule,
    TranslatePipe,
    UiInputComponent,
  ],
  templateUrl: './conversation-details-page.component.html',
  styleUrl: './conversation-details-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationDetailsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(Store);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeConversationId$ = this.route.paramMap.pipe(
    map((params) => params.get('conversationId')),
    distinctUntilChanged(),
  );

  protected readonly statusTone = mapChatStatusTone;
  protected readonly statusLabelKey = mapChatStatusLabelKey;

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
        const activeConversation = isMatch ? conversation : null;

        return {
          routeConversationId,
          conversation: activeConversation,
          threadItems: activeConversation ? buildThreadItems(activeConversation.messages) : [],
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

  /** The scrollable message pane, resolved once the conversation renders. */
  private readonly messagesPane = viewChild<ElementRef<HTMLElement>>('messagesPane');

  /**
   * A signature that changes only when the rendered thread changes — a new
   * conversation loads or a message is appended. Reading it in the render effect
   * scopes the auto-scroll to those events, so we don't fight the user on every
   * change-detection pass.
   */
  private readonly threadScrollKey = toSignal(
    this.viewModel$.pipe(
      map((vm) =>
        vm.conversation ? `${vm.conversation.id}:${vm.conversation.messages.length}` : null,
      ),
      distinctUntilChanged(),
    ),
  );

  constructor() {
    // Pin the pane to the newest message. afterRenderEffect runs after the DOM
    // has been updated, so scrollHeight already reflects freshly appended
    // messages (initial load and post-send alike).
    afterRenderEffect(() => {
      const key = this.threadScrollKey();
      const pane = this.messagesPane()?.nativeElement;
      if (key == null || !pane) {
        return;
      }
      pane.scrollTop = pane.scrollHeight;
    });
  }

  ngOnInit(): void {
    this.routeConversationId$
      .pipe(
        filter((conversationId): conversationId is string => conversationId !== null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((conversationId) => {
        this.store.dispatch(ChatActions.loadConversationDetails({ conversationId }));
        this.store.dispatch(ChatActions.markConversationRead({ conversationId }));
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
