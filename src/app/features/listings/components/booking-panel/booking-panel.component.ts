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

export interface QuickBookOption {
  readonly key: string;
  readonly label: string;
  readonly days: number;
  readonly discountPct: number;
}

const QUICK_BOOK_OPTIONS: readonly QuickBookOption[] = [
  { key: 'day', label: '1 day', days: 1, discountPct: 0 },
  { key: 'week', label: '1 week', days: 7, discountPct: 10 },
  { key: 'month', label: '1 month', days: 30, discountPct: 25 },
  { key: 'year', label: '1 year', days: 365, discountPct: 40 },
];


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

  protected readonly quickBookOptions = QUICK_BOOK_OPTIONS;

  protected readonly startDate = signal<Date | null>(null);
  protected readonly endDate = signal<Date | null>(null);
  protected readonly selectedQuickBook = signal<QuickBookOption | null>(null);
  protected readonly controlledRange = signal<Date[] | null>(null);

  protected readonly rentalDays = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (start === null || end === null) return 0;
    return countInclusiveRentalDays(start, end);
  });

  protected readonly basePrice = computed(() => {
    const days = this.rentalDays();
    return days > 0 ? days * this.pricePerDay() : 0;
  });

  protected readonly discountPct = computed(
    () => this.selectedQuickBook()?.discountPct ?? 0,
  );

  protected readonly discountAmount = computed(() => {
    const base = this.basePrice();
    const pct = this.discountPct();
    return pct > 0 ? Math.round((base * pct) / 100) : 0;
  });

  protected readonly netPrice = computed(
    () => this.basePrice() - this.discountAmount(),
  );

  protected readonly totalPrice = computed(() => {
    const days = this.rentalDays();
    if (days <= 0) return null;
    return this.netPrice();
  });

  protected readonly canSubmit = computed(
    () =>
      this.startDate() !== null &&
      this.endDate() !== null &&
      this.rentalDays() > 0 &&
      !this.submitting(),
  );

  protected applyQuickBook(option: QuickBookOption): void {
    if (this.selectedQuickBook()?.key === option.key) {
      this.selectedQuickBook.set(null);
      this.controlledRange.set([]); // empty array = clear signal to calendar
      this.startDate.set(null);
      this.endDate.set(null);
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + option.days - 1);
    this.selectedQuickBook.set(option);
    this.controlledRange.set([today, end]);
    this.startDate.set(today);
    this.endDate.set(end);
  }

  protected onRangeChange(event: {
    startDate: Date | null;
    endDate: Date | null;
  }): void {
    this.startDate.set(event.startDate);
    this.endDate.set(event.endDate);
    this.selectedQuickBook.set(null);
    this.controlledRange.set(null);
  }

  protected onSubmitClick(): void {
    const start = this.startDate();
    const end = this.endDate();
    if (start === null || end === null || this.rentalDays() <= 0) return;
    this.bookingSubmit.emit({ startDate: start, endDate: end });
  }
}
