import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ChatApiService } from './chat-api.service';
import { ChatBadgeService } from './chat-badge.service';

describe('ChatBadgeService.requestRefresh', () => {
  afterEach(() => vi.useRealTimers());

  it('coalesces a burst of triggers into one fetch and updates the count', () => {
    vi.useFakeTimers();
    const getConversations = vi.fn(() => of([{ unreadCount: 2 }, { unreadCount: 1 }]));
    TestBed.configureTestingModule({
      providers: [{ provide: ChatApiService, useValue: { getConversations } }],
    });
    const badge = TestBed.inject(ChatBadgeService);

    badge.requestRefresh();
    badge.requestRefresh();
    badge.requestRefresh();
    expect(getConversations).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(getConversations).toHaveBeenCalledTimes(1);
    expect(badge.unreadCount()).toBe(3);
  });
});
