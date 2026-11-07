import { TestBed } from '@angular/core/testing';

import {
  BrowserNotificationService,
  NOTIFICATION_PROMPT_DISMISSED_KEY,
} from './browser-notification.service';

type FakeNotificationCtor = {
  permission: string;
  requestPermission: ReturnType<typeof vi.fn>;
  mock: { instances: unknown[] };
} & ReturnType<typeof vi.fn>;

function stubNotification(permission: string): FakeNotificationCtor {
  const ctor = vi.fn(function (this: { onclick: (() => void) | null; close: () => void }) {
    this.onclick = null;
    this.close = vi.fn();
  }) as unknown as FakeNotificationCtor;
  ctor.permission = permission;
  ctor.requestPermission = vi.fn().mockImplementation(async () => {
    ctor.permission = 'granted';
    return 'granted';
  });
  vi.stubGlobal('Notification', ctor);
  return ctor;
}

/** The unit-test environment has no usable localStorage; give each test a fresh in-memory one. */
function stubStorage(): Storage {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage;
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('BrowserNotificationService', () => {
  beforeEach(() => stubStorage());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports unsupported without the Notification API and never throws', async () => {
    vi.stubGlobal('Notification', undefined);
    const service = TestBed.inject(BrowserNotificationService);
    expect(service.permission()).toBe('unsupported');
    expect(service.supported()).toBe(false);
    expect(service.canPrompt()).toBe(false);
    expect(await service.requestPermission()).toBe('unsupported');
    expect(service.show({ title: 't', body: 'b', tag: 'c', onClick: () => {} })).toBeNull();
  });

  it('can prompt only when permission is default and not dismissed', () => {
    stubNotification('default');
    const service = TestBed.inject(BrowserNotificationService);
    expect(service.canPrompt()).toBe(true);
    service.dismissPrompt();
    expect(service.canPrompt()).toBe(false);
    expect(localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY)).toBe('1');
  });

  it('does not prompt when permission is already granted or denied', () => {
    stubNotification('granted');
    expect(TestBed.inject(BrowserNotificationService).canPrompt()).toBe(false);
    TestBed.resetTestingModule();
    stubNotification('denied');
    expect(TestBed.inject(BrowserNotificationService).canPrompt()).toBe(false);
  });

  it('stays dismissed across instances (per device) and survives blocked storage', () => {
    stubNotification('default');
    localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, '1');
    expect(TestBed.inject(BrowserNotificationService).canPrompt()).toBe(false);

    TestBed.resetTestingModule();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const service = TestBed.inject(BrowserNotificationService);
    expect(() => service.dismissPrompt()).not.toThrow();
    expect(service.canPrompt()).toBe(false);
  });

  it('requestPermission opens the browser dialog and updates the signal', async () => {
    const ctor = stubNotification('default');
    const service = TestBed.inject(BrowserNotificationService);
    expect(await service.requestPermission()).toBe('granted');
    expect(ctor.requestPermission).toHaveBeenCalledOnce();
    expect(service.permission()).toBe('granted');
  });

  it('show creates a tagged notification only when granted; click runs the handler and closes', () => {
    const ctor = stubNotification('default');
    const service = TestBed.inject(BrowserNotificationService);
    expect(service.show({ title: 't', body: 'b', tag: 'c1', onClick: () => {} })).toBeNull();

    ctor.permission = 'granted';
    const onClick = vi.fn();
    const close = service.show({ title: 'Anna', body: 'Hi', tag: 'c1', onClick });
    expect(close).not.toBeNull();
    expect(ctor).toHaveBeenCalledWith('Anna', { body: 'Hi', tag: 'c1' });
    const instance = ctor.mock.instances[0] as { onclick: () => void; close: () => void };
    instance.onclick();
    expect(onClick).toHaveBeenCalledOnce();
    expect(instance.close).toHaveBeenCalledOnce();
  });
});
