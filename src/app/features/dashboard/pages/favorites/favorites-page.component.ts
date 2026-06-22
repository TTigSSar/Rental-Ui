import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DashboardShellComponent } from '../../components/dashboard-shell/dashboard-shell.component';
import { FilterTabsComponent, FilterTab } from '../../../../shared/ui/filter-tabs/filter-tabs.component';
import { ToyCardComponent, ToyCardData } from '../../../../shared/ui/toy-card/toy-card.component';

const ALL_TOYS: ToyCardData[] = [
  { id: 1, title: 'LEGO City Fire Station', age: '5–10 yr', rating: 4.8, owner: 'Tigran S.', pricePerDay: 1800, available: true,  imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&h=300&fit=crop' },
  { id: 2, title: 'Wooden play kitchen',    age: '3–7 yr',  rating: 5.0, owner: 'Marina H.', pricePerDay: 1200, available: true,  imageUrl: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=400&h=300&fit=crop' },
  { id: 3, title: 'Baby activity gym',      age: '0–1 yr',  rating: 4.9, owner: 'Aram K.',   pricePerDay: 500,  available: false, imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop' },
  { id: 4, title: 'Big-wheel race set',     age: '4–8 yr',  rating: 4.7, owner: 'Narek A.',  pricePerDay: 900,  available: true,  imageUrl: 'https://images.unsplash.com/photo-1503942466616-6e39d91e3e77?w=400&h=300&fit=crop' },
  { id: 5, title: 'Plush family pack · 8pc',age: '0–3 yr',  rating: 4.6, owner: 'Lilit M.',  pricePerDay: 400,  available: true,  imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=300&fit=crop' },
  { id: 6, title: 'Soft foam block set',    age: '1–4 yr',  rating: 4.8, owner: 'Gor S.',    pricePerDay: 600,  available: false, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop' },
  { id: 7, title: 'LEGO Duplo Town Set',    age: '2–5 yr',  rating: 4.9, owner: 'Anna S.',   pricePerDay: 1500, available: true,  imageUrl: 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=300&fit=crop' },
  { id: 8, title: 'Wooden balance bike',    age: '3–6 yr',  rating: 4.8, owner: 'David P.',  pricePerDay: 800,  available: true,  imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=300&fit=crop' },
];

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [DashboardShellComponent, FilterTabsComponent, ToyCardComponent],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPageComponent {
  readonly activeTab = signal<string>('all');

  readonly tabs: FilterTab[] = [
    { key: 'all',       label: 'All',       count: 8 },
    { key: 'available', label: 'Available', count: 6 },
    { key: 'rented',    label: 'Rented',    count: 2 },
  ];

  readonly toys = computed(() => {
    const tab = this.activeTab();
    if (tab === 'available') return ALL_TOYS.filter(t => t.available);
    if (tab === 'rented')    return ALL_TOYS.filter(t => !t.available);
    return ALL_TOYS;
  });
}
