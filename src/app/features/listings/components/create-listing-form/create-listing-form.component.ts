import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CurrencyPipe, Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';

import type {
  CreateListingRequest,
  ListingCategoryOption,
} from '../../models/create-listing.model';

interface AgeChip {
  readonly key: string;
  readonly fromMonths: number;
  readonly toMonths: number;
}

interface ConditionChip {
  readonly value: 'New' | 'LikeNew' | 'Good' | 'Fair';
  readonly labelKey: string;
}

const AGE_CHIPS: readonly AgeChip[] = [
  { key: 'y02',  fromMonths: 0,   toMonths: 24  },
  { key: 'y35',  fromMonths: 36,  toMonths: 60  },
  { key: 'y68',  fromMonths: 72,  toMonths: 96  },
  { key: 'y912', fromMonths: 108, toMonths: 144 },
];

const CONDITION_CHIPS: readonly ConditionChip[] = [
  { value: 'New',     labelKey: 'listings.createForm.conditionOptions.new'     },
  { value: 'LikeNew', labelKey: 'listings.createForm.conditionOptions.likeNew' },
  { value: 'Good',    labelKey: 'listings.createForm.conditionOptions.good'    },
  { value: 'Fair',    labelKey: 'listings.createForm.conditionOptions.fair'    },
];

const MIN_RENTAL_DAYS = [1, 3, 7, 14] as const;

const STEP_CONTROLS: readonly string[][] = [
  [],                                      // 1 Photos
  ['title', 'categoryId', 'description'],  // 2 Basics
  ['pricePerDay'],                         // 3 Pricing
  [],                                      // 4 Safety (signal-gated)
  [],                                      // 5 Preview
];

function ageRangeValidator(control: AbstractControl): ValidationErrors | null {
  const from = control.get('ageFromMonths')?.value;
  const to   = control.get('ageToMonths')?.value;
  if (typeof from === 'number' && typeof to === 'number' && to < from) {
    return { ageRangeInvalid: true };
  }
  return null;
}

@Component({
  selector: 'app-create-listing-form',
  standalone: true,
  imports: [
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
  private readonly fb       = inject(FormBuilder);
  private readonly location = inject(Location);

  @Input() categories: ListingCategoryOption[] = [];
  @Input() isSubmitting = false;
  @Input() createError: string | null = null;

  @Output() readonly submitted = new EventEmitter<{ payload: CreateListingRequest; files: File[] }>();
  @Output() readonly cancelled = new EventEmitter<void>();

  // ── Wizard ───────────────────────────────────────────────────
  readonly currentStep = signal(1);
  readonly totalSteps  = 5;
  readonly progressPct = computed(() => (this.currentStep() / this.totalSteps) * 100);

  // ── Chip data ─────────────────────────────────────────────────
  readonly ageChips       = AGE_CHIPS;
  readonly conditionChips = CONDITION_CHIPS;
  readonly minRentalDays  = MIN_RENTAL_DAYS;

  // ── Chip state ────────────────────────────────────────────────
  readonly selectedAgeKey  = signal<string | null>(null);
  readonly selectedCond    = signal<ConditionChip['value'] | null>(null);
  readonly selectedMinDays = signal<number>(1);

  // ── Safety state ──────────────────────────────────────────────
  readonly cleanWashed      = signal(false);
  readonly cleanDisinfected = signal(false);
  readonly cleanUV          = signal(false);
  readonly safetyConfirmed  = signal(false);

  // ── Images ────────────────────────────────────────────────────
  selectedFiles: File[] = [];
  readonly imagePreviews = signal<string[]>([]);

  // ── Form ──────────────────────────────────────────────────────
  readonly createListingForm = this.fb.group(
    {
      title:         this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]),
      description:   this.fb.nonNullable.control('', [Validators.required, Validators.minLength(20), Validators.maxLength(4000)]),
      categoryId:    this.fb.nonNullable.control('', [Validators.required]),
      pricePerDay:   this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
      addressLine:   this.fb.nonNullable.control(''),
      latitude:      this.fb.control<number | null>(null),
      longitude:     this.fb.control<number | null>(null),
      ageFromMonths: this.fb.control<number | null>(null, [Validators.min(0)]),
      ageToMonths:   this.fb.control<number | null>(null, [Validators.min(0)]),
      condition:     this.fb.nonNullable.control<'' | ConditionChip['value']>(''),
      hygieneNotes:  this.fb.nonNullable.control(''),
      safetyNotes:   this.fb.nonNullable.control(''),
      depositAmount: this.fb.control<number | null>(null, [Validators.min(0)]),
    },
    { validators: ageRangeValidator },
  );

  // ── Navigation ────────────────────────────────────────────────
  goBack(): void {
    this.location.back();
  }

  goToNextStep(): void {
    const step  = this.currentStep();
    const names = STEP_CONTROLS[step - 1] ?? [];
    names.forEach(n => this.createListingForm.get(n)?.markAsTouched());
    const valid = names.every(n => this.createListingForm.get(n)?.valid !== false);
    if (step === 4 && !this.safetyConfirmed()) return;
    if (valid) {
      this.currentStep.update(s => Math.min(s + 1, this.totalSteps));
      this.scrollToTop();
    }
  }

  goToPrevStep(): void {
    this.currentStep.update(s => Math.max(s - 1, 1));
    this.scrollToTop();
  }

  jumpToStep(step: number): void {
    this.currentStep.set(step);
    this.scrollToTop();
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Chip handlers ─────────────────────────────────────────────
  selectAge(chip: AgeChip): void {
    if (this.selectedAgeKey() === chip.key) {
      this.selectedAgeKey.set(null);
      this.createListingForm.patchValue({ ageFromMonths: null, ageToMonths: null });
    } else {
      this.selectedAgeKey.set(chip.key);
      this.createListingForm.patchValue({ ageFromMonths: chip.fromMonths, ageToMonths: chip.toMonths });
    }
  }

  selectCond(chip: ConditionChip): void {
    if (this.selectedCond() === chip.value) {
      this.selectedCond.set(null);
      this.createListingForm.patchValue({ condition: '' });
    } else {
      this.selectedCond.set(chip.value);
      this.createListingForm.patchValue({ condition: chip.value });
    }
  }

  // ── Images ────────────────────────────────────────────────────

  // Cover area: multi-select that replaces all current selections
  protected onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.selectedFiles = Array.from(input.files).slice(0, 6);
    const previews = new Array<string>(this.selectedFiles.length);
    let done = 0;
    if (this.selectedFiles.length === 0) { this.imagePreviews.set([]); return; }
    this.selectedFiles.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = e => {
        previews[i] = e.target?.result as string;
        if (++done === this.selectedFiles.length) this.imagePreviews.set([...previews]);
      };
      reader.readAsDataURL(file);
    });
  }

  // Individual slot: appends one file at the next available position
  protected onSlotImageAdded(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    if (this.selectedFiles.length >= 6) return;
    const file = input.files[0];
    this.selectedFiles = [...this.selectedFiles, file];
    const idx = this.selectedFiles.length - 1;
    const reader = new FileReader();
    reader.onload = e => {
      const prev = [...this.imagePreviews()];
      prev[idx] = e.target?.result as string;
      this.imagePreviews.set([...prev]);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // Remove one photo by index
  protected removePhoto(index: number): void {
    this.selectedFiles = [
      ...this.selectedFiles.slice(0, index),
      ...this.selectedFiles.slice(index + 1),
    ];
    this.imagePreviews.update(prev => prev.filter((_, i) => i !== index));
  }

  // ── Helpers ───────────────────────────────────────────────────
  protected getCategoryName(): string {
    const id = this.createListingForm.controls.categoryId.value;
    return this.categories.find(c => c.id === id)?.name ?? id;
  }

  protected getSelectedAgeName(): string {
    const key  = this.selectedAgeKey();
    const chip = this.ageChips.find(c => c.key === key);
    if (!chip) return '—';
    return `${Math.round(chip.fromMonths / 12)}–${Math.round(chip.toMonths / 12)} yr`;
  }

  protected getConditionLabelKey(): string {
    const cond = this.selectedCond();
    if (!cond) return '';
    return this.conditionChips.find(c => c.value === cond)?.labelKey ?? '';
  }

  protected getStepNameKey(): string {
    const keys = [
      'listings.createPage.wizard.step1Label',
      'listings.createPage.wizard.step2Label',
      'listings.createPage.wizard.step3Label',
      'listings.createPage.wizard.step4Label',
      'listings.createPage.wizard.step5Label',
    ];
    return keys[this.currentStep() - 1] ?? '';
  }

  protected getContinueLabelKey(): string {
    const keys = [
      'listings.createPage.wizard.continueToBasics',
      'listings.createPage.wizard.continueToPricing',
      'listings.createPage.wizard.continueToSafety',
      'listings.createPage.wizard.continueToPreview',
    ];
    return keys[this.currentStep() - 1] ?? 'listings.createPage.wizard.continue';
  }

  protected noteLength(): number {
    return this.createListingForm.controls.safetyNotes.value.length;
  }

  protected hasError(controlName: keyof typeof this.createListingForm.controls): boolean {
    const ctrl = this.createListingForm.controls[controlName];
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  // ── Submit ────────────────────────────────────────────────────
  protected onSubmit(): void {
    if (this.createListingForm.invalid) {
      this.createListingForm.markAllAsTouched();
      return;
    }
    const raw = this.createListingForm.getRawValue();
    if (raw.pricePerDay === null) return;

    const checks: string[] = [];
    if (this.cleanWashed())      checks.push('Washed with soap & water');
    if (this.cleanDisinfected()) checks.push('Disinfected with safe wipes');
    if (this.cleanUV())          checks.push('UV-sanitized');
    const rawHygiene   = raw.hygieneNotes.trim();
    const hygieneNotes = checks.length
      ? (rawHygiene ? `${checks.join(', ')}. ${rawHygiene}` : checks.join(', '))
      : (rawHygiene || null);

    const payload: CreateListingRequest = {
      title:         raw.title.trim(),
      description:   raw.description.trim(),
      categoryId:    raw.categoryId.trim(),
      pricePerDay:   raw.pricePerDay,
      country:       'Armenia',
      city:          'Yerevan',
      addressLine:   this.toNullStr(raw.addressLine),
      latitude:      raw.latitude,
      longitude:     raw.longitude,
      ageFromMonths: raw.ageFromMonths,
      ageToMonths:   raw.ageToMonths,
      condition:     raw.condition === '' ? null : raw.condition,
      hygieneNotes,
      safetyNotes:   this.toNullStr(raw.safetyNotes),
      depositAmount: raw.depositAmount,
    };

    this.submitted.emit({ payload, files: this.selectedFiles });
  }

  private toNullStr(v: string): string | null {
    const s = v.trim();
    return s === '' ? null : s;
  }
}
