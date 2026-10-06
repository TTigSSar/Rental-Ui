import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { HomePointStatusComponent } from './home-point-status.component';
import type { HomePointSelection } from './home-point-map.model';

const BASE: HomePointSelection = {
  center: { lat: 40.19, lng: 44.51 },
  district: {
    id: 'd1111111-1111-1111-1111-111111111111',
    code: 'kentron',
    nameEn: 'Kentron',
    nameHy: 'Կենտրոն',
    nameRu: 'Кентрон',
  },
  resolving: false,
  outsideYerevan: false,
  deliberate: true,
  geoState: 'idle',
  lowAccuracyMeters: null,
  canConfirm: true,
};

function setup(
  selection: HomePointSelection | null = BASE,
  extra: { serverOutsideYerevan?: boolean; showPrivacyNote?: boolean } = {},
): ComponentFixture<HomePointStatusComponent> {
  TestBed.configureTestingModule({
    imports: [HomePointStatusComponent, TranslateModule.forRoot()],
  });
  const fixture = TestBed.createComponent(HomePointStatusComponent);
  fixture.componentRef.setInput('selection', selection);
  if (extra.serverOutsideYerevan !== undefined) {
    fixture.componentRef.setInput('serverOutsideYerevan', extra.serverOutsideYerevan);
  }
  if (extra.showPrivacyNote !== undefined) {
    fixture.componentRef.setInput('showPrivacyNote', extra.showPrivacyNote);
  }
  fixture.detectChanges();
  return fixture;
}

describe('HomePointStatusComponent', () => {
  it('shows the privacy note and no message for a healthy selection', () => {
    const fixture = setup();

    expect(fixture.nativeElement.querySelector('.hp-status')).toBeNull();
    // The privacy line is always there, BEFORE the user confirms — they should
    // know about the ~100 m circle while deciding, not afterwards.
    expect(fixture.nativeElement.querySelector('.hp-status__privacy')).toBeTruthy();
  });

  it('renders the blocking error for a point outside Yerevan, with role="alert"', () => {
    const fixture = setup({ ...BASE, district: null, outsideYerevan: true, canConfirm: false });

    const el = fixture.nativeElement.querySelector('.hp-status');
    expect(el).toBeTruthy();
    expect(el.classList.contains('hp-status--error')).toBe(true);
    expect(el.getAttribute('role')).toBe('alert');
  });

  /**
   * The backend sends `auth.home_point_outside_yerevan` in `errorCode`, not as a
   * field error. When a host has caught one, the server wins over whatever the
   * client-side district lookup happened to say.
   */
  it('a server-side refusal shows the same error even when the local lookup disagreed', () => {
    const fixture = setup(BASE, { serverOutsideYerevan: true });

    const el = fixture.nativeElement.querySelector('.hp-status');
    expect(el.classList.contains('hp-status--error')).toBe(true);
  });

  it('prefers the blocking error over the low-accuracy warning', () => {
    const fixture = setup({
      ...BASE,
      district: null,
      outsideYerevan: true,
      lowAccuracyMeters: 900,
      canConfirm: false,
    });

    const el = fixture.nativeElement.querySelector('.hp-status');
    expect(el.classList.contains('hp-status--error')).toBe(true);
    expect(el.classList.contains('hp-status--warn')).toBe(false);
  });

  it('warns (not errors) about a low-accuracy fix', () => {
    const fixture = setup({ ...BASE, lowAccuracyMeters: 820 });

    const el = fixture.nativeElement.querySelector('.hp-status');
    expect(el.classList.contains('hp-status--warn')).toBe(true);
    expect(el.getAttribute('role')).toBe('status');
  });

  it('shows a soft info note when the browser refused to share a location', () => {
    const fixture = setup({ ...BASE, geoState: 'denied' });

    const el = fixture.nativeElement.querySelector('.hp-status');
    expect(el.classList.contains('hp-status--info')).toBe(true);
  });

  it('can be rendered without the privacy note for hosts that show it themselves', () => {
    const fixture = setup(BASE, { showPrivacyNote: false });

    expect(fixture.nativeElement.querySelector('.hp-status__privacy')).toBeNull();
  });

  it('renders nothing at all before the map has reported anything', () => {
    const fixture = setup(null, { showPrivacyNote: false });

    expect(fixture.nativeElement.querySelector('.hp-status')).toBeNull();
  });
});
