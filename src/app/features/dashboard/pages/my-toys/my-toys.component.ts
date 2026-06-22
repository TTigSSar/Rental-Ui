import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DashboardShellComponent } from '../../components/dashboard-shell/dashboard-shell.component';
import { FilterTabsComponent, FilterTab } from '../../../../shared/ui/filter-tabs/filter-tabs.component';
import { StatusBadgeComponent, DashStatus } from '../../../../shared/ui/status-badge/status-badge.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';

interface MyToy {
  id: number;
  title: string;
  age: string;
  rating: number | null;
  imageUrl: string;
  status: DashStatus;
  pricePerDay: number;
  views: number;
  bookings: number;
}

const ALL_TOYS: MyToy[] = [
  { id: 1, title: 'LEGO Duplo Town Set',  age: '2–5 yr', rating: 4.9, imageUrl: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=80&h=60&fit=crop',   status: 'Live',           pricePerDay: 1500, views: 34, bookings: 5 },
  { id: 2, title: 'Wooden play kitchen',  age: '3–7 yr', rating: 5.0, imageUrl: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=80&h=60&fit=crop', status: 'Live',           pricePerDay: 1200, views: 12, bookings: 3 },
  { id: 3, title: 'Wooden balance bike',  age: '3–6 yr', rating: 4.8, imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=80&h=60&fit=crop', status: 'Live',           pricePerDay: 800,  views: 19, bookings: 2 },
  { id: 4, title: 'Plush family pack',    age: '0–3 yr', rating: null, imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=80&h=60&fit=crop',status: 'Pending review', pricePerDay: 400,  views: 4,  bookings: 0 },
  { id: 5, title: 'Race car set (old)',   age: '4–8 yr', rating: 4.6, imageUrl: 'https://images.unsplash.com/photo-1503942466616-6e39d91e3e77?w=80&h=60&fit=crop', status: 'Archived',       pricePerDay: 600,  views: 28, bookings: 7 },
];

@Component({
  selector: 'app-my-toys',
  standalone: true,
  imports: [DashboardShellComponent, FilterTabsComponent, StatusBadgeComponent, IconComponent],
  templateUrl: './my-toys.component.html',
  styleUrl: './my-toys.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyToysComponent {
  readonly activeTab = signal<string>('all');

  readonly tabs: FilterTab[] = [
    { key: 'all',      label: 'All',      count: 5 },
    { key: 'live',     label: 'Live',     count: 3 },
    { key: 'pending',  label: 'Pending',  count: 1 },
    { key: 'archived', label: 'Archived', count: 1 },
  ];

  readonly toys = computed(() => {
    const tab = this.activeTab();
    if (tab === 'live')     return ALL_TOYS.filter(t => t.status === 'Live');
    if (tab === 'pending')  return ALL_TOYS.filter(t => t.status === 'Pending review');
    if (tab === 'archived') return ALL_TOYS.filter(t => t.status === 'Archived');
    return ALL_TOYS;
  });
}
