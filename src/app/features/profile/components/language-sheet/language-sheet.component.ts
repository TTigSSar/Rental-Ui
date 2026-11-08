import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { LanguageOption } from '../../../../shared/services/language.service';
import { SettingsSheetComponent } from '../settings-sheet/settings-sheet.component';

/**
 * Settings > Language sheet (ADR-021 amendment 2026-11-08): a listbox of the available languages
 * in their own script, check + `aria-selected` on the current one. Tapping an option emits
 * `selected` (the page applies it through `LanguageService` and closes the sheet) — no footer,
 * no toast. Focus starts on the current option; arrow keys move between options.
 */
@Component({
  selector: 'app-language-sheet',
  standalone: true,
  imports: [SettingsSheetComponent, TranslatePipe],
  templateUrl: './language-sheet.component.html',
  styleUrl: './language-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSheetComponent {
  readonly languages = input.required<readonly LanguageOption[]>();
  readonly currentCode = input.required<string>();

  readonly selected = output<LanguageOption>();
  readonly closed = output<void>();

  protected onOptionKeydown(event: KeyboardEvent): void {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    // The sheet is portalled to <body>, so query from the focused option's own listbox.
    const listbox = (event.target as HTMLElement).closest('[role="listbox"]');
    const options = Array.from(listbox?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = options.indexOf(event.target as HTMLElement);
    options[(index + step + options.length) % options.length]?.focus();
  }
}
