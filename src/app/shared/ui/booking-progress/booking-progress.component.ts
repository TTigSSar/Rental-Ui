import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { BookingStatus } from '../../../features/bookings/models/booking.model';
import { computeBookingProgress } from '../../utils/booking-progress.utils';

@Component({
  selector: 'app-booking-progress',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './booking-progress.component.html',
  styleUrl: './booking-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingProgressComponent {
  readonly status = input.required<BookingStatus>();
  readonly startDate = input<string | null>(null);
  readonly density = input<'compact' | 'expanded'>('compact');

  protected readonly progress = computed(() =>
    computeBookingProgress(this.status(), this.startDate()),
  );
}
