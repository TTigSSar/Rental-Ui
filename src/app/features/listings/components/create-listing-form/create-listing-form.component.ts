import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';

import type {
  CreateListingRequest,
  ListingCategoryOption,
} from '../../models/create-listing.model';

interface ConditionOption {
  readonly value: 'New' | 'LikeNew' | 'Good' | 'Fair';
  readonly labelKey: string;
}

interface WizardStep {
  readonly index: number;
  readonly labelKey: string;
}

const CONDITION_OPTIONS: readonly ConditionOption[] = [
  { value: 'New', labelKey: 'listings.createForm.conditionOptions.new' },
  { value: 'LikeNew', labelKey: 'listings.createForm.conditionOptions.likeNew' },
  { value: 'Good', labelKey: 'listings.createForm.conditionOptions.good' },
  { value: 'Fair', labelKey: 'listings.createForm.conditionOptions.fair' },
];

function ageRangeValidator(control: AbstractControl): ValidationErrors | null {
  const fromValue = control.get('ageFromMonths')?.value;
  const toValue = control.get('ageToMonths')?.value;
  if (typeof fromValue === 'number' && typeof toValue === 'number' && toValue < fromValue) {
    return { ageRangeInvalid: true };
  }
  return null;
}

@Component({
  selector: 'app-create-listing-form',
  standalone: true,
  imports: [
    ButtonModule,
    CurrencyPipe,
    InputNumberModule,
    InputTextModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
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

  protected readonly conditionOptions = CONDITION_OPTIONS;

  protected readonly currentStep = signal(1);
  protected readonly totalSteps = 4;

  protected readonly WIZARD_STEPS: readonly WizardStep[] = [
    { index: 1, labelKey: 'listings.createPage.wizard.step1Label' },
    { index: 2, labelKey: 'listings.createPage.wizard.step2Label' },
    { index: 3, labelKey: 'listings.createPage.wizard.step3Label' },
    { index: 4, labelKey: 'listings.createPage.wizard.step4Label' },
  ];

  private readonly STEP_CONTROL_NAMES: readonly string[][] = [
    ['title', 'categoryId', 'pricePerDay'],
    ['ageFromMonths', 'ageToMonths'],
    ['description'],
    [],
  ];

  readonly createListingForm = this.fb.group(
    {
      title: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(200),
      ]),
      description: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(20),
        Validators.maxLength(4000),
      ]),
      categoryId: this.fb.nonNullable.control('', [Validators.required]),
      pricePerDay: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.01),
      ]),
      addressLine: this.fb.nonNullable.control(''),
      latitude: this.fb.control<number | null>(null),
      longitude: this.fb.control<number | null>(null),
      ageFromMonths: this.fb.control<number | null>(null, [Validators.min(0)]),
      ageToMonths: this.fb.control<number | null>(null, [Validators.min(0)]),
      condition: this.fb.nonNullable.control<'' | ConditionOption['value']>(''),
      hygieneNotes: this.fb.nonNullable.control(''),
      safetyNotes: this.fb.nonNullable.control(''),
      depositAmount: this.fb.control<number | null>(null, [Validators.min(0)]),
    },
    { validators: ageRangeValidator },
  );

  protected selectedFiles: File[] = [];

  protected goToNextStep(): void {
    const step = this.currentStep();
    const names = this.STEP_CONTROL_NAMES[step - 1] ?? [];
    names.forEach(name => this.createListingForm.get(name)?.markAsTouched());
    const fieldsValid = names.every(name => {
      const ctrl = this.createListingForm.get(name);
      return ctrl === null || ctrl.valid;
    });
    const noCrossError = step !== 2 || !this.createListingForm.hasError('ageRangeInvalid');
    if (fieldsValid && noCrossError) {
      this.currentStep.update(s => Math.min(s + 1, this.totalSteps));
      this.scrollToTop();
    }
  }

  protected goToPrevStep(): void {
    this.currentStep.update(s => Math.max(s - 1, 1));
    this.scrollToTop();
  }

  protected jumpToStep(step: number): void {
    this.currentStep.set(step);
    this.scrollToTop();
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected getCategoryName(): string {
    const id = this.createListingForm.controls.categoryId.value;
    return this.categories.find(c => c.id === id)?.name ?? id;
  }

  protected getConditionLabelKey(): string | null {
    const val = this.createListingForm.controls.condition.value;
    if (!val) return null;
    return this.conditionOptions.find(o => o.value === val)?.labelKey ?? null;
  }

  protected hasToyDetailValues(): boolean {
    const c = this.createListingForm.controls;
    return !!(
      c.ageFromMonths.value ||
      c.ageToMonths.value ||
      c.condition.value ||
      c.hygieneNotes.value ||
      c.safetyNotes.value ||
      c.depositAmount.value
    );
  }

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
      country: 'Armenia',
      city: 'Yerevan',
      addressLine: this.toNullableString(rawValue.addressLine),
      latitude: rawValue.latitude,
      longitude: rawValue.longitude,
      ageFromMonths: rawValue.ageFromMonths,
      ageToMonths: rawValue.ageToMonths,
      condition: rawValue.condition === '' ? null : rawValue.condition,
      hygieneNotes: this.toNullableString(rawValue.hygieneNotes),
      safetyNotes: this.toNullableString(rawValue.safetyNotes),
      depositAmount: rawValue.depositAmount,
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

  protected hasAgeRangeError(): boolean {
    const form = this.createListingForm;
    return (
      form.hasError('ageRangeInvalid') &&
      (form.controls.ageFromMonths.touched || form.controls.ageToMonths.touched)
    );
  }

  protected fileNames(): string {
    return this.selectedFiles.map((file) => file.name).join(', ');
  }

  private toNullableString(value: string): string | null {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
}
