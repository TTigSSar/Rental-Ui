import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { reportReasonLabelKey } from '../../../reports/models/report-reason.model';
import type { AdminReportRow } from '../../models/admin-report.model';
import { AdminReportSeverityPillComponent } from '../admin-report-severity-pill/admin-report-severity-pill.component';
import { AdminReportStatusPillComponent } from '../admin-report-status-pill/admin-report-status-pill.component';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TYPE_ICON: Record<AdminReportRow['targetType'], string> = {
  Listing: 'tag',
  User: 'user',
  Message: 'message',
};

const TYPE_LABEL_KEYS: Record<AdminReportRow['targetType'], string> = {
  Listing: 'admin.reports.detail.typeListing',
  User: 'admin.reports.detail.typeUser',
  Message: 'admin.reports.detail.typeMessage',
};

export interface ReportMessageableContact {
  readonly userId: string;
  readonly name: string;
}

/**
 * The design's `AdminReportDetailModal` (desktop centered dialog) / bottom sheet (mobile) — the
 * full report: target, severity/status, reason, the reporter's free-text note (`detail` — see
 * `admin-report.model.ts`'s header comment on why there's no separate `reporterNote` field on
 * the wire), reporter identity, timestamps, and — once triaged — the resolution note. Renders
 * as a centered modal on desktop and a full-bleed sheet on mobile, and traps focus / restores
 * it on close, same `isDesktop`-flag idiom as `AdminUserProfileDialogComponent`.
 *
 * Resolve/Dismiss accept an optional note via the textarea below the actions; Reopen does not
 * (mirrors `AdminReportsApiService.reopenReport`, which takes no body).
 *
 * The design's "Message {label}" contact buttons (`admin-desktop.jsx:1036`, inside the dropped
 * "suggested steps to resolve" playbook card — see ADR-016 §4) survive without the card that
 * housed them: the reporter is always a real user (`reporterId`), but the reported party only
 * resolves to a real id when `targetType === 'User'` (`targetId`) — a Listing/Message report's
 * target carries no owner/participant id on `AdminReportRow`, so no button is fabricated for
 * those (ADR-014's rule: no id, no button, not a guess). `messageUser` hands the chosen user id
 * up; the page navigates to `/admin/messages?userId=<id>` and closes this dialog, same contract
 * as `owner-trust-panel`/`users-page`'s row menu.
 */
@Component({
  selector: 'app-admin-report-detail-dialog',
  standalone: true,
  imports: [
    AdminReportSeverityPillComponent,
    AdminReportStatusPillComponent,
    AvatarComponent,
    DatePipe,
    IconComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-report-detail-dialog.component.html',
  styleUrl: './admin-report-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportDetailDialogComponent implements OnInit, OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private previouslyFocused: HTMLElement | null = null;

  readonly report = input.required<AdminReportRow>();
  readonly isDesktop = input<boolean>(false);
  readonly busy = input<boolean>(false);

  readonly close = output<void>();
  readonly resolve = output<{ note?: string }>();
  readonly dismiss = output<{ note?: string }>();
  readonly reopen = output<void>();
  readonly messageUser = output<string>();

  protected readonly note = signal('');

  protected readonly typeIcon = computed(() => TYPE_ICON[this.report().targetType]);
  protected readonly typeLabelKey = computed(() => TYPE_LABEL_KEYS[this.report().targetType]);
  protected readonly reasonLabelKey = computed(() =>
    reportReasonLabelKey(this.report().reasonCode),
  );
  protected readonly isOpen = computed(() => this.report().status === 'Open');
  protected readonly isTargetUser = computed(() => this.report().targetType === 'User');

  /** The reporter always resolves to a real user; the reported party only does when the report
   *  actually targets a User (see this component's doc comment). */
  protected readonly messageableContacts = computed<ReportMessageableContact[]>(() => {
    const r = this.report();
    const contacts: ReportMessageableContact[] = [
      {
        userId: r.reporterId,
        name: `${r.reporterFirstName} ${r.reporterLastName}`.trim() || r.reporterEmail,
      },
    ];
    if (r.targetType === 'User') {
      contacts.push({ userId: r.targetId, name: r.targetLabel });
    }
    return contacts;
  });

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    });
  }

  ngOnInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  protected onBackdropClick(): void {
    if (!this.busy()) this.close.emit();
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (!this.busy()) this.close.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusables = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected onResolve(): void {
    const trimmed = this.note().trim();
    this.resolve.emit(trimmed ? { note: trimmed } : {});
  }

  protected onDismiss(): void {
    const trimmed = this.note().trim();
    this.dismiss.emit(trimmed ? { note: trimmed } : {});
  }
}
