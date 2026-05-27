import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import {
  mapBookingStatusLabelKey,
  mapBookingStatusTone,
} from '../../../../shared/utils/booking-status.utils';

import type { MyBooking } from '../../models/booking.model';

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
    mapBookingStatusLabelKey(this.booking().status),
  );

  protected readonly statusTone = computed(() =>
    mapBookingStatusTone(this.booking().status),
  );
}
