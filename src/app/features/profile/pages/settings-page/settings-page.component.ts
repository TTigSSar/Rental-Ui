import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageOption, LanguageService } from '../../../../shared/services/language.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

/**
 * `/profile/settings` — the account settings list (AD-1). Rows: Password (link), Language
 * (inline expand, reuses `LanguageService`), Notifications (inactive, "Coming soon").
 * The Delete-account card (AD-4) drops into the `settings-page__danger-slot` below the divider.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [IconComponent, PageHeaderComponent, RouterLink, TranslatePipe],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  private readonly languageService = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Google-only accounts have no password to change; the Password row then renders inactive with
   * the "You sign in with Google" hint. AD-4 wires this to `CurrentUserResponse.hasPassword`
   * (the field lands with AD-2) — until then always false.
   */
  protected readonly passwordManagedByGoogle = signal(false);

  protected readonly availableLanguages: readonly LanguageOption[] = this.languageService.languages;
  protected readonly currentLang = this.languageService.current;
  protected readonly languageMenuOpen = signal(false);

  protected toggleLanguageMenu(): void {
    this.languageMenuOpen.update((v) => !v);
  }

  protected selectLanguage(option: LanguageOption): void {
    this.languageService.use(option.code);
    this.languageMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    const section = this.host.nativeElement.querySelector('[data-lang-section]');
    if (target !== null && !section?.contains(target)) {
      this.languageMenuOpen.set(false);
    }
  }
}
