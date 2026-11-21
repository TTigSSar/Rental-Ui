import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { Menu, MenuModule } from 'primeng/menu';

import * as AuthActions from '../../../auth/store/auth.actions';
import {
  selectAvatarStatus,
  selectCurrentUserAvatarUrl,
} from '../../../auth/store/auth.selectors';
import { LanguageService } from '../../../../shared/services/language.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { SettingsSheetComponent } from '../settings-sheet/settings-sheet.component';

/** `accept` of the hidden file input: the three formats the browser can decode everywhere (no HEIC). */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * The profile-picture control (ADR-070, design-notes 1-6): the WHOLE avatar is one `<button>` that
 * opens the photo actions - a bottom sheet on mobile (`SettingsSheetComponent` shell), a popup
 * menu on desktop - plus the remove confirmation and the hidden file input. It owns no status or
 * error UI: `app-profile-avatar-feedback` renders those under the avatar row, because the error
 * panel has to span the row, not the 56-96px avatar.
 *
 * The page renders one control per visible surface and puts the mobile one behind `!isDesktop()`
 * and the desktop ones behind `isDesktop()`, so only one set of popups ever exists per layout
 * (same rule as the home-point card).
 *
 * Reads `auth.user.avatarUrl` and `avatarStatus` (the single source, ADR-070 section 13); writes
 * only by dispatching `uploadAvatar` / `removeAvatar`. While a mutation runs ONLY this button is
 * disabled (`aria-disabled`, not `disabled`, so focus is not lost); the rest of the page stays
 * usable.
 */
@Component({
  selector: 'app-profile-avatar-edit',
  standalone: true,
  imports: [AvatarComponent, DialogModule, MenuModule, SettingsSheetComponent, TranslatePipe],
  templateUrl: './profile-avatar-edit.component.html',
  styleUrl: './profile-avatar-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The remove dialog and the popup menu are portalled to <body>, so their shells never get this
  // component's emulated attribute; every selector is namespaced `pae*` / `pae-*`.
  encapsulation: ViewEncapsulation.None,
})
export class ProfileAvatarEditComponent {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly injector = inject(Injector);

  /** Full name - the initials fallback. */
  readonly name = input<string | null>(null);
  /** Circle diameter in px: 56 mobile card, 72 desktop sidebar, 96 desktop identity card. */
  readonly size = input<number>(56);
  /** Desktop = popup menu + hover scrim entry (option 2); otherwise sheet + camera badge. */
  readonly desktop = input(false);

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly menu = viewChild(Menu);

  protected readonly accept = AVATAR_ACCEPT;
  protected readonly avatarUrl = this.store.selectSignal(selectCurrentUserAvatarUrl);
  protected readonly status = this.store.selectSignal(selectAvatarStatus);
  protected readonly busy = computed(() => this.status() !== 'idle');
  protected readonly uploading = computed(() => this.status() === 'uploading');
  protected readonly hasPhoto = computed(() => this.avatarUrl() !== null);

  protected readonly badgePx = computed(() =>
    this.size() >= 96 ? 28 : this.size() >= 72 ? 24 : 22,
  );

  protected readonly sheetOpen = signal(false);
  protected readonly confirmOpen = signal(false);

  /** One unique mask class so a backdrop click can be told apart (M-029, see home-point card). */
  protected readonly removeMaskClass = 'pae-remove__mask';

  protected readonly menuItems = computed<MenuItem[]>(() => {
    // Reactivity trigger only: p-menu cannot translate its model itself (admin-shell idiom).
    this.languageService.current();
    const has = this.hasPhoto();
    const items: MenuItem[] = [
      {
        label: this.translate.instant(has ? 'profile.avatar.change' : 'profile.avatar.upload'),
        icon: has ? 'pi pi-camera' : 'pi pi-upload',
        command: () => this.pickFile(),
      },
    ];
    if (has) {
      items.push(
        { separator: true },
        {
          label: this.translate.instant('profile.avatar.remove'),
          icon: 'pi pi-trash',
          styleClass: 'pae-menu__danger',
          command: () => this.openConfirm(),
        },
      );
    }
    // The heading is a submenu label so the list is announced with its name.
    return [{ label: this.translate.instant('profile.avatar.sheetTitle'), items }];
  });

  protected open(event: Event): void {
    if (this.busy()) return;
    if (this.desktop()) {
      this.menu()?.toggle(event);
    } else {
      this.sheetOpen.set(true);
    }
  }

  // -- Sheet (mobile) ---------------------------------------------------

  protected closeSheet(): void {
    if (!this.sheetOpen()) return;
    this.sheetOpen.set(false);
    this.focusTriggerAfterRender();
  }

  protected pickFromSheet(): void {
    // The picker must open inside this click's user gesture, so it runs BEFORE the sheet closes.
    this.pickFile();
    this.closeSheet();
  }

  protected removeFromSheet(): void {
    this.sheetOpen.set(false);
    this.openConfirm();
  }

  // -- Picker -----------------------------------------------------------

  private pickFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  /**
   * The value is reset after EVERY pick: a `change` event only fires when the value differs, so
   * choosing the same file again (e.g. after an error) would otherwise do nothing.
   */
  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (file === null || this.busy()) return;
    this.store.dispatch(AuthActions.uploadAvatar({ file }));
  }

  // -- Menu (desktop) ---------------------------------------------------

  protected onMenuHidden(): void {
    // A remove confirmation took over focus; do not steal it back.
    if (this.confirmOpen()) return;
    this.focusTrigger();
  }

  // -- Remove confirmation ----------------------------------------------

  private openConfirm(): void {
    this.confirmOpen.set(true);
  }

  protected cancelRemove(): void {
    this.confirmOpen.set(false);
  }

  protected confirmRemove(): void {
    this.confirmOpen.set(false);
    this.store.dispatch(AuthActions.removeAvatar());
  }

  /** Focus returns to the avatar once the dialog has left (PrimeNG hides it with an animation). */
  protected onConfirmHidden(): void {
    this.focusTrigger();
  }

  /**
   * Escape / backdrop for the confirmation, independent of PrimeNG: `[closable]="false"` (needed to
   * suppress its header X) also disables both dismiss paths there - the M-029 trap documented on
   * the home-point card. Both mean "decline" and route to the Cancel handler.
   */
  @HostListener('window:keydown', ['$event'])
  protected onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.confirmOpen()) {
      event.preventDefault();
      this.cancelRemove();
    }
  }

  @HostListener('window:mousedown', ['$event'])
  protected onWindowMousedown(event: MouseEvent): void {
    const target = event.target;
    if (
      this.confirmOpen() &&
      target instanceof HTMLElement &&
      target.classList.contains(this.removeMaskClass)
    ) {
      this.cancelRemove();
    }
  }

  // -- Focus ------------------------------------------------------------

  private focusTrigger(): void {
    this.trigger()?.nativeElement.focus();
  }

  private focusTriggerAfterRender(): void {
    afterNextRender(() => this.focusTrigger(), { injector: this.injector });
  }
}
