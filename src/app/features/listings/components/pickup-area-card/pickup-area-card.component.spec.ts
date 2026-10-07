import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';
import type { HomePoint } from '../../../auth/models/auth.models';
import { MapComponent } from '../../../../shared/ui/map/map.component';
import { PickupAreaCardComponent } from './pickup-area-card.component';

/** `app-map` dynamic-imports the real `leaflet`; stubbed as everywhere else. */
vi.mock('leaflet', () => ({
  map: vi.fn((_el: HTMLElement, options: { center: [number, number] }) => ({
    setView: vi.fn(),
    on: vi.fn(),
    getCenter: vi.fn(() => ({ lat: options.center[0], lng: options.center[1] })),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  marker: vi.fn(() => ({ addTo: vi.fn() })),
  circle: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

const HOME_POINT: HomePoint = {
  latitude: 40.183332,
  longitude: 44.514999,
  publicLatitude: 40.1835,
  publicLongitude: 44.5152,
  district: {
    id: 'd1111111-1111-1111-1111-111111111111',
    code: 'kentron',
    nameEn: 'Kentron',
    nameHy: 'Կենտրոն',
    nameRu: 'Кентрон',
  },
  updatedAt: '2026-09-27T20:03:21.000Z',
};

function setup(homePoint: HomePoint | null = HOME_POINT): ComponentFixture<PickupAreaCardComponent> {
  TestBed.configureTestingModule({
    imports: [PickupAreaCardComponent, TranslateModule.forRoot()],
    providers: [
      provideMockStore({
        initialState: {
          [authFeatureKey]: {
            ...initialAuthState,
            isAuthenticated: true,
            isInitializing: false,
            user: {
              id: 'u1',
              email: 'owner@rental.local',
              firstName: 'Ada',
              lastName: 'Lovelace',
              roles: ['User'],
              homePoint,
            },
          },
        },
      }),
    ],
  });
  const fixture = TestBed.createComponent(PickupAreaCardComponent);
  fixture.detectChanges();
  return fixture;
}

describe('PickupAreaCardComponent', () => {
  it('renders the district and the read-only city row', () => {
    const fixture = setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Kentron');
    expect(fixture.nativeElement.querySelector('.pickup-card__city-value')).toBeTruthy();
    // Read-only: no control of any kind for the city.
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  /**
   * ADR-008: the owner's exact pin is theirs alone. This card's job is to show
   * what RENTERS see, so it draws the public (geohash-snapped) pair and the
   * ~100 m circle — never the exact point.
   */
  it('draws the PUBLIC coordinate, not the exact one', () => {
    const fixture = setup();

    const map = fixture.debugElement.children
      .map((c) => c.query((n) => n.componentInstance instanceof MapComponent))
      .find((n) => n !== null);
    const mapInstance = (map?.componentInstance ?? null) as MapComponent | null;
    expect(mapInstance).not.toBeNull();
    expect(mapInstance!.center()).toEqual({
      lat: HOME_POINT.publicLatitude,
      lng: HOME_POINT.publicLongitude,
    });
    expect(mapInstance!.center()).not.toEqual({
      lat: HOME_POINT.latitude,
      lng: HOME_POINT.longitude,
    });
    expect(mapInstance!.circleRadiusMeters()).toBe(100);
  });

  it('falls back to the exact pair only while the backend has not derived a public one', () => {
    const fixture = setup({ ...HOME_POINT, publicLatitude: null, publicLongitude: null });

    expect(fixture.nativeElement.querySelector('app-map')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.pickup-card__empty')).toBeNull();
  });

  it('shows an honest empty line when no home point is set — and still offers the change row', () => {
    const fixture = setup(null);

    expect(fixture.nativeElement.querySelector('.pickup-card__empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-map')).toBeNull();
    expect(fixture.nativeElement.querySelector('.pickup-card__change')).toBeTruthy();
  });

  /**
   * Deviation from the boards: they linked this row to the profile page. The
   * wizard and the edit page both hold unsaved form state and save no draft, so
   * navigating away would throw a half-filled listing away. The card only
   * ASKS; the host opens the picker in place.
   */
  it('emits changeRequested instead of navigating anywhere', () => {
    const fixture = setup();
    let emitted = 0;
    fixture.componentInstance.changeRequested.subscribe(() => (emitted += 1));

    const button = fixture.nativeElement.querySelector(
      '.pickup-card__change',
    ) as HTMLButtonElement;
    // Not a link — a link is how you lose the form. (The only `<a>` inside the
    // card is `app-map`'s MapTiler attribution, which is a licence
    // requirement, so the check is scoped to the card's own rows.)
    expect(button.tagName).toBe('BUTTON');
    expect(fixture.nativeElement.querySelector('.pickup-card > a[href]')).toBeNull();

    button.click();

    expect(emitted).toBe(1);
  });

  it('focusChangeButton() puts focus back on the row that opened the picker (a11y)', () => {
    const fixture = setup();

    fixture.componentInstance.focusChangeButton();

    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.pickup-card__change'),
    );
  });
});
