import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { OwnerListingStatus } from '../../models/owner-listing.model';

@Component({
  selector: 'app-listing-status-banner',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './listing-status-banner.component.html',
  styleUrl: './listing-status-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingStatusBannerComponent {
  readonly status = input.required<OwnerListingStatus>();

  protected readonly isActive = computed(() => this.status() === 'Active');
}
