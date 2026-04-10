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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePickerModule } from 'primeng/datepicker';

import type { BookedDateRange } from '../../models/listing.model';

/**
 * Expands inclusive API ranges into individual calendar dates for `disabledDates`.
 */
export function expandBookedDateRangesToDisabledDates(
  ranges: readonly BookedDateRange[],
): Date[] {
  const out: Date[] = [];
  for (const range of ranges) {
    const start = parseBookingDate(range.startDate);
    const end = parseBookingDate(range.endDate);
    out.push(...eachDateInclusive(start, end));
  }
  return out;
}

function parseBookingDate(isoDate: string): Date {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
}

function eachDateInclusive(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endAt = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= endAt) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function normalizeRangeSelection(
  value: Date | Date[] | null | undefined,
): Date[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? null : [...value];
  }
  return [value];
}

function countBookingNights(start: Date, end: Date): number {
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((endUtc - startUtc) / 86_400_000);
  return Math.max(0, diffDays);
}

@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [CurrencyPipe, DatePickerModule, FormsModule, TranslatePipe],
  templateUrl: './booking-calendar.component.html',
  styleUrl: './booking-calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCalendarComponent {
  readonly bookedDates = input.required<BookedDateRange[]>();
  readonly pricePerDay = input.required<number>();

  @Output() readonly dateRangeSelected = new EventEmitter<{
    startDate: Date | null;
    endDate: Date | null;
  }>();

  protected readonly rangeSelection = signal<Date[] | null>(null);

  readonly disabledDates = computed(() =>
    expandBookedDateRangesToDisabledDates(this.bookedDates()),
  );

  readonly totalPrice = computed(() => {
    const range = this.rangeSelection();
    const rate = this.pricePerDay();
    if (!range || range.length < 2) {
      return null;
    }
    const start = range[0];
    const end = range[1];
    if (!(start instanceof Date) || !(end instanceof Date)) {
      return null;
    }
    const nights = countBookingNights(start, end);
    if (nights <= 0) {
      return null;
    }
    return nights * rate;
  });

  protected onRangeChange(value: Date | Date[] | null | undefined): void {
    const normalized = normalizeRangeSelection(value);
    this.rangeSelection.set(normalized);
    const start = normalized?.[0] ?? null;
    const end = normalized?.[1] ?? null;
    this.dateRangeSelected.emit({ startDate: start, endDate: end });
  }
}
