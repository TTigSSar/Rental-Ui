import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import type { OwnerBookingRequest } from '../../models/owner-listing.model';

interface RequestedAgoI18n {
  readonly key: string;
  readonly params: Record<string, number>;
}

interface DecidedStatusMeta {
  readonly labelKey: string;
  readonly icon: string;
  readonly tone: 'approved' | 'active' | 'completed';
}

// Post-approval status pill per decision — Approved/Active/Completed each get their own
// wording so an owner can tell "awaiting handover" apart from "already picked up" at a
// glance (previously they all collapsed into one generic "Accepted" pill).
const DECIDED_STATUS_META: Readonly<
  Record<'approved' | 'active' | 'completed', DecidedStatusMeta>
> = {
  approved: {
    labelKey: 'myListings.ownerView.requests.awaitingHandover',
    icon: 'pi-clock',
    tone: 'approved',
  },
  active: {
    labelKey: 'myListings.ownerView.requests.pickedUp',
    icon: 'pi-box',
    tone: 'active',
  },
  completed: {
    labelKey: 'myListings.ownerView.requests.returned',
    icon: 'pi-check-circle',
    tone: 'completed',
  },
};

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
  private readonly router = inject(Router);

  readonly request = input.required<OwnerBookingRequest>();
  readonly actionLoading = input<boolean>(false);

  readonly accepted = output<string>();
  readonly declined = output<string>();
  readonly messaged = output<OwnerBookingRequest>();

  /** Status pill content for the three post-approval states; null for pending/declined. */
  protected readonly decidedStatus = computed((): DecidedStatusMeta | null => {
    const decision = this.request().decision;
    return decision === 'approved' || decision === 'active' || decision === 'completed'
      ? DECIDED_STATUS_META[decision]
      : null;
  });

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
    return {
      key: 'myListings.ownerView.requests.daysAgo',
      params: { count: Math.floor(diffH / 24) },
    };
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

  protected viewBooking(): void {
    void this.router.navigate(['/bookings', this.request().id]);
  }
}
