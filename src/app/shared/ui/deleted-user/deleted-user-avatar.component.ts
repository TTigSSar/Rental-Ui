import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** ADR-056 — the one avatar shown wherever a deleted account would appear. Decorative. */
@Component({
  selector: 'app-deleted-user-avatar',
  standalone: true,
  template:
    '<span class="deleted-user-avatar" aria-hidden="true" [style.width.px]="size()" [style.height.px]="size()"><i class="pi pi-user" [style.font-size.px]="glyph()"></i></span>',
  styles: [
    `
      :host {
        display: inline-flex;
        flex-shrink: 0;
      }
      .deleted-user-avatar {
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: var(--ui-color-surface-muted);
        color: var(--ui-color-text-secondary);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletedUserAvatarComponent {
  /** Diameter in px. */
  readonly size = input<number>(40);
  protected readonly glyph = computed(() => Math.round(this.size() * 0.42));
}
