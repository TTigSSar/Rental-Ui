import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
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
  readonly listing = input.required<PendingListing>();
  readonly actionLoading = input<boolean>(false);

  @Output() readonly approved = new EventEmitter<string>();
  @Output() readonly rejected = new EventEmitter<string>();

  protected approve(): void {
    this.approved.emit(this.listing().id);
  }

  protected reject(): void {
    this.rejected.emit(this.listing().id);
  }
}
