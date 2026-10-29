import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { ListingCategoryOption } from '../../models/create-listing.model';

/**
 * AI search found nothing (stage 2, option A): stacked full-width actions. The primary is
 * "Widen the area" when a district filter is set (the host drops the districts and re-runs),
 * otherwise "Edit description". "Increase the budget" focuses the price "To". Category pills
 * replace only the category. There is no "Clear filters" and the bell is not rendered (it ships
 * with the subscriptions feature, Trello #220).
 */
@Component({
  selector: 'app-ai-no-results',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './ai-no-results.component.html',
  styleUrl: './ai-no-results.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiNoResultsComponent {
  readonly hasDistrictFilter = input(false);
  /** The categories offered as pills (the host leaves out the one already applied). */
  readonly categories = input<readonly ListingCategoryOption[]>([]);
  readonly widen = output<void>();
  readonly increaseBudget = output<void>();
  readonly editDescription = output<void>();
  readonly categorySelected = output<string>();
}
