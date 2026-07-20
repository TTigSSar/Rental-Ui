import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageOption, LanguageService } from '../../services/language.service';

/**
 * Guest-facing language switcher, shared between the desktop header
 * (`variant="dropdown"`, anchored panel) and the mobile Home top row
 * (`variant="sheet"`, fixed bottom sheet). Talks to `LanguageService`
 * directly — no inputs/outputs beyond the variant, no component state for
 * the active language.
 */
@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './language-selector.component.html',
  styleUrl: './language-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lang-selector',
    '[class.lang-selector--sheet]': "variant() === 'sheet'",
    '[class.lang-selector--open]': 'open()',
  },
})
export class LanguageSelectorComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  protected readonly languageService = inject(LanguageService);

  readonly variant = input.required<'dropdown' | 'sheet'>();

  protected readonly open = signal(false);
  protected readonly languages = this.languageService.languages;
  protected readonly current = this.languageService.current;

  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('trigger');

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected select(option: LanguageOption): void {
    this.languageService.use(option.code);
    this.close(true);
  }

  protected onScrimClick(): void {
    this.close(false);
  }

  protected onCloseButtonClick(): void {
    this.close(true);
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocumentMouseDown(event: MouseEvent): void {
    // Outside-mousedown dismissal only applies to the anchored dropdown; the
    // sheet is dismissed via its own scrim tap / close button / Escape.
    if (!this.open() || this.variant() !== 'dropdown') return;
    const target = event.target as Node | null;
    if (target !== null && !this.elementRef.nativeElement.contains(target)) {
      this.close(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close(true);
  }

  private close(returnFocus: boolean): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) {
      this.triggerRef()?.nativeElement.focus();
    }
  }
}
