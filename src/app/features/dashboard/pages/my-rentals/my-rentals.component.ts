import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DashboardShellComponent } from '../../components/dashboard-shell/dashboard-shell.component';
import { FilterTabsComponent, FilterTab } from '../../../../shared/ui/filter-tabs/filter-tabs.component';
import { StatusBadgeComponent, DashStatus } from '../../../../shared/ui/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

interface Rental {
  id: number;
  toy: string;
  imageUrl: string;
  status: DashStatus;
  ownerName: string;
  ownerImg: string;
  dates: string;
  total: string;
  timeLabel: string;
  timeWarn?: boolean;
}

const ALL_RENTALS: Record<string, Rental[]> = {
  active: [
    { id: 1, toy: 'LEGO Duplo Town Set', imageUrl: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=180&h=135&fit=crop', status: 'Toy handed over', ownerName: 'Tigran S.', ownerImg: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&h=60&fit=crop&crop=face', dates: 'Jun 16 – Jun 22', total: '₽9,000', timeLabel: '3 days left' },
    { id: 2, toy: 'Wooden balance bike', imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=180&h=135&fit=crop', status: 'Toy handed over', ownerName: 'David P.', ownerImg: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=60&h=60&fit=crop&crop=face', dates: 'Jun 21 – Jun 22', total: '₽1,600', timeLabel: 'Due tomorrow', timeWarn: true },
  ],
  upcoming: [
    { id: 3, toy: 'Wooden play kitchen', imageUrl: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=180&h=135&fit=crop', status: 'Approved', ownerName: 'Marina H.', ownerImg: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60&h=60&fit=crop&crop=face', dates: 'Jun 24 – Jul 1', total: '₽8,400', timeLabel: 'Starts in 4 days' },
    { id: 4, toy: 'LEGO City Fire Station', imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=180&h=135&fit=crop', status: 'Booking requested', ownerName: 'Aram K.', ownerImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face', dates: 'Jun 28 – Jul 5', total: '₽12,600', timeLabel: 'Awaiting approval' },
  ],
  past: [
    { id: 5, toy: 'Baby activity gym', imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=180&h=135&fit=crop', status: 'Completed', ownerName: 'Lilit M.', ownerImg: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=60&h=60&fit=crop&crop=face', dates: 'Jun 1 – Jun 7', total: '₽3,500', timeLabel: '' },
    { id: 6, toy: 'Plush family pack', imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=180&h=135&fit=crop', status: 'Completed', ownerName: 'Narek A.', ownerImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&h=60&fit=crop&crop=face', dates: 'May 20 – May 24', total: '₽1,600', timeLabel: '' },
  ],
};

@Component({
  selector: 'app-my-rentals',
  standalone: true,
  imports: [DashboardShellComponent, FilterTabsComponent, StatusBadgeComponent, IconComponent],
  templateUrl: './my-rentals.component.html',
  styleUrl: './my-rentals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyRentalsComponent {
  readonly activeTab = signal<string>('active');

  readonly tabs: FilterTab[] = [
    { key: 'active',   label: 'Active',   count: 2 },
    { key: 'upcoming', label: 'Upcoming', count: 2 },
    { key: 'past',     label: 'Past',     count: 2 },
  ];

  readonly rentals = computed(() => ALL_RENTALS[this.activeTab()] ?? []);
}
