import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import { makePendingListing } from '../../../../testing/fixtures';
import { AdminListingsApiService } from '../services/admin-listings-api.service';
import * as AdminModerationActions from './admin-moderation.actions';
import { AdminModerationEffects } from './admin-moderation.effects';

function setup(api: Partial<AdminListingsApiService> = {}) {
  const harness = actionsHarness();
  const messageService = { add: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      AdminModerationEffects,
      harness.provider,
      { provide: AdminListingsApiService, useValue: api },
      { provide: MessageService, useValue: messageService },
      { provide: TranslateService, useValue: { instant: (k: string) => k } },
    ],
  });
  return { harness, messageService, effects: TestBed.inject(AdminModerationEffects) };
}

describe('AdminModerationEffects', () => {
  it('loads the pending queue', async () => {
    const items = [makePendingListing()];
    const { harness, effects } = setup({ getPendingListings: vi.fn().mockReturnValue(of(items)) });
    const result = collect(effects.loadPendingListings$);
    harness.send(AdminModerationActions.loadPendingListings());
    harness.complete();
    expect(await result).toEqual([
      AdminModerationActions.loadPendingListingsSuccess({ items }),
    ]);
  });

  describe('approve', () => {
    it('emits success with the listing id', async () => {
      const { harness, effects } = setup({ approveListing: vi.fn().mockReturnValue(of(undefined)) });
      const result = collect(effects.approvePendingListing$);
      harness.send(AdminModerationActions.approvePendingListing({ listingId: 'p1' }));
      harness.complete();
      expect(await result).toEqual([
        AdminModerationActions.approvePendingListingSuccess({ listingId: 'p1' }),
      ]);
    });

    it('emits failure carrying the listing id and a normalized error', async () => {
      const { harness, effects } = setup({
        approveListing: vi.fn().mockReturnValue(throwError(() => new Error('denied'))),
      });
      const result = collect(effects.approvePendingListing$);
      harness.send(AdminModerationActions.approvePendingListing({ listingId: 'p1' }));
      harness.complete();
      expect(await result).toEqual([
        AdminModerationActions.approvePendingListingFailure({ listingId: 'p1', error: 'denied' }),
      ]);
    });
  });

  it('reject forwards the reason and emits success', async () => {
    const rejectListing = vi.fn().mockReturnValue(of(undefined));
    const { harness, effects } = setup({ rejectListing });
    const result = collect(effects.rejectPendingListing$);
    harness.send(AdminModerationActions.rejectPendingListing({ listingId: 'p1', reason: 'spam' }));
    harness.complete();
    expect(await result).toEqual([
      AdminModerationActions.rejectPendingListingSuccess({ listingId: 'p1' }),
    ]);
    expect(rejectListing).toHaveBeenCalledWith('p1', 'spam');
  });

  describe('toasts', () => {
    it('shows a success toast after an approval', () => {
      const { harness, messageService, effects } = setup();
      effects.approveSuccess$.subscribe();
      harness.send(AdminModerationActions.approvePendingListingSuccess({ listingId: 'p1' }));
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' }),
      );
    });

    it('shows an error toast carrying the failure detail', () => {
      const { harness, messageService, effects } = setup();
      effects.actionFailure$.subscribe();
      harness.send(
        AdminModerationActions.rejectPendingListingFailure({ listingId: 'p1', error: 'boom' }),
      );
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'boom' }),
      );
    });
  });
});
