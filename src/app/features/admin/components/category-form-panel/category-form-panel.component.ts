import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
} from '../../../../shared/utils/category-palette.model';

/**
 * The shared field block from the design's create panel / edit row / mobile edit sheet: a
 * live colour+icon preview tile, three required name inputs (English / Armenian / Russian,
 * ADR-062), and the icon + colour picker grids. Fully
 * controlled (name/iconName/colorHex are inputs, every edit is emitted up) so the same
 * markup drives the desktop inline create panel, the desktop inline edit row, and the
 * mobile edit bottom sheet (`CategoryEditSheetComponent`).
 *
 * Deliberately owns no Cancel/Confirm buttons: the design places them inline next to the
 * name input on desktop (create panel / edit row) but full-width below the colour grid on
 * the mobile sheet — different enough layouts that each caller renders its own footer
 * rather than this component forcing one shape via content projection.
 */
@Component({
  selector: 'app-category-form-panel',
  standalone: true,
  imports: [IconComponent, TranslatePipe],
  templateUrl: './category-form-panel.component.html',
  styleUrl: './category-form-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFormPanelComponent {
  readonly name = input<string>('');
  readonly nameHy = input<string>('');
  readonly nameRu = input<string>('');
  readonly iconName = input<string>(DEFAULT_CATEGORY_ICON);
  readonly colorHex = input<string>(DEFAULT_CATEGORY_COLOR);
  readonly busy = input<boolean>(false);
  readonly nameErrorMessage = input<string | null>(null);
  readonly namePlaceholder = input<string>('');
  readonly autoFocusName = input<boolean>(true);
  /** True once the caller attempted a submit: shows the required error on every blank name. */
  readonly submitAttempted = input<boolean>(false);

  readonly nameChange = output<string>();
  readonly nameHyChange = output<string>();
  readonly nameRuChange = output<string>();
  readonly iconChange = output<string>();
  readonly colorChange = output<string>();
  /** Enter pressed in a name field: the caller validates and decides whether to submit. */
  readonly submitName = output<void>();

  private readonly touched = signal({ en: false, hy: false, ru: false });

  protected readonly enRequired = computed(
    () => (this.touched().en || this.submitAttempted()) && this.name().trim().length === 0,
  );
  protected readonly hyRequired = computed(
    () => (this.touched().hy || this.submitAttempted()) && this.nameHy().trim().length === 0,
  );
  protected readonly ruRequired = computed(
    () => (this.touched().ru || this.submitAttempted()) && this.nameRu().trim().length === 0,
  );

  protected readonly icons = CATEGORY_ICON_OPTIONS;
  protected readonly colors = CATEGORY_COLOR_OPTIONS;

  protected markTouched(field: 'en' | 'hy' | 'ru'): void {
    this.touched.update((t) => ({ ...t, [field]: true }));
  }

  protected onNameInput(event: Event): void {
    this.nameChange.emit((event.target as HTMLInputElement).value);
  }

  protected onNameHyInput(event: Event): void {
    this.nameHyChange.emit((event.target as HTMLInputElement).value);
  }

  protected onNameRuInput(event: Event): void {
    this.nameRuChange.emit((event.target as HTMLInputElement).value);
  }

  protected onNameKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.busy()) {
      event.preventDefault();
      this.submitName.emit();
    }
  }
}
