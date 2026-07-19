import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let _idSeed = 0;

@Component({
  selector: 'app-ui-input',
  standalone: true,
  imports: [],
  templateUrl: './ui-input.component.html',
  styleUrl: './ui-input.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UiInputComponent),
      multi: true,
    },
  ],
})
export class UiInputComponent implements ControlValueAccessor {
  @ViewChild('inputRef') readonly inputRef!: ElementRef<HTMLInputElement>;

  // ── Inputs ──────────────────────────────────────────────────────────
  readonly value          = input<string>('');
  readonly placeholder    = input<string>('');
  readonly label          = input<string>('');
  readonly ariaLabel      = input<string>('');
  readonly disabled       = input<boolean>(false);
  readonly readonly       = input<boolean>(false);
  readonly required       = input<boolean>(false);
  readonly errorMessage   = input<string | null>(null);
  readonly successMessage = input<string | null>(null);
  readonly leftIcon       = input<string>('');
  readonly rightIcon      = input<string>('');
  readonly type           = input<'text' | 'email' | 'password' | 'number' | 'search' | 'tel'>('text');
  readonly hint           = input<string>('');
  readonly maxLength      = input<number | null>(null);
  readonly autocomplete   = input<string>('off');
  readonly size           = input<'sm' | 'md' | 'lg'>('md');
  /**
   * outlined  — default: white bg, visible border (forms, settings)
   * filled    — muted fill, no border (toolbars, dense lists)
   * ghost     — alias for filled (backward compat)
   * pill      — fully rounded, brand hero search
   */
  readonly variant        = input<'outlined' | 'filled' | 'ghost' | 'pill'>('outlined');
  /** Orange CTA button rendered inside pill variant */
  readonly ctaLabel       = input<string>('');

  // ── Outputs ─────────────────────────────────────────────────────────
  readonly valueChange = output<string>();
  readonly focus       = output<FocusEvent>();
  readonly blur        = output<FocusEvent>();
  readonly clear       = output<void>();
  readonly ctaClicked  = output<void>();

  // ── A11y IDs ────────────────────────────────────────────────────────
  protected readonly inputId  = `uii-${++_idSeed}`;
  protected readonly helperId = `uii-help-${_idSeed}`;

  // ── Internal state ───────────────────────────────────────────────────
  protected readonly internalValue   = signal('');
  protected readonly isFocused       = signal(false);
  protected readonly passwordVisible = signal(false);
  private   readonly cvaDisabled     = signal(false);

  // True once the form infrastructure calls writeValue — means CVA owns the value
  private cvaActive = false;

  // ── Computed ─────────────────────────────────────────────────────────
  protected readonly isDisabledComp = computed(() => this.disabled() || this.cvaDisabled());
  protected readonly hasError        = computed(() => !!this.errorMessage());
  protected readonly hasSuccess      = computed(() => !!this.successMessage());
  protected readonly isFilled        = computed(() => this.internalValue().length > 0);
  protected readonly hasHelper       = computed(
    () => this.hasError() || this.hasSuccess() || !!this.hint(),
  );

  protected readonly showPasswordToggle = computed(() => this.type() === 'password');

  protected readonly showClear = computed(
    () =>
      this.isFilled() &&
      !this.isDisabledComp() &&
      !this.readonly() &&
      !this.showPasswordToggle(),
  );

  /** True for filled/ghost variants — muted background, no border */
  protected readonly isFilledVariant = computed(
    () => this.variant() === 'filled' || this.variant() === 'ghost',
  );

  /** Auto-infers icon from type when leftIcon is not explicitly passed */
  protected readonly resolvedLeftIcon = computed(() => {
    const li = this.leftIcon();
    if (li) return li;
    switch (this.type()) {
      case 'search':   return 'pi pi-search';
      case 'password': return 'pi pi-lock';
      case 'email':    return 'pi pi-envelope';
      case 'tel':      return 'pi pi-phone';
      default:         return '';
    }
  });

  protected readonly nativeType = computed(() => {
    const t = this.type();
    if (t === 'search') return 'text';
    if (t === 'password') return this.passwordVisible() ? 'text' : 'password';
    return t;
  });

  constructor() {
    // When NOT using CVA (e.g. [(value)] standalone binding), sync the input signal
    effect(() => {
      const v = this.value();
      if (!this.cvaActive) {
        this.internalValue.set(v);
      }
    });
  }

  // ── ControlValueAccessor ─────────────────────────────────────────────
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.cvaActive = true;
    this.internalValue.set(value ?? '');
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  // ── Event handlers ───────────────────────────────────────────────────
  protected handleInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.internalValue.set(val);
    this.onChange(val);
    this.valueChange.emit(val);
  }

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focus.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    this.onTouched();
    this.blur.emit(event);
  }

  protected handleClear(): void {
    this.internalValue.set('');
    this.onChange('');
    this.onTouched();
    this.valueChange.emit('');
    this.clear.emit();
    this.inputRef.nativeElement.focus();
  }

  protected handlePasswordToggle(): void {
    this.passwordVisible.update((v) => !v);
  }

  // ── Public API ───────────────────────────────────────────────────────
  focusInput(): void {
    this.inputRef.nativeElement.focus();
  }
}
