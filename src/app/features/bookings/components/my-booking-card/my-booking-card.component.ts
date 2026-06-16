import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { BookingProgressComponent } from '../../../../shared/ui/booking-progress/booking-progress.component';
import {
  mapBookingStatusLabelKey,
  mapBookingStatusTone,
} from '../../../../shared/utils/booking-status.utils';

import type { MyBooking } from '../../models/booking.model';

@Component({
  selector: 'app-my-booking-card',
  standalone: true,
  imports: [
    CardModule,
    CurrencyPipe,
    DatePipe,
    BadgeComponent,
    BookingProgressComponent,
    TranslatePipe,
  ],
  templateUrl: './my-booking-card.component.html',
  styleUrl: './my-booking-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookingCardComponent {
  private readonly router = inject(Router);

  readonly booking = input.required<MyBooking>();

  protected readonly statusLabelKey = computed(() =>
    mapBookingStatusLabelKey(this.booking().status),
  );

  protected readonly statusTone = computed(() =>
    mapBookingStatusTone(this.booking().status),
  );

  // Completion unlocks reviews; the badge points the user to the details page to act.
  protected readonly reviewAvailable = computed(
    () => this.booking().status === 'Completed',
  );

  protected openDetails(): void {
    void this.router.navigate(['/bookings', this.booking().id]);
  }
}
