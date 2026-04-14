import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';

import type { BookingStatus, MyBooking } from '../../models/booking.model';

type BadgeTone = 'approved' | 'pending' | 'rejected' | 'neutral';

@Component({
  selector: 'app-my-booking-card',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    BadgeComponent,
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

  protected readonly statusTone = computed(() =>
    this.getStatusTone(this.booking().status),
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

  private getStatusTone(status: BookingStatus): BadgeTone {
    switch (status) {
      case 'Approved':
        return 'approved';
      case 'Pending':
      case 'PendingApproval':
        return 'pending';
      case 'Rejected':
        return 'rejected';
      case 'Archived':
      case 'Cancelled':
        return 'neutral';
      default:
        return 'pending';
    }
  }
}
