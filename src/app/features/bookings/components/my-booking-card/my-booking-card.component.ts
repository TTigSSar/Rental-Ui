import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

import type { BookingStatus, MyBooking } from '../../models/booking.model';

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-my-booking-card',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TagModule,
    TranslatePipe,
  ],
  templateUrl: './my-booking-card.component.html',
  styleUrl: './my-booking-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookingCardComponent {
  readonly booking = input.required<MyBooking>();

  protected readonly statusLabelKey = computed(() =>
    this.getStatusLabelKey(this.booking().status),
  );

  protected readonly statusSeverity = computed(() =>
    this.getStatusSeverity(this.booking().status),
  );

  private getStatusLabelKey(status: BookingStatus): string {
    switch (status) {
      case 'Pending':
      case 'PendingApproval':
        return 'bookings.status.pendingApproval';
      case 'Approved':
        return 'bookings.status.approved';
      case 'Rejected':
        return 'bookings.status.rejected';
      case 'Archived':
        return 'bookings.status.archived';
      case 'Cancelled':
        return 'bookings.status.cancelled';
      default:
        return 'bookings.status.pendingApproval';
    }
  }

  private getStatusSeverity(status: BookingStatus): TagSeverity {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Pending':
      case 'PendingApproval':
        return 'warn';
      case 'Rejected':
        return 'danger';
      case 'Archived':
        return 'secondary';
      case 'Cancelled':
        return 'contrast';
      default:
        return 'warn';
    }
  }
}
