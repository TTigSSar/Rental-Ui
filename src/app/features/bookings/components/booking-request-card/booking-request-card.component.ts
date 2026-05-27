import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import {
  mapBookingStatusLabelKey,
  mapBookingStatusTone,
} from '../../../../shared/utils/booking-status.utils';

import type { BookingRequest } from '../../models/booking.model';

@Component({
  selector: 'app-booking-request-card',
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
  templateUrl: './booking-request-card.component.html',
  styleUrl: './booking-request-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingRequestCardComponent {
  readonly request = input.required<BookingRequest>();
  readonly actionLoading = input<boolean>(false);

  @Output() readonly approved = new EventEmitter<string>();
  @Output() readonly rejected = new EventEmitter<string>();

  protected readonly statusLabelKey = computed(() =>
    mapBookingStatusLabelKey(this.request().status),
  );

  protected readonly statusTone = computed(() =>
    mapBookingStatusTone(this.request().status),
  );

  protected readonly canDecide = computed(
    () => this.request().status === 'PendingApproval' || this.request().status === 'Pending',
  );

  protected approve(): void {
    this.approved.emit(this.request().id);
  }

  protected reject(): void {
    this.rejected.emit(this.request().id);
  }
}
