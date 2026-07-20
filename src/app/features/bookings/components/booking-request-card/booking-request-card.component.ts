import { DatePipe } from '@angular/common';
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
import { DialogModule } from 'primeng/dialog';

import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import type { BookingRequest } from '../../models/booking.model';

@Component({
  selector: 'app-booking-request-card',
  standalone: true,
  imports: [ButtonModule, DialogModule, DramCurrencyPipe, DatePipe, TranslatePipe],
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

  protected readonly reasonCodes = ['dates_unavailable', 'item_unavailable', 'not_a_fit', 'other'] as const;

  protected readonly rejectDialogVisible = signal(false);
  protected readonly selectedReason = signal<string>('dates_unavailable');
  protected readonly otherText = signal('');

  protected readonly canDecide = computed(
    () => this.request().status === 'PendingApproval' || this.request().status === 'Pending',
  );

  protected readonly initials = computed(() => {
    const r = this.request();
    return ((r.renterFirstName[0] ?? '') + (r.renterLastName[0] ?? '')).toUpperCase();
  });

  protected readonly renterShortName = computed(() => {
    const r = this.request();
    const lastInitial = r.renterLastName[0]?.toUpperCase() ?? '';
    return `${r.renterFirstName} ${lastInitial}.`;
  });

  protected readonly timeAgo = computed((): string => {
    const created = this.request().createdAt;
    if (!created) return '';
    const diffMs = Date.now() - new Date(created).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  });

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

  protected openDetails(): void {
    void this.router.navigate(['/bookings', this.request().id]);
  }
}
