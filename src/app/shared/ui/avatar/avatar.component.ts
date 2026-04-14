import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-ui-avatar',
  standalone: true,
  template: `<span class="ui-avatar" [attr.aria-label]="label()">{{ initials() }}</span>`,
  styleUrl: './avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input<string | null>(null);

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
