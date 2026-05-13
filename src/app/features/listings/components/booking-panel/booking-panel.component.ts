import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  input,
  Output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { BookingCalendarComponent } from '../booking-calendar/booking-calendar.component';
import type { BookedDateRange } from '../../models/listing.model';

export interface BookingSubmitPayload {
  readonly startDate: Date;
  readonly endDate: Date;
}

function countInclusiveRentalDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.floor((endUtc - startUtc) / 86_400_000);
  if (diffDays < 0) {
    return 0;
  }
  return diffDays + 1;
}

@Component({
  selector: 'app-booking-panel',
  standalone: true,
  imports: [
    BookingCalendarComponent,
    ButtonModule,
    CurrencyPipe,
    TranslatePipe,
  ],
  templateUrl: './booking-panel.component.html',
  styleUrl: './booking-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPanelComponent {
  readonly pricePerDay = input.required<number>();
  readonly bookedDates = input.required<BookedDateRange[]>();
  readonly submitting = input<boolean>(false);
  readonly submitError = input<string | null>(null);
  readonly submitSuccess = input<boolean>(false);

  @Output() readonly bookingSubmit = new EventEmitter<BookingSubmitPayload>();

  protected readonly startDate = signal<Date | null>(null);
  protected readonly endDate = signal<Date | null>(null);

  protected readonly rentalDays = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (start === null || end === null) {
      return 0;
    }
    return countInclusiveRentalDays(start, end);
  });

  protected readonly totalPrice = computed(() => {
    const days = this.rentalDays();
    if (days <= 0) {
      return null;
    }
    return days * this.pricePerDay();
  });

  protected readonly canSubmit = computed(
    () =>
      this.startDate() !== null &&
      this.endDate() !== null &&
      this.rentalDays() > 0 &&
      !this.submitting(),
  );

  protected onRangeChange(event: {
    startDate: Date | null;
    endDate: Date | null;
  }): void {
    this.startDate.set(event.startDate);
    this.endDate.set(event.endDate);
  }

  protected onSubmitClick(): void {
    const start = this.startDate();
    const end = this.endDate();
    if (start === null || end === null || this.rentalDays() <= 0) {
      return;
    }
    this.bookingSubmit.emit({ startDate: start, endDate: end });
  }
}
