import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { BookingProgressComponent } from '../../../../shared/ui/booking-progress/booking-progress.component';
import {
  mapBookingStatusLabelKey,
  mapBookingStatusTone,
} from '../../../../shared/utils/booking-status.utils';

import type { BookingRequest } from '../../models/booking.model';

@Component({
  selector: 'app-booking-request-card',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    DialogModule,
    CurrencyPipe,
    DatePipe,
    BadgeComponent,
    BookingProgressComponent,
    TranslatePipe,
  ],
  templateUrl: './booking-request-card.component.html',
  styleUrl: './booking-request-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRequestCardComponent {
  private readonly router = inject(Router);

  readonly request = input.required<BookingRequest>();
  readonly actionLoading = input<boolean>(false);

  @Output() readonly approved = new EventEmitter<string>();
  @Output() readonly rejected = new EventEmitter<{ bookingId: string; reason: string | null }>();

  // Predefined rejection reason codes (the last one, 'other', reveals a free-text note).
  protected readonly reasonCodes = ['dates_unavailable', 'item_unavailable', 'not_a_fit', 'other'] as const;

  protected readonly rejectDialogVisible = signal(false);
  protected readonly selectedReason = signal<string>('dates_unavailable');
  protected readonly otherText = signal('');

  protected readonly statusLabelKey = computed(() =>
    mapBookingStatusLabelKey(this.request().status),
  );

  protected readonly statusTone = computed(() =>
    mapBookingStatusTone(this.request().status),
  );

  protected readonly canDecide = computed(
    () => this.request().status === 'PendingApproval' || this.request().status === 'Pending',
  );

  protected openDetails(): void {
    void this.router.navigate(['/bookings', this.request().id]);
  }

  protected approve(event: Event): void {
    event.stopPropagation();
    this.approved.emit(this.request().id);
  }

  protected openRejectDialog(event: Event): void {
    event.stopPropagation();
    this.selectedReason.set('dates_unavailable');
    this.otherText.set('');
    this.rejectDialogVisible.set(true);
  }

  protected cancelReject(): void {
    this.rejectDialogVisible.set(false);
  }

  protected confirmReject(): void {
    const code = this.selectedReason();
    const reason = code === 'other' ? this.otherText().trim() || null : code;
    this.rejected.emit({ bookingId: this.request().id, reason });
    this.rejectDialogVisible.set(false);
  }

  protected onReasonChange(code: string): void {
    this.selectedReason.set(code);
  }

  protected onOtherInput(event: Event): void {
    this.otherText.set((event.target as HTMLTextAreaElement).value);
  }
}
