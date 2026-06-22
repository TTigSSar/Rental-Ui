import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProfileRailComponent } from '../profile-rail/profile-rail.component';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [ProfileRailComponent],
  templateUrl: './dashboard-shell.component.html',
  styleUrl: './dashboard-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardShellComponent {
  readonly activeNav = input<string>('');
}
