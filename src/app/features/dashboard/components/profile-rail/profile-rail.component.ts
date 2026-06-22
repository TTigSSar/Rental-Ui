import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

interface NavItem {
  key: string;
  label: string;
  icon: string;
  route: string;
  count?: number;
  suffix?: string;
}

@Component({
  selector: 'app-profile-rail',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './profile-rail.component.html',
  styleUrl: './profile-rail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileRailComponent {
  readonly active = input<string>('');

  readonly navItems: NavItem[] = [
    { key: 'my-toys',            label: 'My toys',             icon: 'grid',     route: '/dashboard/my-toys',   count: 5 },
    { key: 'my-rentals',         label: 'My rentals',          icon: 'calendar', route: '/dashboard/rentals',   suffix: '2 upcoming' },
    { key: 'incoming-requests',  label: 'Incoming requests',   icon: 'message',  route: '/dashboard/requests',  count: 3 },
    { key: 'saved-toys',         label: 'Saved toys',          icon: 'bookmark', route: '/dashboard/favorites', count: 8 },
  ];
}
