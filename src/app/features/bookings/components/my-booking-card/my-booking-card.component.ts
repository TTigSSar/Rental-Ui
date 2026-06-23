import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { BookingProgressComponent } from '../../../../shared/ui/booking-progress/booking-progress.component';
import type { MyBooking } from '../../models/booking.model';

export type CardHeaderTone = 'active' | 'return-marked' | 'approved' | 'pending' | 'completed' | 'past';

@Component({
  selector: 'app-my-booking-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, UpperCasePipe, BookingProgressComponent, TranslatePipe],
  templateUrl: './my-booking-card.component.html',
  styleUrl: './my-booking-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookingCardComponent {
  private readonly router = inject(Router);

  readonly booking = input.required<MyBooking>();

  protected readonly imgFailed = signal(false);

  protected readonly ownerShortName = computed((): string | null => {
    const b = this.booking();
    if (!b.ownerFirstName) return null;
    const lastInitial = b.ownerLastName[0]?.toUpperCase() ?? '';
    return lastInitial ? `${b.ownerFirstName} ${lastInitial}.` : b.ownerFirstName;
  });

  protected readonly headerTone = computed((): CardHeaderTone => {
    switch (this.booking().status) {
      case 'Active':       return 'active';
      case 'ReturnMarked': return 'return-marked';
      case 'Approved':     return 'approved';
      case 'Pending':
      case 'PendingApproval': return 'pending';
      case 'Completed':    return 'completed';
      default:             return 'past';
    }
  });

  protected readonly headerLabelKey = computed((): string => {
    switch (this.booking().status) {
      case 'Active':          return 'bookings.myBookings.cardHeader.active';
      case 'ReturnMarked':    return 'bookings.myBookings.cardHeader.returnMarked';
      case 'Approved':        return 'bookings.myBookings.cardHeader.approved';
      case 'Pending':
      case 'PendingApproval': return 'bookings.myBookings.cardHeader.pending';
      case 'Completed':       return 'bookings.myBookings.cardHeader.completed';
      default:                return 'bookings.myBookings.cardHeader.past';
    }
  });

  protected readonly urgency = computed((): { text: string; level: 'danger' | 'warning' } | null => {
    const b = this.booking();
    if (!['Approved', 'Active', 'ReturnMarked'].includes(b.status)) return null;
    const diffMs = new Date(b.endDate).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / 86_400_000);
    if (diffDays < 0)  return { text: 'Return overdue', level: 'danger' };
    if (diffDays === 0) return { text: 'Due today',     level: 'danger' };
    if (diffDays === 1) return { text: 'Due tomorrow',  level: 'warning' };
    if (diffDays <= 3)  return { text: `${diffDays} days left`, level: 'warning' };
    return null;
  });

  protected openDetails(): void {
    void this.router.navigate(['/bookings', this.booking().id]);
  }
}
