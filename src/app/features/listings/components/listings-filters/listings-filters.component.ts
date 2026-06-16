import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  inject,
  input,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { debounceTime } from 'rxjs';

import {
  CategorySelectorComponent,
  type CategoryOption,
} from '../../../../shared/ui/category-selector/category-selector.component';
import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';
import type { ListingCategoryOption } from '../../models/create-listing.model';
import type { ListingsFilter } from '../../models/listings-filter.model';
import * as ListingsActions from '../../store/listings.actions';
import { selectListingCategories } from '../../store/listings.selectors';

interface ActiveChip {
  readonly key: 'city' | 'categoryId' | 'minPrice' | 'maxPrice';
  readonly label: string;
}

@Component({
  selector: 'app-listings-filters',
  standalone: true,
  imports: [CategorySelectorComponent, InputNumberModule, ReactiveFormsModule, TranslatePipe, UiInputComponent],
  templateUrl: './listings-filters.component.html',
  styleUrl: './listings-filters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsFiltersComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  @Output() readonly filtersChanged = new EventEmitter<ListingsFilter>();

  /** When false, the active-filter chip row is suppressed (parent renders chips instead). */
  readonly showChips = input(true);

  protected readonly categories = toSignal(
    this.store.select(selectListingCategories),
    { initialValue: [] as ListingCategoryOption[] },
  );

  protected readonly categoryOptions = computed((): CategoryOption[] =>
    this.categories().map((c) => ({ id: c.id, name: c.name })),
  );

  readonly filterForm = this.fb.group({
    query: this.fb.nonNullable.control(''),
    city: this.fb.nonNullable.control(''),
    categoryId: this.fb.nonNullable.control(''),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
  });

  readonly draftForm = this.fb.group({
    city: this.fb.nonNullable.control(''),
    categoryId: this.fb.nonNullable.control(''),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
  });

  private readonly formValues = signal(this.filterForm.getRawValue());

  protected readonly activeChips = computed((): readonly ActiveChip[] => {
    const v = this.formValues();
    const chips: ActiveChip[] = [];
    if (v.categoryId) {
      const cat = this.categories().find((c) => c.id === v.categoryId);
      chips.push({ key: 'categoryId', label: cat?.name ?? v.categoryId });
    }
    if (v.minPrice != null) {
      chips.push({ key: 'minPrice', label: `Min ${v.minPrice}` });
    }
    if (v.maxPrice != null) {
      chips.push({ key: 'maxPrice', label: `Max ${v.maxPrice}` });
    }
    return chips;
  });

  protected readonly hasSheetFilters = computed(() => {
    const v = this.formValues();
    return !!(v.city.trim() || v.categoryId || v.minPrice != null || v.maxPrice != null);
  });

  protected readonly sheetOpen = signal(false);

  constructor() {
    this.filterForm.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formValues.set(this.filterForm.getRawValue());
        const filter = this.toListingsFilter();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: this.toQueryParams(filter),
          queryParamsHandling: 'replace',
        });
        this.filtersChanged.emit(filter);
      });

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
        this.formValues.set(this.filterForm.getRawValue());
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  ngOnDestroy(): void {
    this.doc.body.classList.remove('body--sheet-open');
  }

  protected openSheet(): void {
    const v = this.filterForm.getRawValue();
    this.draftForm.setValue({
      city: v.city,
      categoryId: v.categoryId,
      minPrice: v.minPrice,
      maxPrice: v.maxPrice,
    });
    this.sheetOpen.set(true);
    this.doc.body.classList.add('body--sheet-open');
  }

  protected closeSheet(): void {
    this.sheetOpen.set(false);
    this.doc.body.classList.remove('body--sheet-open');
  }

  protected applySheet(): void {
    const draft = this.draftForm.getRawValue();
    this.filterForm.patchValue({
      city: draft.city,
      categoryId: draft.categoryId,
      minPrice: draft.minPrice,
      maxPrice: draft.maxPrice,
    });
    this.closeSheet();
  }

  protected clearSheet(): void {
    const currentQuery = this.filterForm.getRawValue().query;
    this.filterForm.setValue({
      query: currentQuery,
      city: '',
      categoryId: '',
      minPrice: null,
      maxPrice: null,
    });
    this.closeSheet();
  }

  protected removeChip(key: ActiveChip['key']): void {
    switch (key) {
      case 'city':
        this.filterForm.patchValue({ city: '' });
        break;
      case 'categoryId':
        this.filterForm.patchValue({ categoryId: '' });
        break;
      case 'minPrice':
        this.filterForm.patchValue({ minPrice: null });
        break;
      case 'maxPrice':
        this.filterForm.patchValue({ maxPrice: null });
        break;
    }
  }

  private toListingsFilter(): ListingsFilter {
    const raw = this.filterForm.getRawValue();
    return {
      query: raw.query.trim() || null,
      city: raw.city.trim() || null,
      categoryId: raw.categoryId.trim() || null,
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
