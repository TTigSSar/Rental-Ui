import { CurrencyPipe } from '@angular/common';
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

import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import {
  mapListingStatusLabelKey,
  mapListingStatusTone,
} from '../../../../shared/utils/listing-status.utils';
import type { MyListing } from '../../models/my-listing.model';

@Component({
  selector: 'app-my-listing-card',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, TranslatePipe, BadgeComponent],
  templateUrl: './my-listing-card.component.html',
  styleUrl: './my-listing-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyListingCardComponent {
  readonly listing = input.required<MyListing>();

  @Output() readonly editRequested = new EventEmitter<string>();
  @Output() readonly archiveRequested = new EventEmitter<string>();
  @Output() readonly restoreRequested = new EventEmitter<string>();

  protected readonly statusLabelKey = computed(() =>
    mapListingStatusLabelKey(this.listing().status),
  );

  protected readonly statusTone = computed(() =>
    mapListingStatusTone(this.listing().status),
  );

  protected readonly rejectionReasonI18nKey = computed(() => {
    const code = this.listing().rejection?.reasonCode;
    return code ? `admin.pendingListings.rejectSheet.reasons.${code}.title` : null;
  });

  protected requestEdit(): void {
    this.editRequested.emit(this.listing().id);
  }

  protected requestArchive(): void {
    this.archiveRequested.emit(this.listing().id);
  }

  protected requestRestore(): void {
    this.restoreRequested.emit(this.listing().id);
  }
}
