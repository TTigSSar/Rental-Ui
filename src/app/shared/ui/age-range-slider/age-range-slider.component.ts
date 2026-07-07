import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

type Thumb = 'lo' | 'hi';

/** Maps an age range (in years) to a friendly band-label i18n key. */
export function ageBandLabelKey(lo: number, hi: number): string {
  const base = 'listings.createForm.ageBand.';
  if (hi <= 2) return base + 'babies';
  if (lo >= 9) return base + 'preTeens';
  if (lo >= 6) return base + 'bigKids';
  if (lo >= 3) return base + 'preschool';
  if (hi >= 6) return base + 'toddlersUp';
  return base + 'toddlers';
}

/**
 * Dual-thumb age range slider (Refined Warm). Angular port of the design's
 * `AgeRangeSlider`: two draggable thumbs over 0–max years ("max+"), live
 * readout, friendly age-band label and a tick row. Emits `[loYears, hiYears]`.
 */
@Component({
  selector: 'app-age-range-slider',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './age-range-slider.component.html',
  styleUrl: './age-range-slider.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgeRangeSliderComponent implements OnDestroy {
  readonly min = input(0);
  readonly max = input(12);
  /** Controlled value in YEARS as `[lo, hi]`. */
  readonly value = input<[number, number]>([2, 5]);

  readonly valueChange = output<[number, number]>();

  private readonly trackRef =
    viewChild.required<ElementRef<HTMLDivElement>>('track');

  protected readonly range = signal<[number, number]>([2, 5]);
  protected readonly active = signal<Thumb | null>(null);

  protected readonly lo = computed(() => this.range()[0]);
  protected readonly hi = computed(() => this.range()[1]);
  protected readonly bandKey = computed(() =>
    ageBandLabelKey(this.lo(), this.hi()),
  );
  protected readonly ticks = computed(() => {
    const out: number[] = [];
    for (let v = this.min(); v <= this.max(); v += 3) out.push(v);
    return out;
  });

  private movePointer = (e: PointerEvent | TouchEvent): void =>
    this.onMove(e);
  private upPointer = (): void => this.onUp();

  constructor() {
    // Mirror the controlled `value` input into local state when it changes
    // externally (e.g. draft resume), without echoing back during a drag.
    effect(() => {
      if (this.active() !== null) return;
      const [lo, hi] = this.value();
      this.range.set([this.clampLo(lo, hi), this.clampHi(hi, lo)]);
    });
  }

  ngOnDestroy(): void {
    this.detachWindowListeners();
  }

  protected pct(v: number): number {
    const span = this.max() - this.min();
    return span === 0 ? 0 : ((v - this.min()) / span) * 100;
  }

  protected fmt(v: number): string {
    return v >= this.max() ? `${this.max()}+` : `${v}`;
  }

  protected onThumbDown(event: PointerEvent, side: Thumb): void {
    event.preventDefault();
    this.active.set(side);
    window.addEventListener('pointermove', this.movePointer);
    window.addEventListener('pointerup', this.upPointer);
    window.addEventListener('touchmove', this.movePointer, { passive: false });
    window.addEventListener('touchend', this.upPointer);
  }

  protected onThumbKey(event: KeyboardEvent, side: Thumb): void {
    const current = side === 'lo' ? this.lo() : this.hi();
    let next = current;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - 1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + 1;
    if (next === current) return;
    event.preventDefault();
    this.applyThumb(side, next);
  }

  private onMove(event: PointerEvent | TouchEvent): void {
    const side = this.active();
    if (side === null) return;
    if (event.cancelable && event.type === 'touchmove') event.preventDefault();
    const clientX =
      'touches' in event ? event.touches[0]?.clientX : event.clientX;
    if (clientX === undefined) return;
    this.applyThumb(side, this.valueFromX(clientX));
  }

  private onUp(): void {
    this.active.set(null);
    this.detachWindowListeners();
  }

  private detachWindowListeners(): void {
    window.removeEventListener('pointermove', this.movePointer);
    window.removeEventListener('pointerup', this.upPointer);
    window.removeEventListener('touchmove', this.movePointer);
    window.removeEventListener('touchend', this.upPointer);
  }

  private valueFromX(clientX: number): number {
    const rect = this.trackRef().nativeElement.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    return Math.round(this.min() + ratio * (this.max() - this.min()));
  }

  private applyThumb(side: Thumb, raw: number): void {
    const [lo, hi] = this.range();
    const next: [number, number] =
      side === 'lo' ? [this.clampLo(raw, hi), hi] : [lo, this.clampHi(raw, lo)];
    if (next[0] === lo && next[1] === hi) return;
    this.range.set(next);
    this.valueChange.emit(next);
  }

  private clampLo(lo: number, hi: number): number {
    return Math.min(Math.max(this.min(), lo), hi);
  }

  private clampHi(hi: number, lo: number): number {
    return Math.max(Math.min(this.max(), hi), lo);
  }
}
