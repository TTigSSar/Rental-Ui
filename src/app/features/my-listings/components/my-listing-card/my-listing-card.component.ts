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
import { ImageContainerComponent } from '../../../../shared/ui/image-container/image-container.component';
import type { MyListing, MyListingStatus } from '../../models/my-listing.model';

type BadgeTone = 'approved' | 'pending' | 'rejected' | 'neutral';

@Component({
  selector: 'app-my-listing-card',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TranslatePipe,
    BadgeComponent,
    ImageContainerComponent,
  ],
  templateUrl: './my-listing-card.component.html',
  styleUrl: './my-listing-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyListingCardComponent {
  readonly listing = input.required<MyListing>();

  @Output() readonly editRequested = new EventEmitter<string>();
  @Output() readonly archiveRequested = new EventEmitter<string>();

  protected readonly statusLabelKey = computed(() =>
    this.mapStatusLabelKey(this.listing().status),
  );

  protected readonly statusTone = computed(() =>
    this.mapStatusTone(this.listing().status),
  );

  protected requestEdit(): void {
    this.editRequested.emit(this.listing().id);
  }

  protected requestArchive(): void {
    this.archiveRequested.emit(this.listing().id);
  }

  private mapStatusLabelKey(status: MyListingStatus): string {
    switch (status) {
      case 'Pending':
      case 'PendingApproval':
        return 'myListings.status.pendingApproval';
      case 'Approved':
        return 'myListings.status.approved';
      case 'Rejected':
        return 'myListings.status.rejected';
      case 'Archived':
        return 'myListings.status.archived';
      default:
        return 'myListings.status.pendingApproval';
    }
  }

  private mapStatusTone(status: MyListingStatus): BadgeTone {
    switch (status) {
      case 'Approved':
        return 'approved';
      case 'Pending':
      case 'PendingApproval':
        return 'pending';
      case 'Rejected':
        return 'rejected';
      case 'Archived':
        return 'neutral';
      default:
        return 'pending';
    }
  }
}
