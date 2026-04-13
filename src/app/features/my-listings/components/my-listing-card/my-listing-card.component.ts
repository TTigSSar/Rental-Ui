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

import type { MyListing, MyListingStatus } from '../../models/my-listing.model';

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary';

@Component({
  selector: 'app-my-listing-card',
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

  protected readonly statusSeverity = computed(() =>
    this.mapStatusSeverity(this.listing().status),
  );

  protected requestEdit(): void {
    this.editRequested.emit(this.listing().id);
  }

  protected requestArchive(): void {
    this.archiveRequested.emit(this.listing().id);
  }

  private mapStatusLabelKey(status: MyListingStatus): string {
    switch (status) {
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

  private mapStatusSeverity(status: MyListingStatus): TagSeverity {
    switch (status) {
      case 'Approved':
        return 'success';
      case 'PendingApproval':
        return 'warn';
      case 'Rejected':
        return 'danger';
      case 'Archived':
        return 'secondary';
      default:
        return 'warn';
    }
  }
}
