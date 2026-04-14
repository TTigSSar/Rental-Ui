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
import { TagModule } from 'primeng/tag';

import type { BookingRequest, BookingStatus } from '../../models/booking.model';

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-booking-request-card',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TagModule,
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
    this.getStatusLabelKey(this.request().status),
  );

  protected readonly statusSeverity = computed(() =>
    this.getStatusSeverity(this.request().status),
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

  private getStatusLabelKey(status: BookingStatus): string {
    switch (status) {
      case 'Pending':
      case 'PendingApproval':
        return 'bookings.status.pendingApproval';
      case 'Approved':
        return 'bookings.status.approved';
      case 'Rejected':
        return 'bookings.status.rejected';
      case 'Archived':
        return 'bookings.status.archived';
      case 'Cancelled':
        return 'bookings.status.cancelled';
      default:
        return 'bookings.status.pendingApproval';
    }
  }

  private getStatusSeverity(status: BookingStatus): TagSeverity {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'Pending':
      case 'PendingApproval':
        return 'warn';
      case 'Rejected':
        return 'danger';
      case 'Archived':
        return 'secondary';
      case 'Cancelled':
        return 'contrast';
      default:
        return 'warn';
    }
  }
}
