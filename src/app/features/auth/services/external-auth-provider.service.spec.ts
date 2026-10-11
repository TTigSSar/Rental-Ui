import { TestBed } from '@angular/core/testing';

import { AppleAuthService } from './apple-auth.service';
import { ExternalAuthConfigService } from './external-auth-config.service';
import { ExternalAuthProviderService } from './external-auth-provider.service';

/**
 * ADR-030 §3: a new nonce takes effect only through initialize({nonce}) + emptying the
 * container + renderButton, always together. These tests pin that against a fake GIS that
 * records the order of calls.
 */
describe('ExternalAuthProviderService.renderGoogleButton — nonce rule', () => {
  let log: string[];
  let initializeOptions: { nonce?: string; callback: (r: { credential?: string }) => void }[];
  let container: HTMLElement;
  let service: ExternalAuthProviderService;

  beforeEach(() => {
    log = [];
    initializeOptions = [];
    container = document.createElement('div');
    container.appendChild(document.createElement('iframe')); // a previously rendered button

    // The script is already on the page, so no network is involved.
    const script = document.createElement('script');
    script.id = 'google-identity-services-script';
    document.head.appendChild(script);

    (window as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize: (o: { nonce?: string; callback: (r: { credential?: string }) => void }) => {
            initializeOptions.push(o);
            log.push(`initialize:${o.nonce ?? 'none'}`);
          },
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => {
            log.push(`render:children=${el.childElementCount}`);
            log.push(`options:${JSON.stringify(o)}`);
          },
          cancel: vi.fn(),
        },
      },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ExternalAuthConfigService, useValue: { googleClientId: 'client-id' } },
        { provide: AppleAuthService, useValue: {} },
      ],
    });
    service = TestBed.inject(ExternalAuthProviderService);
  });

  afterEach(() => {
    document.getElementById('google-identity-services-script')?.remove();
    delete (window as unknown as { google?: unknown }).google;
  });

  it('a new nonce = initialize + empty container + renderButton, in that order', async () => {
    await service.renderGoogleButton(container, vi.fn(), { nonce: 'n1', locale: 'hy', width: 350 });

    expect(log[0]).toBe('initialize:n1');
    // the iframe from the previous render is gone BEFORE renderButton runs
    expect(log[1]).toBe('render:children=0');
    expect(JSON.parse(log[2].replace('options:', ''))).toMatchObject({
      locale: 'hy',
      width: 350,
    });
    // `nonce` is an initialize() option, never a renderButton one
    expect(log[2]).not.toContain('nonce');
  });

  it('every new nonce initialises again, each time followed by clear + render (never initialize alone)', async () => {
    await service.renderGoogleButton(container, vi.fn(), { nonce: 'n1' });
    await service.renderGoogleButton(container, vi.fn(), { nonce: 'n2' });

    const initialises = log.filter((l) => l.startsWith('initialize'));
    expect(initialises).toEqual(['initialize:n1', 'initialize:n2']);
    // every initialize is immediately followed by the render of an emptied container
    log.forEach((entry, i) => {
      if (entry.startsWith('initialize')) {
        expect(log[i + 1]).toBe('render:children=0');
      }
    });
  });

  it('re-rendering with the SAME nonce (language switch, resize) skips initialize but still clears and renders', async () => {
    await service.renderGoogleButton(container, vi.fn(), { nonce: 'n1', locale: 'en' });
    container.appendChild(document.createElement('iframe'));
    await service.renderGoogleButton(container, vi.fn(), { nonce: 'n1', locale: 'ru' });

    expect(log.filter((l) => l.startsWith('initialize'))).toEqual(['initialize:n1']);
    expect(log.filter((l) => l.startsWith('render:'))).toEqual([
      'render:children=0',
      'render:children=0',
    ]);
  });

  it('delivers credentials to the latest callback and ignores blank ones', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await service.renderGoogleButton(container, first, { nonce: 'n1' });
    await service.renderGoogleButton(container, second, { nonce: 'n1' });

    initializeOptions[0].callback({ credential: '  tok  ' });
    initializeOptions[0].callback({ credential: '   ' });
    initializeOptions[0].callback({});

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('tok');
  });

  it('releaseGoogleButton stops delivery to a block that is gone', async () => {
    const cb = vi.fn();
    await service.renderGoogleButton(container, cb, { nonce: 'n1' });
    service.releaseGoogleButton(cb);

    initializeOptions[0].callback({ credential: 'tok' });

    expect(cb).not.toHaveBeenCalled();
  });

  it('popup mode, no auto select', async () => {
    await service.renderGoogleButton(container, vi.fn(), { nonce: 'n1' });
    expect(initializeOptions[0]).toMatchObject({ ux_mode: 'popup', auto_select: false });
  });
});
