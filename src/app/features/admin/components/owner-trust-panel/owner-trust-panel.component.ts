import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import type { AdminListingDetail } from '../../models/admin-listing-queue.model';

/**
 * The design's owner-trust panel (`AdminInspectDesktop`'s right-rail card /
 * `AdminInspectMobile`'s owner card). "Message owner" originally had no real channel to point
 * at — chat is booking-scoped and an admin has no booking with this owner — so it stood in as a
 * link to the owner's public profile (ADR-016 §4). The admin console's Messages screen
 * (moderation-only threads, `Conversation.Kind == Moderation`) closes that gap: "Message owner"
 * now navigates to `/admin/messages?userId=<ownerId>`, which gets-or-creates the moderation
 * thread and opens it. "View public profile" stays alongside it — a different destination
 * (public profile vs. private moderation thread), not a duplicate.
 */
@Component({
  selector: 'app-owner-trust-panel',
  standalone: true,
  imports: [AvatarComponent, DatePipe, IconComponent, RouterLink, TranslatePipe],
  templateUrl: './owner-trust-panel.component.html',
  styleUrl: './owner-trust-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerTrustPanelComponent {
  private readonly router = inject(Router);

  readonly listing = input.required<AdminListingDetail>();
  readonly isDesktop = input<boolean>(true);

  protected readonly ownerName = computed(() => {
    const l = this.listing();
    return `${l.ownerFirstName} ${l.ownerLastName}`.trim();
  });

  protected readonly ownerProfilePath = computed<[string, string]>(() => [
    '/users',
    this.listing().ownerId,
  ]);

  protected messageOwner(): void {
    void this.router.navigate(['/admin/messages'], {
      queryParams: { userId: this.listing().ownerId },
    });
  }
}
