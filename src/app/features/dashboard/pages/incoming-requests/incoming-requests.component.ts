import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DashboardShellComponent } from '../../components/dashboard-shell/dashboard-shell.component';
import { FilterTabsComponent, FilterTab } from '../../../../shared/ui/filter-tabs/filter-tabs.component';
import { StatusBadgeComponent, DashStatus } from '../../../../shared/ui/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

interface Request {
  id: number;
  renterName: string;
  renterImg: string;
  renterRating: number;
  renterRentals: number;
  toy: string;
  toyImg: string;
  dates: string;
  total: string;
  timeAgo: string;
  message: string;
  status?: DashStatus;
}

const ALL_REQUESTS: Record<string, Request[]> = {
  pending: [
    { id: 1, renterName: 'Narek A.', renterImg: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face', renterRating: 4.9, renterRentals: 8, toy: 'LEGO Duplo Town Set', toyImg: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=80&h=80&fit=crop', dates: 'Jun 22 – Jun 28', total: '₽9,000', timeAgo: '2h ago', message: 'Hi! Is this available for my son\'s birthday week? We\'re close to Kentron.' },
    { id: 2, renterName: 'Lilit M.', renterImg: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face', renterRating: 5.0, renterRentals: 3, toy: 'Wooden play kitchen', toyImg: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=80&h=80&fit=crop', dates: 'Jun 24 – Jul 1', total: '₽8,400', timeAgo: '5h ago', message: 'Would love to rent this. Can we arrange courier delivery?' },
    { id: 3, renterName: 'Gor S.', renterImg: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face', renterRating: 4.7, renterRentals: 12, toy: 'Wooden balance bike', toyImg: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=80&h=80&fit=crop', dates: 'Jun 30 – Jul 3', total: '₽1,600', timeAgo: '1d ago', message: 'Is the bike suitable for a 4 year old just learning?' },
  ],
  accepted: [
    { id: 4, renterName: 'Anna K.', renterImg: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face', renterRating: 4.8, renterRentals: 5, toy: 'Plush family pack', toyImg: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=80&h=80&fit=crop', dates: 'Jun 18 – Jun 22', total: '₽1,600', timeAgo: '2d ago', message: 'Perfect! Looking forward to the pickup.', status: 'Approved' },
  ],
  declined: [
    { id: 5, renterName: 'David P.', renterImg: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face', renterRating: 4.6, renterRentals: 2, toy: 'LEGO Duplo Town Set', toyImg: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=80&h=80&fit=crop', dates: 'Jun 10 – Jun 15', total: '₽7,500', timeAgo: '5d ago', message: 'Hoping to get it for the weekend.', status: 'Declined' },
  ],
};

@Component({
  selector: 'app-incoming-requests',
  standalone: true,
  imports: [DashboardShellComponent, FilterTabsComponent, StatusBadgeComponent, IconComponent],
  templateUrl: './incoming-requests.component.html',
  styleUrl: './incoming-requests.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingRequestsComponent {
  readonly activeTab = signal<string>('pending');

  readonly tabs: FilterTab[] = [
    { key: 'pending',  label: 'Pending',  count: 3 },
    { key: 'accepted', label: 'Accepted', count: 1 },
    { key: 'declined', label: 'Declined', count: 1 },
  ];

  readonly requests = computed(() => ALL_REQUESTS[this.activeTab()] ?? []);
}
