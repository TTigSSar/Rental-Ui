import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type DashStatus =
  | 'Booking requested' | 'Approved' | 'Toy handed over'
  | 'Completed' | 'Declined' | 'Cancelled'
  | 'Live' | 'Pending review' | 'Archived';

interface BadgeCfg { dot: string; bg: string; text: string; }

const STATUS_MAP: Record<DashStatus, BadgeCfg> = {
  'Booking requested': { dot: 'var(--dash-warn)',    bg: 'var(--dash-warn-surface)',    text: 'var(--dash-warn-text)' },
  'Approved':          { dot: 'var(--dash-success)', bg: 'var(--dash-success-surface)', text: 'var(--dash-success-text)' },
  'Toy handed over':   { dot: 'var(--dash-blue)',    bg: 'var(--dash-blue-surface)',    text: 'var(--dash-blue-text)' },
  'Completed':         { dot: 'var(--dash-mute-text)', bg: 'var(--dash-mute-surface)', text: 'var(--dash-mute-text)' },
  'Declined':          { dot: 'var(--ui-color-danger)', bg: 'var(--ui-color-danger-surface)', text: 'var(--ui-color-rejected)' },
  'Cancelled':         { dot: '#9CA3AF', bg: 'var(--dash-mute-surface)', text: 'var(--dash-mute-text)' },
  'Live':              { dot: 'var(--dash-success)', bg: 'var(--dash-success-surface)', text: 'var(--dash-success-text)' },
  'Pending review':    { dot: 'var(--dash-warn)',    bg: 'var(--dash-warn-surface)',    text: 'var(--dash-warn-text)' },
  'Archived':          { dot: '#9CA3AF', bg: 'var(--dash-mute-surface)', text: 'var(--dash-mute-text)' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="status-badge" [style.background]="cfg().bg" [style.color]="cfg().text">
      <span class="status-badge__dot" [style.background]="cfg().dot"></span>
      {{ status() }}
    </span>
  `,
  styleUrl: './status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadgeComponent {
  readonly status = input.required<DashStatus>();
  protected readonly cfg = computed(() => STATUS_MAP[this.status()] ?? STATUS_MAP['Completed']);
}
