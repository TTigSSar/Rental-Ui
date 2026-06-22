import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { BookingStatus } from '../../../features/bookings/models/booking.model';
import { mapBookingStatusLabelKey, mapBookingStatusTone } from '../../utils/booking-status.utils';
import { BadgeComponent } from '../badge/badge.component';

@Component({
  selector: 'app-booking-status-badge',
  standalone: true,
  imports: [BadgeComponent, TranslatePipe],
  template: `<app-ui-badge [tone]="tone()" [label]="labelKey() | translate" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingStatusBadgeComponent {
  readonly status = input.required<BookingStatus>();

  protected readonly tone = computed(() => mapBookingStatusTone(this.status()));
  protected readonly labelKey = computed(() => mapBookingStatusLabelKey(this.status()));
}
