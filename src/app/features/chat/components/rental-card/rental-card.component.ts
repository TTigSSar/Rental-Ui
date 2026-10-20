import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Actions, ofType } from '@ngrx/effects';
import { type Action, Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { MenuItem } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';

import { LanguageService } from '../../../../shared/services/language.service';
import { todayUtcDateString } from '../../../../shared/utils/date.utils';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import {
  type BookingRejectResult,
  BookingRejectDialogComponent,
} from '../../../bookings/components/booking-reject-dialog/booking-reject-dialog.component';
import * as BookingsActions from '../../../bookings/store/bookings.actions';
import type { ChatConversationDetails } from '../../models/chat.model';
import { type RentalActionId, type RentalCardView, mapRentalCardView } from './rental-card.view';

/** Armenia has no DST: Yerevan is a fixed UTC+4 (the calendar the deadline is shown in). */
const YEREVAN_UTC_OFFSET = '+0400';

/**
 * The rental card pinned under the thread header: toy row + one turn badge, one
 * sentence and one primary button (design: `RentalCard` in rc-parts.jsx). It replaces
 * the old context strip, status pill and "View booking" link.
 *
 * The state-to-view mapping lives in {@link mapRentalCardView} (pure, own spec). The
 * card never decides whose turn it is: the top bar shows when the server's `turn`
 * equals the viewer's role.
 */
@Component({
  selector: 'app-rental-card',
  standalone: true,
  imports: [BookingRejectDialogComponent, DramCurrencyPipe, MenuModule, TranslatePipe],
  templateUrl: './rental-card.component.html',
  styleUrl: './rental-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RentalCardComponent {
  readonly conversation = input.required<ChatConversationDetails>();

  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly actions$ = inject(Actions);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly locale = inject(LOCALE_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly menu = viewChild<Menu>('menu');

  protected readonly rejectDialogVisible = signal(false);
  /** True from click until the server answers (state changes) or the action fails. */
  protected readonly busy = signal(false);
  /** Already-translated failure message from the shared errorCode mapper (ADR-045). */
  protected readonly actionError = signal<string | null>(null);

  /** The viewer's turn: the only case the top bar shows (`turn === viewerRole`). */
  protected readonly isViewerTurn = computed(() => {
    const c = this.conversation();
    return c.viewerRole !== null && c.turn === c.viewerRole;
  });

  protected readonly view = computed<RentalCardView | null>(() => {
    const c = this.conversation();
    if (c.bookingStatus === null || c.viewerRole === null) {
      return null;
    }
    return mapRentalCardView({
      status: c.bookingStatus,
      role: c.viewerRole,
      counterpartName: c.counterpartName,
      deadlineText: c.deadlineAt
        ? formatDate(c.deadlineAt, 'd MMM, H:mm', this.locale, YEREVAN_UTC_OFFSET)
        : '',
      startDateText: this.dateOnly(c.startDate),
      endDateText: this.dateOnly(c.endDate),
      rejectionReason: c.rejectionReason,
      canCancelApproved: c.startDate !== null && c.startDate > todayUtcDateString(),
    });
  });

  protected readonly reasonCaptionKey = computed(() =>
    this.view()?.sentenceKey === 'chat.rental.notHappened.declinedByYou'
      ? 'chat.rental.reasonYou'
      : 'chat.rental.reasonBy',
  );

  protected readonly datesText = computed(() => {
    const c = this.conversation();
    return {
      start: this.dateOnly(c.startDate),
      end: this.dateOnly(c.endDate),
      days: c.rentalDays,
    };
  });

  protected readonly menuItems = computed<MenuItem[]>(() => {
    // Reactivity trigger only: `p-menu`'s `model` is not reachable by `TranslatePipe`.
    this.languageService.current();
    const view = this.view();
    if (!view) {
      return [];
    }
    return view.menu.map((a) => ({
      label: this.translate.instant(a.labelKey),
      styleClass: a.danger ? 'rental-card__menu-item--danger' : undefined,
      command: () => this.run(a.id),
    }));
  });

  constructor() {
    // The server answered (status or turn changed): the action is no longer in flight.
    effect(() => {
      const c = this.conversation();
      void c.bookingStatus;
      void c.turn;
      untracked(() => this.busy.set(false));
    });

    this.actions$
      .pipe(
        ofType(
          BookingsActions.approveBookingRequestFailure,
          BookingsActions.rejectBookingRequestFailure,
          BookingsActions.bookingActionFailure,
          BookingsActions.cancelBookingFailure,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((failure) => {
        if (!this.busy()) {
          return;
        }
        this.busy.set(false);
        this.actionError.set(failure.error);
      });
  }

  protected toggleMenu(event: Event): void {
    this.menu()?.toggle(event);
  }

  protected onPrimary(): void {
    const id = this.view()?.primary?.id;
    if (id) {
      this.run(id);
    }
  }

  protected onSecondary(): void {
    const id = this.view()?.secondary?.id;
    if (id) {
      this.run(id);
    }
  }

  protected closeRejectDialog(): void {
    this.rejectDialogVisible.set(false);
  }

  protected confirmReject({ reason }: BookingRejectResult): void {
    this.rejectDialogVisible.set(false);
    const bookingId = this.conversation().bookingId;
    if (bookingId) {
      this.start(BookingsActions.rejectBookingRequest({ bookingId, reason }));
    }
  }

  private run(id: RentalActionId): void {
    const c = this.conversation();
    const bookingId = c.bookingId;
    if (!bookingId || this.busy()) {
      return;
    }
    switch (id) {
      case 'accept':
        this.start(BookingsActions.approveBookingRequest({ bookingId }));
        break;
      case 'decline':
        this.actionError.set(null);
        this.rejectDialogVisible.set(true);
        break;
      case 'withdraw':
      case 'cancelBooking':
        this.start(BookingsActions.cancelBooking({ bookingId }));
        break;
      case 'handedOver':
        this.start(BookingsActions.markActive({ bookingId }));
        break;
      case 'receivedBack':
        this.start(BookingsActions.completeBooking({ bookingId }));
        break;
      case 'review':
        void this.router.navigate(
          c.viewerRole === 'owner'
            ? ['/bookings', bookingId, 'review', 'renter']
            : ['/bookings', bookingId, 'review'],
        );
        break;
      case 'findSimilar':
        void this.router.navigate(['/listings']);
        break;
      case 'viewBooking':
        void this.router.navigate(['/bookings', bookingId]);
        break;
    }
  }

  private start(action: Action): void {
    this.actionError.set(null);
    this.busy.set(true);
    this.store.dispatch(action);
  }

  /** 'yyyy-MM-dd' -> '12 Oct'; empty when absent. */
  private dateOnly(value: string | null): string {
    return value ? formatDate(value, 'd MMM', this.locale) : '';
  }
}
