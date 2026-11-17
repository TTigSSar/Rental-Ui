import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { PushSubscriptionService, pushOffKey } from './push-subscription.service';

const KEY_URL = toApiUrl(ApiContract.push.publicKey);
const SUB_URL = toApiUrl(ApiContract.push.subscription);

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
};

describe('PushSubscriptionService', () => {
  const order: string[] = [];
  let existing: {
    endpoint: string;
    toJSON: () => unknown;
    unsubscribe: () => Promise<boolean>;
  } | null;
  let pushManager: {
    getSubscription: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  let register: ReturnType<typeof vi.fn>;
  let originals: { sw: unknown; pm: unknown; notif: unknown };

  const makeSub = () => ({
    endpoint: 'https://push.example/abc',
    toJSON: () => ({ keys: { p256dh: 'P', auth: 'A' } }),
    unsubscribe: vi.fn(async () => {
      order.push('unsubscribe');
      return true;
    }),
  });

  function setup(permission = 'granted') {
    const g = globalThis as Record<string, unknown>;
    originals = {
      sw: Object.getOwnPropertyDescriptor(navigator, 'serviceWorker'),
      pm: g['PushManager'],
      notif: g['Notification'],
    };
    pushManager = {
      getSubscription: vi.fn(async () => existing),
      subscribe: vi.fn(async () => {
        existing = makeSub();
        return existing;
      }),
    };
    register = vi.fn(async () => ({ pushManager }));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, getRegistration: vi.fn(async () => ({ pushManager })) },
      configurable: true,
    });
    g['PushManager'] = class {};
    g['Notification'] = Object.assign(function () {}, { permission });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    return {
      service: TestBed.inject(PushSubscriptionService),
      http: TestBed.inject(HttpTestingController),
    };
  }

  beforeEach(() => {
    order.length = 0;
    existing = null;
    localStorage.clear();
  });

  afterEach(() => {
    const g = globalThis as Record<string, unknown>;
    delete (navigator as unknown as Record<string, unknown>)['serviceWorker'];
    if (originals.pm === undefined) delete g['PushManager'];
    else g['PushManager'] = originals.pm;
    if (originals.notif === undefined) delete g['Notification'];
    else g['Notification'] = originals.notif;
  });

  it('subscribes: registers /sw.js, fetches the key, subscribes, PUTs the keys', async () => {
    const { service, http } = setup();
    const done = service.ensureSubscribed('u1');
    await flush();
    http.expectOne(KEY_URL).flush({ publicKey: 'BAAB' });
    await flush();

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    const put = http.expectOne(SUB_URL);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      endpoint: 'https://push.example/abc',
      p256dh: 'P',
      auth: 'A',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await done;

    expect(service.active()).toBe(true);
    http.verify();
  });

  it('404 on the public key marks push unavailable and does not subscribe', async () => {
    const { service, http } = setup();
    const done = service.ensureSubscribed('u1');
    await flush();
    http
      .expectOne(KEY_URL)
      .flush({ errorCode: 'push.not_configured' }, { status: 404, statusText: 'Not Found' });
    await done;

    expect(service.unavailable()).toBe(true);
    expect(service.active()).toBe(false);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('does nothing without permission or with the off flag', async () => {
    const denied = setup('default');
    await denied.service.ensureSubscribed('u1');
    expect(register).not.toHaveBeenCalled();
    denied.http.verify();
  });

  it('does nothing when the off flag is set', async () => {
    const { service, http } = setup();
    localStorage.setItem(pushOffKey('u1'), '1');
    await service.ensureSubscribed('u1');
    expect(register).not.toHaveBeenCalled();
    http.verify();
  });

  it('turnOff: sets the flag, unsubscribes BEFORE the DELETE, swallows a DELETE failure', async () => {
    const { service, http } = setup();
    existing = makeSub();
    const done = service.turnOff('u1');
    await flush();

    expect(localStorage.getItem(pushOffKey('u1'))).not.toBeNull();
    expect(order).toEqual(['unsubscribe']);
    const del = http.expectOne(SUB_URL);
    expect(del.request.method).toBe('DELETE');
    expect(del.request.body).toEqual({ endpoint: 'https://push.example/abc' });
    del.flush(null, { status: 500, statusText: 'Server Error' });
    await expect(done).resolves.toBeUndefined();
    expect(service.active()).toBe(false);
    expect(service.isOff('u1')).toBe(true);
  });

  it('onSessionEnded unsubscribes first then DELETEs, without touching the off flag', async () => {
    const { service, http } = setup();
    existing = makeSub();
    const done = service.onSessionEnded();
    await flush();

    expect(order).toEqual(['unsubscribe']);
    http.expectOne(SUB_URL).flush(null, { status: 401, statusText: 'Unauthorized' });
    await done;
    expect(localStorage.getItem(pushOffKey('u1'))).toBeNull();
  });

  it('clearOff removes the flag', () => {
    const { service } = setup();
    localStorage.setItem(pushOffKey('u1'), '1');
    expect(service.isOff('u1')).toBe(true);
    service.clearOff('u1');
    expect(service.isOff('u1')).toBe(false);
  });

  it('never throws when the browser APIs fail', async () => {
    const { service } = setup();
    register.mockRejectedValue(new Error('boom'));
    await expect(service.ensureSubscribed('u1')).resolves.toBeUndefined();
  });
});
