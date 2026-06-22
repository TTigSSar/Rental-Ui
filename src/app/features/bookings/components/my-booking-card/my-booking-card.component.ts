import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BookingStatusBadgeComponent } from '../../../../shared/ui/booking-status-badge/booking-status-badge.component';

import type { MyBooking } from '../../models/booking.model';

@Component({
  selector: 'app-my-booking-card',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, BookingStatusBadgeComponent, TranslatePipe],
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

  protected readonly urgency = computed((): { text: string; level: 'danger' | 'warning' } | null => {
    const b = this.booking();
    if (!['Approved', 'Active', 'ReturnMarked'].includes(b.status)) return null;
    const diffMs = new Date(b.endDate).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / 86_400_000);
    if (diffDays < 0) return { text: 'Return overdue', level: 'danger' };
    if (diffDays === 0) return { text: 'Due today', level: 'danger' };
    if (diffDays === 1) return { text: 'Due tomorrow', level: 'warning' };
    if (diffDays <= 3) return { text: `${diffDays} days left`, level: 'warning' };
    return null;
  });

  protected openDetails(): void {
    void this.router.navigate(['/bookings', this.booking().id]);
  }
}
