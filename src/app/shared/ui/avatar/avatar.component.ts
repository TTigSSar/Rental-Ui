import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';

@Component({
  selector: 'app-ui-avatar',
  standalone: true,
  template: `<span
    class="ui-avatar"
    [class.ui-avatar--md]="size() === 'md'"
    [class.ui-avatar--lg]="size() === 'lg'"
    [class.ui-avatar--soft]="tone() === 'soft'"
    [attr.aria-label]="label()"
    >@if (showImage()) {
      <!-- ADR-070: a managed upload or a Google URL. alt="" because the circle is decorative next
           to the name; no-referrer so the Google host does not see our page URL. A failed load
           (404 after a replace, a revoked Google URL, offline) falls back to the initials. -->
      <img
        class="ui-avatar__img"
        [src]="src()"
        alt=""
        referrerpolicy="no-referrer"
        (error)="failed.set(true)"
      />
    } @else {
      {{ initials() }}
    }</span
  >`,
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input<string | null>(null);
  /** `md` matches header / account triggers; `sm` is default for dense UI. */
  readonly size = input<'sm' | 'md' | 'lg'>('sm');
  /** Optional picture URL (absolute Google URL or a relative `/uploads/...` path, served same-origin). */
  readonly src = input<string | null | undefined>(null);
  /**
   * `brand` (default) is the orange-gradient initials badge used across the app; `soft` is the
   * ADR-070 profile look - bold `primary-strong` initials at 38% of the circle on `primary-wash`.
   * Any size can be forced with the `--ui-avatar-size` custom property on the host.
   */
  readonly tone = input<'brand' | 'soft'>('brand');

  /** True after the image failed to load; reset whenever `src` changes. */
  protected readonly failed = linkedSignal<string | null | undefined, boolean>({
    source: this.src,
    computation: () => false,
  });

  protected readonly showImage = computed(() => {
    const url = this.src();
    return typeof url === 'string' && url.length > 0 && !this.failed();
  });

  protected readonly initials = computed(() => {
    const value = this.name()?.trim() ?? '';
    if (value.length === 0) {
      return 'U';
    }
    const parts = value.split(/\s+/).filter((part) => part.length > 0);
    const first = parts[0]?.[0] ?? 'U';
    const second = parts[1]?.[0] ?? '';
    return `${first}${second}`.toUpperCase();
  });

  protected readonly label = computed(() => {
    const value = this.name()?.trim();
    return value && value.length > 0 ? value : 'User';
  });
}
