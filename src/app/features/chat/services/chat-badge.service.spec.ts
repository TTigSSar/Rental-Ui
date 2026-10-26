import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

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
    badge.start();
    vi.advanceTimersByTime(0);
    getConversations.mockClear();

    badge.requestRefresh();
    badge.requestRefresh();
    badge.requestRefresh();
    expect(getConversations).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(getConversations).toHaveBeenCalledTimes(1);
    expect(badge.unreadCount()).toBe(3);
  });

  it('drops a request made while signed out and one pending when stop() runs', () => {
    vi.useFakeTimers();
    const getConversations = vi.fn(() => of([{ unreadCount: 5 }]));
    TestBed.configureTestingModule({
      providers: [{ provide: ChatApiService, useValue: { getConversations } }],
    });
    const badge = TestBed.inject(ChatBadgeService);

    badge.requestRefresh();
    vi.advanceTimersByTime(1000);
    expect(getConversations).not.toHaveBeenCalled();

    badge.start();
    vi.advanceTimersByTime(0);
    getConversations.mockClear();
    badge.requestRefresh();
    badge.stop();
    vi.advanceTimersByTime(1000);
    expect(getConversations).not.toHaveBeenCalled();
    expect(badge.unreadCount()).toBe(0);
  });

  it('ignores an old session response that lands after a fast logout -> login', () => {
    vi.useFakeTimers();
    const first = new Subject<{ unreadCount: number }[]>();
    const second = new Subject<{ unreadCount: number }[]>();
    const getConversations = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    TestBed.configureTestingModule({
      providers: [{ provide: ChatApiService, useValue: { getConversations } }],
    });
    const badge = TestBed.inject(ChatBadgeService);

    badge.start(); // user A, request 1 in flight
    vi.advanceTimersByTime(0);
    badge.stop();
    badge.start(); // user B, request 2 in flight
    vi.advanceTimersByTime(0);
    first.next([{ unreadCount: 9 }]);
    expect(badge.unreadCount()).toBe(0);

    second.next([{ unreadCount: 2 }]);
    expect(badge.unreadCount()).toBe(2);
  });

  it('discardInFlight drops a response that started before a local change', () => {
    vi.useFakeTimers();
    const pending = new Subject<{ unreadCount: number }[]>();
    const getConversations = vi.fn(() => pending);
    TestBed.configureTestingModule({
      providers: [{ provide: ChatApiService, useValue: { getConversations } }],
    });
    const badge = TestBed.inject(ChatBadgeService);
    badge.start();
    vi.advanceTimersByTime(0);
    badge.setUnreadCount(0);

    badge.discardInFlight();
    pending.next([{ unreadCount: 1 }]);

    expect(badge.unreadCount()).toBe(0);
  });
});
