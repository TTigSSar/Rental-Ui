import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  EventEmitter,
  input,
  Output,
  signal,
  untracked,
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
    if (start === null || end === null) {
      continue;
    }
    out.push(...eachDateInclusive(start, end));
  }
  return out;
}

function parseBookingDate(isoDate: string): Date | null {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
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
    // Preserve the emitted array reference (do NOT copy). When this value is fed
    // back into the datepicker's [ngModel], reference-equality lets Angular's
    // NgModel skip writeValue() — which stops PrimeNG's updateUI() from resetting
    // the visible month to today while a range is still partial ([start, null]).
    return value.length === 0 ? null : value;
  }
  return [value];
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
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [DatePickerModule, FormsModule, TranslatePipe],
  templateUrl: './booking-calendar.component.html',
  styleUrl: './booking-calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCalendarComponent {
  readonly bookedDates = input.required<BookedDateRange[]>();
  readonly pricePerDay = input.required<number>();
  readonly value = input<Date[] | null>(null);
  readonly disabled = input<boolean>(false);

  @Output() readonly dateRangeSelected = new EventEmitter<{
    startDate: Date | null;
    endDate: Date | null;
  }>();

  protected readonly today = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  );
  protected readonly rangeSelection = signal<Date[] | null>(null);

  constructor() {
    effect(() => {
      const v = this.value();
      if (v !== null) {
        // empty array = clear signal; non-empty = set range
        untracked(() => this.rangeSelection.set(v.length === 0 ? null : v));
      }
    });
  }

  readonly disabledDates = computed(() =>
    expandBookedDateRangesToDisabledDates(this.bookedDates()),
  );

  protected readonly startDate = computed(() => this.rangeSelection()?.[0] ?? null);
  protected readonly endDate = computed(() => this.rangeSelection()?.[1] ?? null);
  protected readonly hasStartDate = computed(() => !!this.startDate());
  protected readonly hasEndDate = computed(() => !!this.endDate());
  protected readonly formattedStartDate = computed(() => this.formatDate(this.startDate()));
  protected readonly formattedEndDate = computed(() => this.formatDate(this.endDate()));

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
    const rentalDays = countInclusiveRentalDays(start, end);
    if (rentalDays <= 0) {
      return null;
    }
    return rentalDays * rate;
  });

  private formatDate(date: Date | null): string {
    if (!date) return '—';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  protected onRangeChange(value: Date | Date[] | null | undefined): void {
    const normalized = normalizeRangeSelection(value);
    this.rangeSelection.set(normalized);
    const start = normalized?.[0] ?? null;
    const end = normalized?.[1] ?? null;
    this.dateRangeSelected.emit({ startDate: start, endDate: end });
  }
}
