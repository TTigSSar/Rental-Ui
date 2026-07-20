import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import type { OwnerBookingRequest } from '../../models/owner-listing.model';

interface RequestedAgoI18n {
  readonly key: string;
  readonly params: Record<string, number>;
}

/**
 * Incoming booking-request card for the owner view: renter identity + social
 * proof, the requested dates, the owner's earnings, and the renter's note as a
 * chat bubble. Emits accept/decline/message — the page owns the state machine.
 */
@Component({
  selector: 'app-owner-request-card',
  standalone: true,
  imports: [ButtonModule, DramCurrencyPipe, DatePipe, DecimalPipe, TranslatePipe],
  templateUrl: './owner-request-card.component.html',
  styleUrl: './owner-request-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerRequestCardComponent {
  readonly request = input.required<OwnerBookingRequest>();
  readonly actionLoading = input<boolean>(false);

  readonly accepted = output<string>();
  readonly declined = output<string>();
  readonly messaged = output<OwnerBookingRequest>();

  protected readonly renterName = computed(() => {
    const r = this.request().renter;
    return `${r.firstName} ${r.lastName}`.trim();
  });

  protected readonly initials = computed(() => {
    const r = this.request().renter;
    return `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toUpperCase();
  });

  protected readonly requestedAgo = computed((): RequestedAgoI18n => {
    const created = new Date(this.request().requestedAt).getTime();
    const diffMin = Math.max(0, Math.floor((Date.now() - created) / 60_000));
    if (diffMin < 60) {
      return { key: 'myListings.ownerView.requests.minutesAgo', params: { count: diffMin } };
    }
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) {
      return { key: 'myListings.ownerView.requests.hoursAgo', params: { count: diffH } };
    }
    return { key: 'myListings.ownerView.requests.daysAgo', params: { count: Math.floor(diffH / 24) } };
  });

  protected accept(): void {
    this.accepted.emit(this.request().id);
  }

  protected decline(): void {
    this.declined.emit(this.request().id);
  }

  protected message(): void {
    this.messaged.emit(this.request());
  }
}
