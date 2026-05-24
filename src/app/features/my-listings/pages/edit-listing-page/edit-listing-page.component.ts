import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { filter, take } from 'rxjs';

import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import type { UpdateListingRequest } from '../../models/my-listing.model';
import { MyListingsApiService } from '../../services/my-listings-api.service';
import * as MyListingsActions from '../../store/my-listings.actions';
import { selectMyListingsItems, selectMyListingsLoading } from '../../store/my-listings.selectors';

function ageRangeValidator(control: AbstractControl): ValidationErrors | null {
  const from = control.get('ageFromMonths')?.value;
  const to = control.get('ageToMonths')?.value;
  if (typeof from === 'number' && typeof to === 'number' && to < from) {
    return { ageRangeInvalid: true };
  }
  return null;
}

@Component({
  selector: 'app-edit-listing-page',
  standalone: true,
  imports: [
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  templateUrl: './edit-listing-page.component.html',
  styleUrl: './edit-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditListingPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(MyListingsApiService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly notFound = signal(false);
  protected readonly isLoadingData = signal(true);

  private listingId = '';

  readonly form = this.fb.group(
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
      pricePerDay: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0.01),
      ]),
      city: this.fb.nonNullable.control('', [Validators.maxLength(120)]),
      ageFromMonths: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(600)]),
      ageToMonths: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(600)]),
      condition: this.fb.nonNullable.control(''),
      hygieneNotes: this.fb.nonNullable.control('', [Validators.maxLength(1000)]),
      safetyNotes: this.fb.nonNullable.control('', [Validators.maxLength(1000)]),
      depositAmount: this.fb.control<number | null>(null, [Validators.min(0)]),
    },
    { validators: ageRangeValidator },
  );

  ngOnInit(): void {
    this.listingId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.listingId) {
      this.notFound.set(true);
      this.isLoadingData.set(false);
      return;
    }

    this.store.dispatch(MyListingsActions.loadMyListings());

    // Wait for items to load, then find and populate the form.
    this.store
      .select(selectMyListingsItems)
      .pipe(
        filter((items) => items.length > 0),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        const listing = items.find((i) => i.id === this.listingId);
        if (!listing) {
          this.notFound.set(true);
          this.isLoadingData.set(false);
          this.cdr.markForCheck();
          return;
        }

        this.form.patchValue({
          title: listing.title,
          description: listing.description ?? '',
          pricePerDay: listing.pricePerDay,
          city: listing.city,
          ageFromMonths: listing.ageFromMonths,
          ageToMonths: listing.ageToMonths,
          condition: listing.condition ?? '',
          hygieneNotes: listing.hygieneNotes ?? '',
          safetyNotes: listing.safetyNotes ?? '',
          depositAmount: listing.depositAmount,
        });

        this.isLoadingData.set(false);
        this.cdr.markForCheck();
      });

    // Handle the case where load produces items=[] (e.g. owner has no listings).
    this.store
      .select(selectMyListingsLoading)
      .pipe(
        filter((loading) => !loading),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isLoadingData()) {
          this.notFound.set(true);
          this.isLoadingData.set(false);
          this.cdr.markForCheck();
        }
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.pricePerDay === null) {
      return;
    }

    const request: UpdateListingRequest = {
      title: raw.title.trim(),
      description: raw.description.trim(),
      pricePerDay: raw.pricePerDay,
      city: raw.city.trim() || undefined,
      ageFromMonths: raw.ageFromMonths,
      ageToMonths: raw.ageToMonths,
      condition: raw.condition || null,
      hygieneNotes: raw.hygieneNotes.trim() || null,
      safetyNotes: raw.safetyNotes.trim() || null,
      depositAmount: raw.depositAmount,
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);

    this.api
      .updateListing(this.listingId, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigate(['/my-listings']);
        },
        error: (err: unknown) => {
          this.submitError.set(toApiErrorMessage(err));
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  protected onCancel(): void {
    void this.router.navigate(['/my-listings']);
  }

  protected hasError(controlName: keyof typeof this.form.controls): boolean {
    const ctrl = this.form.controls[controlName];
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected hasAgeRangeError(): boolean {
    return (
      this.form.hasError('ageRangeInvalid') &&
      (this.form.controls.ageFromMonths.touched || this.form.controls.ageToMonths.touched)
    );
  }
}
