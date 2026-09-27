import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { makeAdminReportRow } from '../../../../../testing/fixtures';
import { AdminReportDetailDialogComponent } from './admin-report-detail-dialog.component';

describe('AdminReportDetailDialogComponent', () => {
  let fixture: ComponentFixture<AdminReportDetailDialogComponent>;

  async function setup(overrides: Parameters<typeof makeAdminReportRow>[0] = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminReportDetailDialogComponent, TranslateModule.forRoot()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminReportDetailDialogComponent);
    fixture.componentRef.setInput('report', makeAdminReportRow(overrides));
    fixture.componentRef.setInput('isDesktop', true);
    fixture.detectChanges();
  }

  function contactButtons(): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.admin-report-detail-dialog__contact-btn'),
    );
  }

  // ── Contact buttons (`admin-desktop.jsx:1036`'s "Message {label}" affordance) ──
  describe('messageable contacts', () => {
    it('shows a reporter contact and a reported-member contact for a User-target report', async () => {
      await setup({
        targetType: 'User',
        targetId: 'user-9',
        targetLabel: 'Narek Sargsyan',
        reporterId: 'user-2',
      });
      expect(contactButtons().length).toBe(2);
    });

    it('shows only the reporter contact for a Listing-target report — no fabricated owner id', async () => {
      await setup({ targetType: 'Listing', targetId: 'listing-1', reporterId: 'user-2' });
      expect(contactButtons().length).toBe(1);
    });

    it('shows only the reporter contact for a Message-target report — no fabricated participant id', async () => {
      await setup({ targetType: 'Message', targetId: 'conv-1', reporterId: 'user-2' });
      expect(contactButtons().length).toBe(1);
    });

    it('emits messageUser with the reporter id when the first contact button is clicked', async () => {
      await setup({ targetType: 'Listing', reporterId: 'user-2' });
      const spy = vi.fn();
      fixture.componentInstance.messageUser.subscribe(spy);
      contactButtons()[0].click();
      expect(spy).toHaveBeenCalledWith('user-2');
    });

    it('emits messageUser with the target id when the reported-member button is clicked', async () => {
      await setup({ targetType: 'User', targetId: 'user-9', reporterId: 'user-2' });
      const spy = vi.fn();
      fixture.componentInstance.messageUser.subscribe(spy);
      contactButtons()[1].click();
      expect(spy).toHaveBeenCalledWith('user-9');
    });
  });
});
