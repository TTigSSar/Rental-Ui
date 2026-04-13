import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';

import type { CreateListingRequest, ListingCategoryOption } from '../../models/create-listing.model';

@Component({
  selector: 'app-create-listing-form',
  standalone: true,
  imports: [ButtonModule, InputNumberModule, InputTextModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './create-listing-form.component.html',
  styleUrl: './create-listing-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateListingFormComponent {
  private readonly fb = inject(FormBuilder);

  @Input() categories: ListingCategoryOption[] = [];
  @Input() isSubmitting = false;

  @Output() readonly submitted = new EventEmitter<{ payload: CreateListingRequest; files: File[] }>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly createListingForm = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required]),
    description: this.fb.nonNullable.control('', [Validators.required]),
    categoryId: this.fb.nonNullable.control('', [Validators.required]),
    pricePerDay: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    country: this.fb.nonNullable.control('', [Validators.required]),
    city: this.fb.nonNullable.control('', [Validators.required]),
    addressLine: this.fb.nonNullable.control(''),
    latitude: this.fb.control<number | null>(null),
    longitude: this.fb.control<number | null>(null),
  });

  protected selectedFiles: File[] = [];

  protected onSubmit(): void {
    if (this.createListingForm.invalid) {
      this.createListingForm.markAllAsTouched();
      return;
    }

    const rawValue = this.createListingForm.getRawValue();
    if (rawValue.pricePerDay === null) {
      return;
    }

    const payload: CreateListingRequest = {
      title: rawValue.title.trim(),
      description: rawValue.description.trim(),
      categoryId: rawValue.categoryId.trim(),
      pricePerDay: rawValue.pricePerDay,
      country: rawValue.country.trim(),
      city: rawValue.city.trim(),
      addressLine: this.toNullableString(rawValue.addressLine),
      latitude: rawValue.latitude,
      longitude: rawValue.longitude,
    };

    this.submitted.emit({ payload, files: this.selectedFiles });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.selectedFiles = files ? Array.from(files) : [];
  }

  protected hasError(controlName: keyof typeof this.createListingForm.controls): boolean {
    const control = this.createListingForm.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected fileNames(): string {
    return this.selectedFiles.map((file) => file.name).join(', ');
  }

  private toNullableString(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
}
