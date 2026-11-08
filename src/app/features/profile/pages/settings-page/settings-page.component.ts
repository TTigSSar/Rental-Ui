import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageOption, LanguageService } from '../../../../shared/services/language.service';
import { LanguageSheetComponent } from '../../components/language-sheet/language-sheet.component';
import { NotificationsSheetComponent } from '../../components/notifications-sheet/notifications-sheet.component';
import { PasswordSheetComponent } from '../../components/password-sheet/password-sheet.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { selectAuthUser } from '../../../auth/store/auth.selectors';
import { DeleteAccountDialogComponent } from '../../components/delete-account-dialog/delete-account-dialog.component';

/**
 * `/profile/settings` — the account settings list (AD-1). Rows: Password (link), Language
 * (inline expand, reuses `LanguageService`), Notifications (opens the notifications sheet/dialog).
 * Below the divider sits the Delete-account card (AD-4, ADR-056): shown to every signed-in user
 * except admins, including accounts blocked by moderation; it opens `DeleteAccountDialogComponent`.
 */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    DeleteAccountDialogComponent,
    IconComponent,
    LanguageSheetComponent,
    NotificationsSheetComponent,
    PageHeaderComponent,
    PasswordSheetComponent,
    TranslatePipe,
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  private readonly languageService = inject(LanguageService);
  private readonly store = inject(Store);

  /** `hasPassword` lives on the auth store's `CurrentUser`, not on the profile slice. */
  private readonly currentUser = this.store.selectSignal(selectAuthUser);

  /**
   * Google-only accounts have no password to change; the Password row then renders inactive with
   * the "You sign in with Google" hint, and the delete dialog asks for the email instead.
   */
  protected readonly passwordManagedByGoogle = computed(
    () => this.currentUser()?.hasPassword === false,
  );

  /** Admins cannot delete their account (`account.admin_cannot_delete`), so the row is hidden. */
  protected readonly canDeleteAccount = computed(() => {
    const user = this.currentUser();
    return user !== null && !user.roles.includes('Admin');
  });

  protected readonly deleteDialogOpen = signal(false);

  protected openDeleteDialog(): void {
    this.deleteDialogOpen.set(true);
  }

  protected closeDeleteDialog(): void {
    this.deleteDialogOpen.set(false);
  }

  protected readonly availableLanguages: readonly LanguageOption[] = this.languageService.languages;
  protected readonly currentLang = this.languageService.current;
  protected readonly languageOpen = signal(false);

  protected openLanguage(): void {
    this.languageOpen.set(true);
  }

  protected closeLanguage(): void {
    this.languageOpen.set(false);
  }

  protected selectLanguage(option: LanguageOption): void {
    this.languageService.use(option.code);
    this.languageOpen.set(false);
  }

  protected readonly passwordOpen = signal(false);

  protected openPassword(): void {
    this.passwordOpen.set(true);
  }

  protected closePassword(): void {
    this.passwordOpen.set(false);
  }

  protected readonly notificationsOpen = signal(false);

  protected openNotifications(): void {
    this.notificationsOpen.set(true);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }
}
