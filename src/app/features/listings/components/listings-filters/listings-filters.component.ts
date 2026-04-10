import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';

import type { ListingsFilter } from '../../models/listings-filter.model';

@Component({
  selector: 'app-listings-filters',
  standalone: true,
  imports: [
    InputNumberModule,
    InputTextModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  templateUrl: './listings-filters.component.html',
  styleUrl: './listings-filters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsFiltersComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);

  @Output() readonly filtersChanged = new EventEmitter<ListingsFilter>();

  readonly filterForm = this.fb.group({
    city: this.fb.nonNullable.control(''),
    categoryId: this.fb.nonNullable.control(''),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
  });

  constructor() {
    this.filterForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.filtersChanged.emit(this.toListingsFilter());
      });
  }

  private toListingsFilter(): ListingsFilter {
    const raw = this.filterForm.getRawValue();
    const city = raw.city.trim();
    const categoryId = raw.categoryId.trim();
    return {
      city: city === '' ? null : city,
      categoryId: categoryId === '' ? null : categoryId,
      minPrice: raw.minPrice,
      maxPrice: raw.maxPrice,
    };
  }
}
