import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, Location } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { filter, take } from 'rxjs';

import { UiInputComponent } from '../../../../shared/ui/input/ui-input.component';

import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import type { MyListing, UpdateListingRequest } from '../../models/my-listing.model';
import { MyListingsApiService } from '../../services/my-listings-api.service';
import * as MyListingsActions from '../../store/my-listings.actions';
import { selectMyListingsItems, selectMyListingsLoading } from '../../store/my-listings.selectors';

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
  [],                        // 1 Photos (read-only)
  ['title', 'description'],  // 2 Basics
  ['pricePerDay'],           // 3 Pricing
  [],                        // 4 Safety & Hygiene (no confirmation gate in edit)
  [],                        // 5 Preview
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
  selector: 'app-edit-listing-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    InputNumberModule,
    ReactiveFormsModule,
    TranslatePipe,
    UiInputComponent,
  ],
  templateUrl: './edit-listing-page.component.html',
  styleUrl: './edit-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditListingPageComponent implements OnInit {
  private readonly fb         = inject(FormBuilder);
  private readonly store      = inject(Store);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly location   = inject(Location);
  private readonly api        = inject(MyListingsApiService);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ── Page state ────────────────────────────────────────────────
  protected readonly isSubmitting  = signal(false);
  protected readonly submitError   = signal<string | null>(null);
  protected readonly notFound      = signal(false);
  protected readonly isLoadingData = signal(true);
  protected readonly coverImageUrl = signal<string | null>(null);

  // ── Photo replacement ─────────────────────────────────────────
  protected selectedFiles: File[] = [];
  protected readonly imagePreviews = signal<string[]>([]);

  private listingId = '';

  // ── Wizard ────────────────────────────────────────────────────
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

  // ── Form ──────────────────────────────────────────────────────
  readonly form = this.fb.group(
    {
      title:         this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]),
      description:   this.fb.nonNullable.control('', [Validators.required, Validators.minLength(20), Validators.maxLength(4000)]),
      pricePerDay:   this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
      city:          this.fb.nonNullable.control('', [Validators.maxLength(120)]),
      ageFromMonths: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(600)]),
      ageToMonths:   this.fb.control<number | null>(null, [Validators.min(0), Validators.max(600)]),
      condition:     this.fb.nonNullable.control(''),
      hygieneNotes:  this.fb.nonNullable.control('', [Validators.maxLength(1000)]),
      safetyNotes:   this.fb.nonNullable.control('', [Validators.maxLength(1000)]),
    },
    { validators: ageRangeValidator },
  );

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.listingId) {
      this.notFound.set(true);
      this.isLoadingData.set(false);
      return;
    }

    this.store.dispatch(MyListingsActions.loadMyListings());

    this.store
      .select(selectMyListingsItems)
      .pipe(filter(items => items.length > 0), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        const listing = items.find(i => i.id === this.listingId);
        if (!listing) {
          this.notFound.set(true);
          this.isLoadingData.set(false);
          this.cdr.markForCheck();
          return;
        }
        this.prefill(listing);
        this.isLoadingData.set(false);
        this.cdr.markForCheck();
      });

    this.store
      .select(selectMyListingsLoading)
      .pipe(filter(loading => !loading), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isLoadingData()) {
          this.notFound.set(true);
          this.isLoadingData.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  private prefill(listing: MyListing): void {
    this.coverImageUrl.set(listing.imageUrl);

    this.form.patchValue({
      title:         listing.title,
      description:   listing.description ?? '',
      pricePerDay:   listing.pricePerDay,
      city:          listing.city,
      ageFromMonths: listing.ageFromMonths,
      ageToMonths:   listing.ageToMonths,
      condition:     listing.condition ?? '',
      hygieneNotes:  listing.hygieneNotes ?? '',
      safetyNotes:   listing.safetyNotes ?? '',
    });

    const ageMatch = AGE_CHIPS.find(
      c => c.fromMonths === listing.ageFromMonths && c.toMonths === listing.ageToMonths,
    );
    if (ageMatch) this.selectedAgeKey.set(ageMatch.key);

    const cond = listing.condition as ConditionChip['value'] | null;
    if (cond && CONDITION_CHIPS.some(c => c.value === cond)) {
      this.selectedCond.set(cond);
    }
  }

  // ── Navigation ────────────────────────────────────────────────
  goBack(): void {
    this.location.back();
  }

  goToNextStep(): void {
    const step  = this.currentStep();
    const names = STEP_CONTROLS[step - 1] ?? [];
    names.forEach(n => this.form.get(n)?.markAsTouched());
    const valid = names.every(n => this.form.get(n)?.valid !== false);
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

  // ── Chips ─────────────────────────────────────────────────────
  selectAge(chip: AgeChip): void {
    if (this.selectedAgeKey() === chip.key) {
      this.selectedAgeKey.set(null);
      this.form.patchValue({ ageFromMonths: null, ageToMonths: null });
    } else {
      this.selectedAgeKey.set(chip.key);
      this.form.patchValue({ ageFromMonths: chip.fromMonths, ageToMonths: chip.toMonths });
    }
  }

  selectCond(chip: ConditionChip): void {
    if (this.selectedCond() === chip.value) {
      this.selectedCond.set(null);
      this.form.patchValue({ condition: '' });
    } else {
      this.selectedCond.set(chip.value);
      this.form.patchValue({ condition: chip.value });
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
        if (++done === this.selectedFiles.length) {
          this.imagePreviews.set([...previews]);
          this.cdr.markForCheck();
        }
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
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
    // Reset the input so the same file can be re-selected if needed
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

  protected clearNewImages(): void {
    this.selectedFiles = [];
    this.imagePreviews.set([]);
  }

  // ── Helpers ───────────────────────────────────────────────────
  protected getSelectedAgeName(): string {
    const chip = this.ageChips.find(c => c.key === this.selectedAgeKey());
    if (!chip) return '—';
    return `${Math.round(chip.fromMonths / 12)}–${Math.round(chip.toMonths / 12)} yr`;
  }

  protected getConditionLabelKey(): string {
    const cond = this.selectedCond();
    return cond ? (this.conditionChips.find(c => c.value === cond)?.labelKey ?? '') : '';
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

  protected hasError(controlName: keyof typeof this.form.controls): boolean {
    const ctrl = this.form.controls[controlName];
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected titleErrorKey(): string {
    const ctrl = this.form.controls.title;
    if (ctrl.hasError('required')) return 'listings.createForm.validation.required';
    if (ctrl.hasError('minlength')) return 'listings.createForm.validation.titleTooShort';
    return 'listings.createForm.validation.titleTooLong';
  }

  protected safetyNoteLength(): number {
    return this.form.controls.safetyNotes.value.length;
  }

  protected hygieneNoteLength(): number {
    return this.form.controls.hygieneNotes.value.length;
  }

  // ── Submit ────────────────────────────────────────────────────
  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    if (raw.pricePerDay === null) return;

    const request: UpdateListingRequest = {
      title:         raw.title.trim(),
      description:   raw.description.trim(),
      pricePerDay:   raw.pricePerDay,
      city:          raw.city.trim() || undefined,
      ageFromMonths: raw.ageFromMonths,
      ageToMonths:   raw.ageToMonths,
      condition:     raw.condition || null,
      hygieneNotes:  raw.hygieneNotes.trim() || null,
      safetyNotes:   raw.safetyNotes.trim() || null,
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.api
      .updateListing(this.listingId, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.selectedFiles.length > 0) {
            this.api
              .replaceListingImages(this.listingId, this.selectedFiles)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => void this.router.navigate(['/my-listings']),
                error: (imgErr: unknown) => {
                  // Listing text was saved; image replace failed — show error, stay on page.
                  this.submitError.set(toApiErrorMessage(imgErr));
                  this.isSubmitting.set(false);
                  this.cdr.markForCheck();
                },
              });
          } else {
            void this.router.navigate(['/my-listings']);
          }
        },
        error: (err: unknown) => {
          this.submitError.set(toApiErrorMessage(err));
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        },
      });
  }
}
