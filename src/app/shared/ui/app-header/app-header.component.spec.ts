import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { AppHeaderComponent } from './app-header.component';
import { HeaderSearchVisibilityService } from './header-search-visibility.service';

function createFixture() {
  TestBed.configureTestingModule({
    imports: [AppHeaderComponent, TranslateModule.forRoot()],
    providers: [provideRouter([]), provideMockStore()],
  });

  return TestBed.createComponent(AppHeaderComponent);
}

describe('AppHeaderComponent layout', () => {
  it('puts the brand and the controls on the shared page grid', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const inner = host.querySelector('.nh__inner');

    // The brand and the right-hand controls must sit inside the ONE box that
    // also bounds the page body — see .nh__inner in the stylesheet.
    expect(inner).not.toBeNull();
    expect(inner!.querySelector('.nh__brand')).not.toBeNull();
    expect(inner!.querySelector('.nh__controls')).not.toBeNull();
  });
});

describe('AppHeaderComponent search visibility', () => {
  it('shows the search pill by default (every non-Home route)', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const search = host.querySelector('.nh__search')!;

    expect(host.classList.contains('nh--search-hidden')).toBe(false);
    expect(search.hasAttribute('inert')).toBe(false);
    expect(search.querySelector('.nh__search-input')!.hasAttribute('tabindex')).toBe(false);
    expect(search.querySelector('.nh__search-btn')!.hasAttribute('tabindex')).toBe(false);
  });

  it('hides the pill and removes it from the tab order when searchHidden is set', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('searchHidden', true);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const search = host.querySelector('.nh__search')!;

    expect(host.classList.contains('nh--search-hidden')).toBe(true);
    // `pointer-events: none` alone would leave the controls tabbable.
    expect(search.hasAttribute('inert')).toBe(true);
    expect(search.querySelector('.nh__search-input')!.getAttribute('tabindex')).toBe('-1');
    expect(search.querySelector('.nh__search-btn')!.getAttribute('tabindex')).toBe('-1');
  });

  it('restores the pill when searchHidden flips back to false', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('searchHidden', true);
    fixture.detectChanges();

    fixture.componentRef.setInput('searchHidden', false);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const search = host.querySelector('.nh__search')!;

    expect(host.classList.contains('nh--search-hidden')).toBe(false);
    expect(search.hasAttribute('inert')).toBe(false);
    expect(search.querySelector('.nh__search-input')!.hasAttribute('tabindex')).toBe(false);
  });
});

describe('AppHeaderComponent requests badge', () => {
  function requestsLink(host: HTMLElement): HTMLElement | null {
    return (
      Array.from(host.querySelectorAll<HTMLElement>('.nh__notif-btn')).find((el) =>
        el.querySelector('.pi-inbox'),
      ) ?? null
    );
  }

  it('renders the Requests icon link once authenticated', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('isAuthenticated', true);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const link = requestsLink(host);
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toBe('/profile/requests');
  });

  it('hides the badge when requestsCount is 0', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('isAuthenticated', true);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const link = requestsLink(host)!;
    expect(link.querySelector('.nh__notif-badge')).toBeNull();
  });

  it('shows the badge with the count when requestsCount > 0', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('isAuthenticated', true);
    fixture.componentRef.setInput('requestsCount', 4);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const link = requestsLink(host)!;
    const badge = link.querySelector('.nh__notif-badge');
    expect(badge).not.toBeNull();
    expect(badge!.textContent!.trim()).toBe('4');
  });

  it('caps the displayed badge at "99+"', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('isAuthenticated', true);
    fixture.componentRef.setInput('requestsCount', 150);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const badge = requestsLink(host)!.querySelector('.nh__notif-badge');
    expect(badge!.textContent!.trim()).toBe('99+');
  });
});

describe('HeaderSearchVisibilityService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('defaults to visible', () => {
    expect(TestBed.inject(HeaderSearchVisibilityService).hidden()).toBe(false);
  });

  it('reset() restores the always-visible default after a page hid the search', () => {
    const service = TestBed.inject(HeaderSearchVisibilityService);

    service.setHidden(true);
    expect(service.hidden()).toBe(true);

    service.reset();
    expect(service.hidden()).toBe(false);
  });
});
