import { AsyncPipe, DatePipe } from '@angular/common';
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, filter, map } from 'rxjs';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { compressImageFile } from '../../../../shared/utils/image-compression.utils';
import {
  type ChatDayLabel,
  type ChatSystemMeta,
  chatDayKey,
  chatDayLabel,
  mapChatStatusIcon,
  mapChatStatusLabelKey,
  mapChatStatusTone,
  mapChatSystemMeta,
} from '../../models/chat-ui.util';
import {
  CHAT_ATTACHMENT_ALLOWED_TYPES,
  CHAT_ATTACHMENT_MAX_BYTES,
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatConversationDetails,
  type ChatMessage,
} from '../../models/chat.model';
import * as ChatActions from '../../store/chat.actions';
import {
  selectActiveConversation,
  selectActiveConversationError,
  selectActiveConversationLoading,
  selectPendingImage,
  selectSendingImageError,
  selectSendingMessage,
  selectSendingMessageError,
} from '../../store/chat.selectors';
import type { PendingChatImage } from '../../store/chat.state';

/** A run of consecutive same-sender text/image messages, rendered as a bubble stack. */
interface MessageGroup {
  readonly kind: 'group';
  readonly id: string;
  readonly isMine: boolean;
  readonly senderName: string | null;
  readonly messages: ChatMessage[];
  readonly time: string;
  /** Last own message in the thread AND read by the counterpart → "✓ Seen". */
  readonly showSeen: boolean;
  /** Last own message in the thread, not yet read → bare muted delivery tick. */
  readonly showSent: boolean;
}

/** The booking context threaded into the enriched `request` system line. */
interface SystemRequestContext {
  readonly counterpartName: string;
  readonly bookingDates: string;
  readonly bookingPrice: number;
}

/** A centered inline system event (no bubble). */
interface SystemLine {
  readonly kind: 'system';
  readonly id: string;
  readonly meta: ChatSystemMeta;
  readonly body: string | null;
  /**
   * True when {@link meta} fell through to the generic default (no recognized
   * `systemKind`). Only then is the raw {@link body} shown as a fallback; a
   * mapped event renders solely its localized label.
   */
  readonly isGeneric: boolean;
  /**
   * Booking context for the `request` kind only — rendered as an enriched pill
   * ("{name} requested this toy · {dates} · {price}"). Null for every other
   * system kind, which keeps its single localized label.
   */
  readonly request: SystemRequestContext | null;
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
  /** Optimistic image bubble for THIS conversation (uploading or failed). */
  readonly pendingImage: PendingChatImage | null;
  readonly sendingImageError: string | null;
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

function buildThreadItems(conversation: ChatConversationDetails): ThreadItem[] {
  const messages = conversation.messages;
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
      const meta = mapChatSystemMeta(message.systemKind);
      items.push({
        kind: 'system',
        id: message.id,
        meta,
        body: message.body,
        isGeneric: meta.labelKey === 'chat.system.default',
        request:
          message.systemKind === 'request'
            ? {
                counterpartName: conversation.counterpartName,
                bookingDates: conversation.bookingDates,
                bookingPrice: conversation.bookingPrice,
              }
            : null,
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
      showSent: false,
    });
  }

  // Finalise each group's footer (time from last message, seen marker).
  return items.map((item) => {
    if (item.kind !== 'group') {
      return item;
    }
    const last = item.messages[item.messages.length - 1];
    const isLastMine = item.isMine && last.id === lastMineId;
    return {
      ...item,
      time: last.sentAt,
      showSeen: isLastMine && last.seen,
      showSent: isLastMine && !last.seen,
    };
  });
}

@Component({
  selector: 'app-conversation-details-page',
  standalone: true,
  imports: [
    AsyncPipe,
    AvatarComponent,
    ButtonModule,
    DramCurrencyPipe,
    DatePipe,
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
  private readonly translate = inject(TranslateService);
  private readonly routeConversationId$ = this.route.paramMap.pipe(
    map((params) => params.get('conversationId')),
    distinctUntilChanged(),
  );

  protected readonly statusTone = mapChatStatusTone;
  protected readonly statusLabelKey = mapChatStatusLabelKey;
  protected readonly statusIcon = mapChatStatusIcon;

  /**
   * First name of the counterpart, for the personalised composer placeholder
   * ("Message Anna…"). Falls back to the whole string when the name is a single
   * token — never empty, so the placeholder never reads "Message …".
   */
  protected firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name;
  }

  protected readonly viewModel$ = combineLatest({
    routeState: this.store.select(selectConversationDetailsRouteState),
    sendingMessage: this.store.select(selectSendingMessage),
    sendingMessageError: this.store.select(selectSendingMessageError),
    pendingImage: this.store.select(selectPendingImage),
    sendingImageError: this.store.select(selectSendingImageError),
    routeConversationId: this.routeConversationId$,
  }).pipe(
    map(
      ({
        routeState,
        sendingMessage,
        sendingMessageError,
        pendingImage,
        sendingImageError,
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
          threadItems: activeConversation ? buildThreadItems(activeConversation) : [],
          loading: routeState.loading,
          error: routeState.error,
          sendingMessage,
          sendingMessageError,
          pendingImage:
            pendingImage !== null &&
            activeConversation !== null &&
            pendingImage.conversationId === activeConversation.id
              ? pendingImage
              : null,
          sendingImageError,
          showInitialSkeleton: routeState.loading && !isMatch,
          showEmpty: !routeState.loading && !isMatch && !hasError,
          hasError,
        };
      },
    ),
  );

  protected readonly messageForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(CHAT_MESSAGE_MAX_LENGTH)]],
  });

  /** Character limit for a chat message (mirrors the backend cap). */
  protected readonly maxMessageLength = CHAT_MESSAGE_MAX_LENGTH;

  /**
   * Below this the counter stays hidden to avoid noise on short messages; at and
   * above it the composer shows the live count. (90% of the limit.)
   */
  protected readonly counterVisibleThreshold = 3500;

  /**
   * Live length of the composer content. Derived from the reactive control's
   * value stream — declared as a field initializer so `toSignal` runs inside the
   * component's injection context (see knowledge/mistakes.md M-004).
   */
  protected readonly messageLength = toSignal(
    this.messageForm.controls.content.valueChanges.pipe(map((value) => value.length)),
    { initialValue: 0 },
  );

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
        vm.conversation
          ? `${vm.conversation.id}:${vm.conversation.messages.length}:${
              vm.pendingImage ? vm.pendingImage.previewUrl : ''
            }`
          : null,
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

  /**
   * Picks an image attachment, validates it client-side, compresses it and hands
   * it to the store for upload. Validation mirrors the backend's rules
   * (`CHAT_ATTACHMENT_ALLOWED_TYPES` / `CHAT_ATTACHMENT_MAX_BYTES`) so an
   * obviously-bad file never leaves the browser; the server re-validates by
   * magic bytes regardless. The size check runs on the COMPRESSED file — that is
   * the payload the server actually receives (a 9 MB phone photo compresses well
   * under the cap and must not be rejected here).
   *
   * The composer text, if any, travels with the image as its caption.
   */
  protected async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Reset immediately so re-picking the same file fires `change` again.
    input.value = '';

    const conversationId = this.route.snapshot.paramMap.get('conversationId');
    if (file === null || conversationId === null) {
      return;
    }

    if (!this.isAllowedAttachmentType(file.type)) {
      this.failImage('chat.details.imageInvalidType');
      return;
    }

    const compressed = await compressImageFile(file);
    if (compressed.size > CHAT_ATTACHMENT_MAX_BYTES) {
      this.failImage('chat.details.imageTooLarge', {
        max: Math.round(CHAT_ATTACHMENT_MAX_BYTES / (1024 * 1024)),
      });
      return;
    }

    const caption = this.messageForm.controls.content.value.trim();
    this.store.dispatch(
      ChatActions.sendImageMessage({
        conversationId,
        file: compressed,
        caption: caption.length > 0 ? caption : null,
        previewUrl: URL.createObjectURL(compressed),
      }),
    );
    this.messageForm.reset({ content: '' });
  }

  /** Clears a failed optimistic image bubble (and its error banner). */
  protected dismissPendingImage(): void {
    this.store.dispatch(ChatActions.dismissPendingImage());
  }

  private isAllowedAttachmentType(type: string): boolean {
    return (CHAT_ATTACHMENT_ALLOWED_TYPES as readonly string[]).includes(type);
  }

  /** Reports a client-side rejection through the same failure path as the server's. */
  private failImage(messageKey: string, params?: Record<string, unknown>): void {
    this.store.dispatch(
      ChatActions.sendImageMessageFailure({
        error: this.translate.instant(messageKey, params),
      }),
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
