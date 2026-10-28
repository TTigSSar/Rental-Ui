import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store, createSelector } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, filter, map } from 'rxjs';

import { selectHomePoint } from '../../../auth/store/auth.selectors';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import {
  LocationPickerComponent,
  type LocationPickerMeetingPoint,
} from '../../../../shared/ui/location-picker/location-picker.component';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';
import { YEREVAN_CENTER } from '../../../../shared/ui/map/map.constants';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { compressImageFile } from '../../../../shared/utils/image-compression.utils';
import { MeetingPointBubbleComponent } from '../../components/meeting-point-bubble/meeting-point-bubble.component';
import {
  type MeetingPointChoice,
  MeetingPointChooserComponent,
} from '../../components/meeting-point-chooser/meeting-point-chooser.component';
import { ModerationNoteCardComponent } from '../../components/moderation-note-card/moderation-note-card.component';
import { RentalCardComponent } from '../../components/rental-card/rental-card.component';
import {
  type ChatDayLabel,
  type ChatSystemMeta,
  chatDayKey,
  chatDayLabel,
  canShareMeetingPoint,
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
  selectPendingMeetingPoint,
  selectSendingImageError,
  selectSendingMessage,
  selectSendingMessageError,
} from '../../store/chat.selectors';
import type { PendingChatImage, PendingMeetingPoint } from '../../store/chat.state';
import { UiDatePipe } from '../../../../shared/utils/ui-date.pipe';
import { UiDateService } from '../../../../shared/utils/ui-date';

/**
 * Rental-card layout breakpoints (keep in sync with the media queries in the scss).
 *   >= 1280  the card lives in its own right column and is never compact;
 *   768-1279 the card sits under the header; it collapses only when it is too tall;
 *   <  768   the card is also pinned collapsed while the feed is scrolled away from the bottom.
 */
const RENTAL_COLUMN_MIN_WIDTH = 1280;
const RENTAL_MOBILE_MAX_WIDTH = 768;
/** A card taller than this share of the viewport collapses to the compact row. */
const RENTAL_TALL_RATIO = 0.45;
/** Within this many px of the end the feed counts as "at the bottom". */
const FEED_BOTTOM_TOLERANCE_PX = 48;

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
  /** Owner view names the requesting renter; renter view says "You requested…". */
  readonly textKey: 'chat.system.requestDetail' | 'chat.system.requestDetailYou';
  /** Set for the owner view only; the renter view says "You" and needs no name. */
  readonly requesterName: string | null;
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

/**
 * A `type === 'moderationNote'` message — rendered as the distinct
 * `app-moderation-note-card`, never grouped into a bubble stack like a
 * text/image message.
 */
interface NoteItem {
  readonly kind: 'note';
  readonly id: string;
  readonly message: ChatMessage;
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

type ThreadItem = MessageGroup | SystemLine | DayDivider | NoteItem;

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
  /** The share in flight / just failed for THIS conversation (ADR-053). */
  readonly pendingMeetingPoint: PendingMeetingPoint | null;
  /** Owner of an Approved/Active booking in a live chat: the composer shows the pin. */
  readonly canShareMeetingPoint: boolean;
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

function buildThreadItems(conversation: ChatConversationDetails, lang: string): ThreadItem[] {
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
        ...toDayDividerFields(chatDayLabel(message.sentAt, lang)),
      });
    }

    if (message.type === 'moderationNote') {
      items.push({ kind: 'note', id: message.id, message });
      continue;
    }

    if (message.type === 'system') {
      const meta = mapChatSystemMeta(message.systemKind);
      // `bookingDates`/`bookingPrice` are null for a Moderation conversation
      // (no linked booking) — a `request` system kind should never occur there
      // in practice, but the enriched pill only ever renders when both are
      // genuinely present; otherwise the line falls back to its plain
      // localized label like any other non-enriched system kind.
      items.push({
        kind: 'system',
        id: message.id,
        meta,
        body: message.body,
        isGeneric: meta.labelKey === 'chat.system.default',
        request:
          message.systemKind === 'request' &&
          conversation.bookingDates !== null &&
          conversation.bookingPrice !== null &&
          conversation.viewerRole !== null
            ? {
                // The requester is always the renter: for the owner that is the
                // counterpart; for the renter it is the viewer ("You").
                textKey:
                  conversation.viewerRole === 'owner'
                    ? 'chat.system.requestDetail'
                    : 'chat.system.requestDetailYou',
                requesterName:
                  conversation.viewerRole === 'owner' ? conversation.counterpartName : null,
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
    UiDatePipe,
    IconComponent,
    MessageModule,
    ModerationNoteCardComponent,
    ReactiveFormsModule,
    RentalCardComponent,
    LocationPickerComponent,
    MeetingPointBubbleComponent,
    MeetingPointChooserComponent,
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
  private readonly dates = inject(UiDateService);
  private readonly routeConversationId$ = this.route.paramMap.pipe(
    map((params) => params.get('conversationId')),
    distinctUntilChanged(),
  );

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
    pendingMeetingPoint: this.store.select(selectPendingMeetingPoint),
    routeConversationId: this.routeConversationId$,
    lang: toObservable(this.dates.lang),
  }).pipe(
    map(
      ({
        routeState,
        sendingMessage,
        sendingMessageError,
        pendingImage,
        sendingImageError,
        pendingMeetingPoint,
        routeConversationId,
        lang,
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
          threadItems: activeConversation ? buildThreadItems(activeConversation, lang) : [],
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
          pendingMeetingPoint:
            pendingMeetingPoint !== null &&
            activeConversation !== null &&
            pendingMeetingPoint.conversationId === activeConversation.id
              ? pendingMeetingPoint
              : null,
          canShareMeetingPoint:
            activeConversation !== null && canShareMeetingPoint(activeConversation),
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

  private readonly viewport = signal({ width: window.innerWidth, height: window.innerHeight });
  /** Natural height of the full rental card (reported by the card, even while collapsed). */
  private readonly rentalFullHeight = signal(0);
  /** The feed is scrolled away from its bottom (the viewer is reading history). */
  private readonly feedScrolledAway = signal(false);
  /** The viewer tapped the compact row: stay expanded until the scroll position changes class. */
  private readonly rentalPinnedOpen = signal(false);

  /** Whether the rental card shows as the one-row compact (see the breakpoint note above). */
  protected isRentalCollapsed(conversation: ChatConversationDetails): boolean {
    const { width, height } = this.viewport();
    if (width >= RENTAL_COLUMN_MIN_WIDTH || this.rentalPinnedOpen()) {
      return false;
    }
    // The viewer's own turn (Accept/Decline, the note) is never collapsed for height alone.
    const viewerTurn =
      conversation.viewerRole !== null && conversation.turn === conversation.viewerRole;
    const tooTall = !viewerTurn && this.rentalFullHeight() > height * RENTAL_TALL_RATIO;
    return tooTall || (width < RENTAL_MOBILE_MAX_WIDTH && this.feedScrolledAway());
  }

  /** A booking thread shows the rental card; moderation and no-booking threads do not. */
  protected hasRental(conversation: ChatConversationDetails): boolean {
    return (
      conversation.kind !== 'moderation' &&
      conversation.bookingStatus !== null &&
      conversation.viewerRole !== null
    );
  }

  protected onFeedScroll(event: Event): void {
    const pane = event.target as HTMLElement;
    const away = pane.scrollHeight - pane.scrollTop - pane.clientHeight > FEED_BOTTOM_TOLERANCE_PX;
    if (away !== this.feedScrolledAway()) {
      this.feedScrolledAway.set(away);
      // Leaving the bottom collapses again; returning to it expands again.
      this.rentalPinnedOpen.set(false);
    }
  }

  protected expandRental(): void {
    this.rentalPinnedOpen.set(true);
  }

  protected onRentalHeight(height: number): void {
    this.rentalFullHeight.set(height);
  }

  constructor() {
    const onResize = (): void =>
      this.viewport.set({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    // Leaving the thread route closes the conversation in the store.
    this.destroyRef.onDestroy(() => this.store.dispatch(ChatActions.leaveConversation()));
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));

    // A different conversation starts with a fresh card layout.
    this.viewModel$
      .pipe(
        map((vm) => vm.conversation?.id ?? null),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.rentalFullHeight.set(0);
        this.feedScrolledAway.set(false);
        this.rentalPinnedOpen.set(false);
      });

    // The picker owns its send: success (the pending share cleared) closes it; a chat that
    // turned read-only closes it too, and the thread then shows the read-only note.
    effect(() => {
      const pending = this.pendingMeetingPoint();
      if (this.pickerOpen() && this.pickerSubmitted && pending === null) {
        this.pickerSubmitted = false;
        this.pickerOpen.set(false);
        this.focusPinButton();
      } else if (this.isReadOnlyFailure(pending)) {
        this.pickerSubmitted = false;
        this.pickerOpen.set(false);
        this.chooserOpen.set(false);
      }
    });

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

  // -- Share meeting point (ADR-053) ----------------------------------------
  private readonly homePoint = toSignal(this.store.select(selectHomePoint), {
    initialValue: null,
  });
  private readonly pendingMeetingPoint = toSignal(this.store.select(selectPendingMeetingPoint), {
    initialValue: null,
  });
  private readonly pinButton = viewChild<ElementRef<HTMLButtonElement>>('pinButton');

  protected readonly hasHomePoint = computed(() => this.homePoint() !== null);
  protected readonly chooserOpen = signal(false);
  protected readonly pickerOpen = signal(false);
  protected readonly meetingChoice = signal<MeetingPointChoice>('home');
  /** The picker sent its point and is waiting for the outcome (success closes it). */
  private pickerSubmitted = false;

  /** Map start for "Another place": the owner's home point, else the Yerevan centre. */
  protected readonly pickerCenter = computed<MapLatLng>(() => {
    const home = this.homePoint();
    return home ? { lat: home.latitude, lng: home.longitude } : YEREVAN_CENTER;
  });

  /** Inputs of the shared picker's meeting-point mode, for the thread's counterpart. */
  protected pickerMeetingPoint(
    counterpartName: string,
    pending: PendingMeetingPoint | null,
  ): LocationPickerMeetingPoint {
    const picking = pending !== null && pending.request.kind === 'other';
    return {
      copy: {
        hintInitTitleKey: 'chat.meetingPoint.picker.hintInitTitle',
        hintInitCityTitleKey: 'chat.meetingPoint.picker.hintInitCityTitle',
        hintInitTextKey: 'chat.meetingPoint.picker.hintInitText',
        hintPanTitleKey: 'chat.meetingPoint.picker.hintPanTitle',
        hintPanTextKey: 'chat.meetingPoint.picker.hintPanText',
        hintOkTitleKey: 'chat.meetingPoint.picker.hintOkTitle',
        hintOkTextKey: 'chat.meetingPoint.picker.hintOkText',
        chipUpdatingKey: 'chat.meetingPoint.picker.chipUpdating',
        statusNoneKey: 'chat.meetingPoint.picker.statusNone',
        statusOkKey: 'chat.meetingPoint.picker.statusOk',
        sendingKey: 'chat.meetingPoint.sending',
        outsideKey: 'chat.meetingPoint.picker.outside',
        failedKey: 'chat.meetingPoint.failA',
        failedRetryKey: 'chat.meetingPoint.failB',
        noteKey: 'chat.meetingPoint.picker.note',
      },
      params: { name: this.firstName(counterpartName) },
      startedOnCityCentre: !this.hasHomePoint(),
      sendError: picking && pending.status === 'failed' ? pending.error : null,
    };
  }

  /** The picker's send is in flight (spinner on confirm, Back inert). */
  protected pickerSending(pending: PendingMeetingPoint | null): boolean {
    return pending !== null && pending.request.kind === 'other' && pending.status === 'sending';
  }

  protected openMeetingChooser(): void {
    this.meetingChoice.set(this.hasHomePoint() ? 'home' : 'other');
    this.chooserOpen.set(true);
  }

  protected closeMeetingChooser(): void {
    this.chooserOpen.set(false);
    this.focusPinButton();
  }

  protected shareHomePoint(conversationId: string): void {
    this.chooserOpen.set(false);
    this.dispatchShare(conversationId, { kind: 'home' });
    this.focusPinButton();
  }

  protected chooseOnMap(): void {
    this.chooserOpen.set(false);
    this.pickerOpen.set(true);
  }

  /** The picker's Back: return to the chooser with "Another place" still selected. */
  protected pickerBack(): void {
    this.pickerOpen.set(false);
    this.meetingChoice.set('other');
    this.chooserOpen.set(true);
  }

  protected closeMeetingPicker(): void {
    this.pickerOpen.set(false);
    this.pickerSubmitted = false;
    this.store.dispatch(ChatActions.dismissPendingMeetingPoint());
    this.focusPinButton();
  }

  protected sharePickedPoint(conversationId: string, point: MapLatLng): void {
    this.pickerSubmitted = true;
    this.dispatchShare(conversationId, {
      kind: 'other',
      latitude: point.lat,
      longitude: point.lng,
    });
  }

  /** "Try again." on a failed home share. */
  protected retryMeetingPoint(conversationId: string): void {
    const pending = this.pendingMeetingPoint();
    if (pending !== null) {
      this.dispatchShare(conversationId, pending.request);
    }
  }

  protected dismissPendingMeetingPoint(): void {
    this.store.dispatch(ChatActions.dismissPendingMeetingPoint());
  }

  /** The share failed because the chat turned read-only meanwhile (`chat.conversation_closed`). */
  protected isReadOnlyFailure(pending: PendingMeetingPoint | null): boolean {
    return (
      pending !== null &&
      pending.status === 'failed' &&
      pending.errorCode === 'chat.conversation_closed'
    );
  }

  private dispatchShare(
    conversationId: string,
    request: Parameters<typeof ChatActions.shareMeetingPoint>[0]['request'],
  ): void {
    this.store.dispatch(ChatActions.shareMeetingPoint({ conversationId, request }));
  }

  private focusPinButton(): void {
    queueMicrotask(() => this.pinButton()?.nativeElement.focus());
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
