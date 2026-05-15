import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  OnInit,
  Output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { debounceTime } from 'rxjs';

import type { ListingCategoryOption } from '../../models/create-listing.model';
import type { ListingsFilter } from '../../models/listings-filter.model';
import * as ListingsActions from '../../store/listings.actions';
import { selectListingCategories } from '../../store/listings.selectors';

@Component({
  selector: 'app-listings-filters',
  standalone: true,
  imports: [
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  templateUrl: './listings-filters.component.html',
  styleUrl: './listings-filters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsFiltersComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);

  @Output() readonly filtersChanged = new EventEmitter<ListingsFilter>();

  protected readonly categories = toSignal(
    this.store.select(selectListingCategories),
    { initialValue: [] as ListingCategoryOption[] },
  );

  readonly filterForm = this.fb.group({
    city: this.fb.nonNullable.control(''),
    categoryId: this.fb.nonNullable.control(''),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
  });

  constructor() {
    this.filterForm.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.filtersChanged.emit(this.toListingsFilter());
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  protected clearFilters(): void {
    this.filterForm.setValue({ city: '', categoryId: '', minPrice: null, maxPrice: null });
    this.filtersChanged.emit({ query: null, city: null, categoryId: null, minPrice: null, maxPrice: null });
  }

  private toListingsFilter(): ListingsFilter {
    const raw = this.filterForm.getRawValue();
    const city = raw.city.trim();
    const categoryId = raw.categoryId.trim();
    return {
      query: null,
      city: city === '' ? null : city,
      categoryId: categoryId === '' ? null : categoryId,
      minPrice: raw.minPrice,
      maxPrice: raw.maxPrice,
    };
  }
}
