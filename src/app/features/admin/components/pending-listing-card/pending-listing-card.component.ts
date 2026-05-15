import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

import type { PendingListing } from '../../models/pending-listing.model';

@Component({
  selector: 'app-pending-listing-card',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    CurrencyPipe,
    DatePipe,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './pending-listing-card.component.html',
  styleUrl: './pending-listing-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingListingCardComponent {
  private readonly translate = inject(TranslateService);

  readonly listing = input.required<PendingListing>();
  readonly actionLoading = input<boolean>(false);

  @Output() readonly approved = new EventEmitter<string>();
  @Output() readonly rejected = new EventEmitter<string>();

  protected readonly hasAnyToyDetails = computed(() => {
    const l = this.listing();
    return (
      l.ageFromMonths !== null ||
      l.ageToMonths !== null ||
      l.condition !== null ||
      l.hygieneNotes !== null ||
      l.safetyNotes !== null
    );
  });

  protected readonly ageRangeLabel = computed((): string => {
    const l = this.listing();
    const from = l.ageFromMonths;
    const to = l.ageToMonths;

    if (from !== null && to !== null) {
      return this.translate.instant('admin.pendingListings.card.ageFromTo', {
        from,
        to,
      });
    }
    if (from !== null) {
      return this.translate.instant('admin.pendingListings.card.ageFrom', {
        months: from,
      });
    }
    if (to !== null) {
      return this.translate.instant('admin.pendingListings.card.ageTo', {
        months: to,
      });
    }
    return '';
  });

  protected approve(): void {
    this.approved.emit(this.listing().id);
  }

  protected reject(): void {
    this.rejected.emit(this.listing().id);
  }
}
