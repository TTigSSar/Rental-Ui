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
import { ActivatedRoute, Router } from '@angular/router';
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @Output() readonly filtersChanged = new EventEmitter<ListingsFilter>();

  protected readonly categories = toSignal(
    this.store.select(selectListingCategories),
    { initialValue: [] as ListingCategoryOption[] },
  );

  readonly filterForm = this.fb.group({
    query: this.fb.nonNullable.control(''),
    city: this.fb.nonNullable.control(''),
    categoryId: this.fb.nonNullable.control(''),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
  });

  constructor() {
    this.filterForm.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const filter = this.toListingsFilter();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.toQueryParams(filter),
          queryParamsHandling: 'replace',
        });
        this.filtersChanged.emit(filter);
      });

    // Syncs the form from the URL on initial load and on browser back/forward.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const minPriceStr = params.get('minPrice');
        const maxPriceStr = params.get('maxPrice');
        this.filterForm.patchValue(
          {
            query: params.get('q') ?? '',
            city: params.get('city') ?? '',
            categoryId: params.get('categoryId') ?? '',
            minPrice:
              minPriceStr != null && !Number.isNaN(Number(minPriceStr))
                ? Number(minPriceStr)
                : null,
            maxPrice:
              maxPriceStr != null && !Number.isNaN(Number(maxPriceStr))
                ? Number(maxPriceStr)
                : null,
          },
          { emitEvent: false },
        );
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  protected clearFilters(): void {
    this.filterForm.setValue(
      { query: '', city: '', categoryId: '', minPrice: null, maxPrice: null },
      { emitEvent: false },
    );
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    this.filtersChanged.emit({ query: null, city: null, categoryId: null, minPrice: null, maxPrice: null });
  }

  private toListingsFilter(): ListingsFilter {
    const raw = this.filterForm.getRawValue();
    const query = raw.query.trim();
    const city = raw.city.trim();
    const categoryId = raw.categoryId.trim();
    return {
      query: query === '' ? null : query,
      city: city === '' ? null : city,
      categoryId: categoryId === '' ? null : categoryId,
      minPrice: raw.minPrice,
      maxPrice: raw.maxPrice,
    };
  }

  private toQueryParams(filter: ListingsFilter): Record<string, string | null> {
    return {
      q: filter.query,
      city: filter.city,
      categoryId: filter.categoryId,
      minPrice: filter.minPrice != null ? String(filter.minPrice) : null,
      maxPrice: filter.maxPrice != null ? String(filter.maxPrice) : null,
    };
  }
}
